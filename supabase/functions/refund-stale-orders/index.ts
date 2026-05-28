import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REFUND-STALE] ${step}${detailsStr}`);
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

  return data.access_token;
}

async function findPaymentByOrderId(accessToken: string, orderId: string): Promise<string | null> {
  const findFromResponse = async (url: string): Promise<string | null> => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) return null;

    const data = await res.json();
    const approved = data.results?.find((p: any) => p.status === "approved");
    if (approved) return String(approved.id);
    if (data.results?.length > 0) return String(data.results[0].id);
    return null;
  };

  const byExternalRef = await findFromResponse(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${orderId}&sort=date_created&criteria=desc`
  );
  if (byExternalRef) return byExternalRef;

  const payerEmail = encodeURIComponent(`pedido-${orderId}@menufly.app`);
  return await findFromResponse(
    `https://api.mercadopago.com/v1/payments/search?payer.email=${payerEmail}&sort=date_created&criteria=desc`
  );
}

async function refundPayment(accessToken: string, paymentId: string): Promise<boolean> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `refund-stale-${paymentId}-${Date.now()}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    logStep("Refund failed", { paymentId, status: res.status, body: errorText });
    return false;
  }

  await res.json();
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  try {
    logStep("Cron started — checking for stale cancelled orders needing refund");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find orders that were cancelled (by timeout or other) in the last 2 hours,
    // that were paid online but haven't been refunded yet
    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select("id, restaurant_id, payment_method, payment_status, total, cancellation_reason")
      .eq("status", "cancelled")
      .eq("payment_status", "paid")
      .in("payment_method", ["pix", "card"])
      .gte("updated_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .limit(20);

    if (error) {
      throw new Error(`Query error: ${error.message}`);
    }

    if (!orders || orders.length === 0) {
      logStep("No stale paid-cancelled orders found");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep(`Found ${orders.length} orders to refund`);

    // Group by restaurant to reuse tokens
    const byRestaurant = new Map<string, typeof orders>();
    for (const order of orders) {
      const list = byRestaurant.get(order.restaurant_id) || [];
      list.push(order);
      byRestaurant.set(order.restaurant_id, list);
    }

    let refunded = 0;
    let failed = 0;

    for (const [restaurantId, restaurantOrders] of byRestaurant) {
      const { data: restaurant } = await supabaseClient
        .from("restaurants")
        .select("pix_gateway_token, mp_refresh_token")
        .eq("id", restaurantId)
        .single();

      if (!restaurant?.pix_gateway_token) {
        logStep("No MP token for restaurant, skipping", { restaurantId });
        failed += restaurantOrders.length;
        continue;
      }

      let accessToken = restaurant.pix_gateway_token;

      for (const order of restaurantOrders) {
        let paymentId = await findPaymentByOrderId(accessToken, order.id);

        // Try refresh if not found
        if (!paymentId && restaurant.mp_refresh_token) {
          const newToken = await refreshMPToken(supabaseClient, restaurantId, restaurant.mp_refresh_token);
          if (newToken) {
            accessToken = newToken;
            paymentId = await findPaymentByOrderId(accessToken, order.id);
          }
        }

        if (!paymentId) {
          logStep("No payment found for order", { orderId: order.id });
          failed++;
          continue;
        }

        let success = await refundPayment(accessToken, paymentId);

        // Retry with refreshed token on failure
        if (!success && restaurant.mp_refresh_token) {
          const newToken = await refreshMPToken(supabaseClient, restaurantId, restaurant.mp_refresh_token);
          if (newToken) {
            accessToken = newToken;
            success = await refundPayment(accessToken, paymentId);
          }
        }

        if (success) {
          await supabaseClient
            .from("orders")
            .update({ payment_status: "refunded" })
            .eq("id", order.id);
          logStep("Refunded order", { orderId: order.id, paymentId });
          refunded++;
        } else {
          failed++;
        }
      }
    }

    logStep("Cron completed", { refunded, failed });

    return new Response(JSON.stringify({ success: true, refunded, failed }), {
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
