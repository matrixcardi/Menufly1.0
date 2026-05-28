import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GENERATE-PIX] ${step}${detailsStr}`);
};

type PixResult =
  | {
      error: false;
      qr_code: string | null;
      qr_code_base64: string | null;
      payment_id: string;
      expiration: string | null;
    }
  | {
      error: true;
      status: number;
      body: string;
    };

async function refreshMPToken(supabaseClient: any, restaurantId: string, refreshToken: string): Promise<string | null> {
  const appId = Deno.env.get("MP_APP_ID");
  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");

  if (!appId || !clientSecret || !refreshToken) {
    logStep("Cannot refresh: missing credentials");
    return null;
  }

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
    logStep("Token refresh failed", { status: res.status, error: data });
    return null;
  }

  await supabaseClient
    .from("restaurants")
    .update({
      pix_gateway_token: data.access_token,
      mp_refresh_token: data.refresh_token,
    })
    .eq("id", restaurantId);

  logStep("Token refreshed successfully");
  return data.access_token;
}

async function createPixPayment(accessToken: string, orderId: string, body: Record<string, unknown>): Promise<PixResult> {
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": orderId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.text();
    logStep("Mercado Pago error", { status: response.status, body: errorData });
    return { error: true, status: response.status, body: errorData };
  }

  const data = await response.json();
  const pixInfo = data.point_of_interaction?.transaction_data;

  logStep("Mercado Pago payment created", { paymentId: data.id });

  return {
    error: false,
    qr_code: pixInfo?.qr_code || null,
    qr_code_base64: pixInfo?.qr_code_base64 || null,
    payment_id: String(data.id),
    expiration: data.date_of_expiration || null,
  };
}

async function generatePixMercadoPago(accessToken: string, amount: number, description: string, orderId: string): Promise<PixResult> {
  logStep("Generating PIX via Mercado Pago", { amount, orderId });

  const baseBody = {
    transaction_amount: amount,
    description,
    payment_method_id: "pix",
    external_reference: orderId,
    payer: {
      email: `pedido-${orderId}@menufly.app`,
    },
  };

  const withFeeBody = {
    ...baseBody,
    application_fee: 1.0,
  };

  let pixResult = await createPixPayment(accessToken, orderId, withFeeBody);

  if (pixResult.error) {
    const lowerBody = pixResult.body.toLowerCase();
    const shouldRetryWithoutFee =
      pixResult.status === 400 &&
      (lowerBody.includes("application_fee") || lowerBody.includes("code\":2059"));

    if (shouldRetryWithoutFee) {
      logStep("application_fee not supported for this account, retrying without fee");
      pixResult = await createPixPayment(accessToken, orderId, baseBody);
    }
  }

  return pixResult;
}

async function rollbackFailedPixOrder(supabaseClient: any, orderId: string, restaurantId: string) {
  const { error } = await supabaseClient
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("payment_method", "pix")
    .eq("payment_status", "awaiting_payment")
    .eq("status", "pending");

  if (error) {
    logStep("Failed to rollback order after PIX error", { orderId, error: error.message });
    return;
  }

  logStep("Order rolled back after PIX generation failure", { orderId });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  let orderId: string | null = null;
  let restaurantId: string | null = null;
  let pixCreated = false;
  let supabaseClient: any = null;

  try {
    logStep("Function started");

    const { order_id, restaurant_id } = await req.json();
    orderId = order_id;
    restaurantId = restaurant_id;

    if (!orderId || !restaurantId) {
      throw new Error("order_id and restaurant_id are required");
    }

    supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: restaurant, error: restError } = await supabaseClient
      .from("restaurants")
      .select("pix_gateway, pix_gateway_token, mp_refresh_token, name")
      .eq("id", restaurantId)
      .single();

    if (restError || !restaurant) {
      throw new Error("Restaurante não encontrado");
    }

    if (restaurant.pix_gateway !== "mercadopago" || !restaurant.pix_gateway_token) {
      throw new Error("PIX não configurado. Conecte sua conta do Mercado Pago nas configurações.");
    }

    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("total, order_number, daily_number")
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .single();

    if (orderError || !order) {
      throw new Error("Pedido não encontrado");
    }

    const description = `Pedido #${order.daily_number || order.order_number} - ${restaurant.name}`;

    let pixResult = await generatePixMercadoPago(restaurant.pix_gateway_token, order.total, description, orderId);

    if (pixResult.error && pixResult.status === 401 && restaurant.mp_refresh_token) {
      logStep("Token expired, attempting refresh");
      const newToken = await refreshMPToken(supabaseClient, restaurantId, restaurant.mp_refresh_token);

      if (newToken) {
        pixResult = await generatePixMercadoPago(newToken, order.total, description, orderId);
      }
    }

    if (pixResult.error) {
      throw new Error("Não foi possível gerar o PIX no momento. Refaça o pedido e selecione pagamento na entrega.");
    }

    pixCreated = true;

    await supabaseClient.from("orders").update({ payment_status: "awaiting_payment" }).eq("id", orderId);

    logStep("PIX generated successfully", { payment_id: pixResult.payment_id });

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: pixResult.qr_code,
        qr_code_base64: pixResult.qr_code_base64,
        payment_id: pixResult.payment_id,
        expiration: pixResult.expiration,
      }),
      {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (!pixCreated && supabaseClient && orderId && restaurantId) {
      await rollbackFailedPixOrder(supabaseClient, orderId, restaurantId);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage, orderId, restaurantId });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
