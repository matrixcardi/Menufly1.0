import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REFUND-PAYMENT] ${step}${detailsStr}`);
};

async function refreshMPToken(supabaseClient: any, restaurantId: string, refreshToken: string): Promise<string | null> {
  const appId = Deno.env.get("MP_APP_ID");
  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
  if (!appId || !clientSecret || !refreshToken) return null;

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
  if (!res.ok || !data.access_token) return null;

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

async function findPaymentByOrderId(accessToken: string, orderId: string): Promise<string | null> {
  const findFromResponse = async (url: string): Promise<string | null> => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      logStep("Payment search failed", { status: res.status, url });
      return null;
    }

    const data = await res.json();
    const approved = data.results?.find((p: any) => p.status === "approved");
    if (approved) return String(approved.id);
    if (data.results?.length > 0) return String(data.results[0].id);
    return null;
  };

  // Primary lookup: payments created with external_reference = order_id
  const byExternalRef = await findFromResponse(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${orderId}&sort=date_created&criteria=desc`
  );
  if (byExternalRef) return byExternalRef;

  // Fallback for older PIX payments created without external_reference
  const payerEmail = encodeURIComponent(`pedido-${orderId}@menufly.app`);
  return await findFromResponse(
    `https://api.mercadopago.com/v1/payments/search?payer.email=${payerEmail}&sort=date_created&criteria=desc`
  );
}

async function refundPayment(accessToken: string, paymentId: string): Promise<{ success: boolean; error?: string }> {
  logStep("Requesting full refund", { paymentId });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `refund-${paymentId}-${Date.now()}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    logStep("Refund failed", { status: res.status, body: errorText });
    return { success: false, error: `Refund failed: ${res.status}` };
  }

  const data = await res.json();
  logStep("Refund successful", { refundId: data.id, status: data.status });
  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  try {
    logStep("Function started");

    const { order_id, restaurant_id } = await req.json();

    if (!order_id || !restaurant_id) {
      throw new Error("order_id and restaurant_id are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch order to verify it's a paid online order
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("id, payment_method, payment_status, total")
      .eq("id", order_id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (orderError || !order) {
      throw new Error("Pedido não encontrado");
    }

    // Only refund paid online orders (pix or card with status "paid")
    if (order.payment_status !== "paid") {
      logStep("Order not paid, skipping refund", { payment_status: order.payment_status });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "not_paid" }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pix", "card"].includes(order.payment_method)) {
      logStep("Not an online payment, skipping refund", { payment_method: order.payment_method });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "not_online" }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch restaurant MP credentials
    const { data: restaurant, error: restError } = await supabaseClient
      .from("restaurants")
      .select("pix_gateway, pix_gateway_token, mp_refresh_token")
      .eq("id", restaurant_id)
      .single();

    if (restError || !restaurant || !restaurant.pix_gateway_token) {
      throw new Error("Credenciais do Mercado Pago não encontradas");
    }

    let accessToken = restaurant.pix_gateway_token;

    // Find the payment ID via external_reference
    let paymentId = await findPaymentByOrderId(accessToken, order_id);

    // If not found, try refreshing token
    if (!paymentId && restaurant.mp_refresh_token) {
      const newToken = await refreshMPToken(supabaseClient, restaurant_id, restaurant.mp_refresh_token);
      if (newToken) {
        accessToken = newToken;
        paymentId = await findPaymentByOrderId(accessToken, order_id);
      }
    }

    if (!paymentId) {
      logStep("No payment found for order, skipping refund");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_payment_found" }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process refund
    let result = await refundPayment(accessToken, paymentId);

    // If 401, refresh token and retry
    if (!result.success && restaurant.mp_refresh_token) {
      const newToken = await refreshMPToken(supabaseClient, restaurant_id, restaurant.mp_refresh_token);
      if (newToken) {
        result = await refundPayment(newToken, paymentId);
      }
    }

    if (!result.success) {
      throw new Error("Não foi possível processar o estorno. Verifique manualmente no Mercado Pago.");
    }

    // Update order payment_status to refunded
    await supabaseClient
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", order_id);

    logStep("Refund completed successfully", { order_id, paymentId });

    return new Response(JSON.stringify({ success: true, payment_id: paymentId }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
