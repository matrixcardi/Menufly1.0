import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CARD-PAYMENT] ${step}${detailsStr}`);
};

async function refreshMPToken(supabaseClient: any, restaurantId: string, refreshToken: string): Promise<string | null> {
  const appId = Deno.env.get("MP_APP_ID");
  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");

  if (!appId || !clientSecret || !refreshToken) return null;

  logStep("Refreshing Mercado Pago token");

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_secret: clientSecret,
      client_id: appId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    logStep("Token refresh failed", { status: res.status });
    return null;
  }

  await supabaseClient
    .from("restaurants")
    .update({
      pix_gateway_token: data.access_token,
      mp_refresh_token: data.refresh_token,
      mp_public_key: data.public_key || null,
    })
    .eq("id", restaurantId);

  logStep("Token refreshed successfully");
  return data.access_token;
}

interface ThreeDSInfo {
  external_resource_url: string;
  creq: string;
}

type CardResult =
  | { error: false; payment_id: string; status: string; status_detail: string; three_ds_info: ThreeDSInfo | null }
  | { error: true; status: number; body: string };

async function createCardPaymentRequest(
  accessToken: string,
  orderId: string,
  body: Record<string, unknown>,
  deviceId: string | null,
): Promise<CardResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
    // O modo 3DS entra na chave: o fallback mandatory→optional reenvia com body
    // diferente, e o MP responde 409 se a chave repetir com payload alterado.
    "X-Idempotency-Key": `card-${orderId}-${body.three_d_secure_mode}-${body.application_fee ? 'fee' : 'nofee'}`,
  };
  // Device fingerprint do SDK do MP — sinal antifraude importante para reduzir cc_rejected_high_risk.
  if (deviceId) {
    headers["X-meli-session-id"] = deviceId;
  }

  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.text();
    logStep("MP card error", { status: response.status, body: errorData });
    return { error: true, status: response.status, body: errorData };
  }

  const data = await response.json();
  logStep("Card payment created", { id: data.id, status: data.status, status_detail: data.status_detail });

  const threeDS = data.three_ds_info;
  return {
    error: false,
    payment_id: String(data.id),
    status: data.status,
    status_detail: data.status_detail,
    three_ds_info: threeDS?.external_resource_url && threeDS?.creq
      ? { external_resource_url: threeDS.external_resource_url, creq: threeDS.creq }
      : null,
  };
}

interface CardPaymentExtras {
  deviceId: string | null;
  payerFirstName: string | null;
  payerLastName: string | null;
  additionalItems: Array<Record<string, unknown>>;
  restaurantName: string;
  threeDsMode: "optional" | "mandatory";
}

async function createCardPayment(
  accessToken: string,
  token: string,
  amount: number,
  description: string,
  orderId: string,
  installments: number,
  payerEmail: string,
  payerDocNumber: string,
  paymentMethodId: string,
  issuerId: string | null,
  extras: CardPaymentExtras,
): Promise<CardResult> {
  logStep("Creating card payment via Mercado Pago", { amount, orderId, paymentMethodId });

  const payer: Record<string, unknown> = {
    email: payerEmail,
    identification: {
      type: "CPF",
      number: payerDocNumber || "",
    },
  };
  if (extras.payerFirstName) payer.first_name = extras.payerFirstName;
  if (extras.payerLastName) payer.last_name = extras.payerLastName;

  // additional_info enriquece o score antifraude (itens + dados do pagador).
  const additionalInfo: Record<string, unknown> = {};
  if (extras.additionalItems.length > 0) additionalInfo.items = extras.additionalItems;
  if (extras.payerFirstName || extras.payerLastName) {
    additionalInfo.payer = {
      first_name: extras.payerFirstName || undefined,
      last_name: extras.payerLastName || undefined,
    };
  }

  const baseBody: Record<string, unknown> = {
    transaction_amount: amount,
    token,
    description,
    installments: installments || 1,
    payment_method_id: paymentMethodId,
    payer,
    external_reference: orderId,
    statement_descriptor: extras.restaurantName?.slice(0, 22) || undefined,
  };

  if (Object.keys(additionalInfo).length > 0) {
    baseBody.additional_info = additionalInfo;
  }

  if (issuerId) {
    baseBody.issuer_id = issuerId;
  }

  // 3DS 2.0: em "optional" o MP decide quando exigir o desafio do banco; em
  // "mandatory" (configurável por restaurante via restaurants.mp_3ds_mode) todo
  // pagamento passa pela autenticação do emissor — usado contra cc_rejected_high_risk.
  const attempt = async (threeDsMode: "optional" | "mandatory"): Promise<CardResult> => {
    const body = { ...baseBody, three_d_secure_mode: threeDsMode };

    // Try with application_fee first
    const withFeeBody = {
      ...body,
      application_fee: Math.round((0.50 + amount * 0.005) * 100) / 100,
    };

    let result = await createCardPaymentRequest(accessToken, orderId, withFeeBody, extras.deviceId);

    // If application_fee not supported, retry without it. Em "mandatory" o retry sem
    // fee vale para qualquer erro: o MP já devolveu 500 internal_error na combinação
    // mandatory + application_fee, e sem a fee o desafio do banco ainda acontece.
    if (result.error) {
      const lowerBody = result.body.toLowerCase();
      const shouldRetryWithoutFee =
        threeDsMode === "mandatory" ||
        (result.status === 400 &&
          (lowerBody.includes("application_fee") || lowerBody.includes("code\":2059")));

      if (shouldRetryWithoutFee) {
        logStep("Retrying without application_fee", { status: result.status, threeDsMode });
        result = await createCardPaymentRequest(accessToken, orderId, body, extras.deviceId);
      }
    }

    return result;
  };

  let result = await attempt(extras.threeDsMode);

  // Se a criação falhar com "mandatory" (erro HTTP do MP, não recusa de risco),
  // cai para "optional" — a config de 3DS nunca deve bloquear o pagamento.
  if (result.error && extras.threeDsMode === "mandatory") {
    logStep("Mandatory 3DS failed at creation, falling back to optional", {
      status: result.status,
      body: result.body.slice(0, 800),
    });
    result = await attempt("optional");
  }

  return result;
}

async function rollbackFailedCardOrder(supabaseClient: any, orderId: string, restaurantId: string) {
  const { error } = await supabaseClient
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "awaiting_payment")
    .eq("status", "pending");

  if (error) {
    logStep("Failed to rollback order after card error", { orderId, error: error.message });
    return;
  }
  logStep("Order rolled back after card payment failure", { orderId });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  let orderId: string | null = null;
  let restaurantId: string | null = null;
  let paymentCreated = false;
  let supabaseClient: any = null;

  try {
    logStep("Function started");

    const {
      order_id,
      restaurant_id,
      token,
      installments,
      payer_email,
      payer_doc_number,
      payment_method_id,
      issuer_id,
      device_id,
      payer_first_name,
      payer_last_name,
    } = await req.json();

    orderId = order_id;
    restaurantId = restaurant_id;

    if (!orderId || !restaurantId || !token || !payment_method_id) {
      throw new Error("Missing required fields: order_id, restaurant_id, token, payment_method_id");
    }

    supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch restaurant
    const { data: restaurant, error: restError } = await supabaseClient
      .from("restaurants")
      .select("pix_gateway, pix_gateway_token, mp_refresh_token, name, mp_3ds_mode")
      .eq("id", restaurantId)
      .single();

    if (restError || !restaurant) {
      throw new Error("Restaurante não encontrado");
    }

    if (restaurant.pix_gateway !== "mercadopago" || !restaurant.pix_gateway_token) {
      throw new Error("Mercado Pago não configurado. Conecte sua conta nas configurações.");
    }

    // Fetch order
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("total, order_number, daily_number, items")
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .single();

    if (orderError || !order) {
      throw new Error("Pedido não encontrado");
    }

    const description = `Pedido #${order.daily_number || order.order_number} - ${restaurant.name}`;

    // Monta os itens para additional_info (sinal antifraude do Mercado Pago).
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const additionalItems = orderItems.map((it: any, idx: number) => ({
      id: String(it.productId || idx),
      title: String(it.name || "Item"),
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.price ?? 0) + Number(it.addonsTotal ?? 0),
      category_id: "food",
    }));

    const extras: CardPaymentExtras = {
      deviceId: device_id || null,
      payerFirstName: payer_first_name || null,
      payerLastName: payer_last_name || null,
      additionalItems,
      restaurantName: restaurant.name,
      threeDsMode: restaurant.mp_3ds_mode === "mandatory" ? "mandatory" : "optional",
    };

    let result = await createCardPayment(
      restaurant.pix_gateway_token,
      token,
      order.total,
      description,
      orderId,
      installments || 1,
      payer_email || `pedido-${orderId}@menufly.app`,
      payer_doc_number || "",
      payment_method_id,
      issuer_id || null,
      extras,
    );

    // If 401, try refreshing token
    if (result.error && result.status === 401 && restaurant.mp_refresh_token) {
      logStep("Token expired, attempting refresh");
      const newToken = await refreshMPToken(supabaseClient, restaurantId, restaurant.mp_refresh_token);
      if (newToken) {
        result = await createCardPayment(
          newToken, token, order.total, description, orderId,
          installments || 1, payer_email || `pedido-${orderId}@menufly.app`,
          payer_doc_number || "",
          payment_method_id, issuer_id || null, extras,
        );
      }
    }

    if (result.error) {
      throw new Error("Não foi possível processar o pagamento com cartão. Tente novamente ou escolha outro método.");
    }

    paymentCreated = true;

    // Update order based on payment status
    const paymentResult = result as { payment_id: string; status: string; status_detail: string; three_ds_info: ThreeDSInfo | null };

    // Desafio 3DS: o pagamento fica pendente até o cliente autenticar no banco.
    // O pedido permanece awaiting_payment e o frontend renderiza o desafio e faz
    // polling via check-card-status.
    if (paymentResult.status === "pending" && paymentResult.status_detail === "pending_challenge" && paymentResult.three_ds_info) {
      await supabaseClient
        .from("orders")
        .update({
          payment_status: "awaiting_payment",
          payment_method: "card",
          status: "pending",
        })
        .eq("id", orderId);

      logStep("3DS challenge required", { payment_id: paymentResult.payment_id });

      return new Response(JSON.stringify({
        success: true,
        payment_id: paymentResult.payment_id,
        status: "pending_challenge",
        status_detail: paymentResult.status_detail,
        three_ds: paymentResult.three_ds_info,
      }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let orderPaymentStatus = "awaiting_payment";
    let orderStatus = "pending";

    if (paymentResult.status === "approved") {
      orderPaymentStatus = "paid";
      orderStatus = "pending";
    } else if (paymentResult.status === "rejected") {
      orderPaymentStatus = "failed";
      orderStatus = "cancelled";
    } else if (paymentResult.status === "in_process") {
      orderPaymentStatus = "awaiting_payment";
    }

    // Always update payment_method to 'card' (order may have been created with 'pix' as a hack)
    await supabaseClient
      .from("orders")
      .update({
        payment_status: orderPaymentStatus,
        payment_method: "card",
        status: orderStatus,
      })
      .eq("id", orderId);

    logStep("Payment processed", { payment_id: paymentResult.payment_id, status: paymentResult.status });

    return new Response(JSON.stringify({
      success: true,
      payment_id: paymentResult.payment_id,
      status: paymentResult.status,
      status_detail: paymentResult.status_detail,
    }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Rollback order if payment was not created
    if (!paymentCreated && supabaseClient && orderId && restaurantId) {
      await rollbackFailedCardOrder(supabaseClient, orderId, restaurantId);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
