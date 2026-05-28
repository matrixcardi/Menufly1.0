import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-PIX-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  try {
    const { order_id, payment_id, restaurant_id } = await req.json();

    if (!order_id || !payment_id || !restaurant_id) {
      throw new Error("order_id, payment_id and restaurant_id are required");
    }

    logStep("Checking payment status", { order_id, payment_id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch restaurant token
    const { data: restaurant, error: restError } = await supabaseClient
      .from("restaurants")
      .select("pix_gateway_token, mp_refresh_token")
      .eq("id", restaurant_id)
      .single();

    if (restError || !restaurant) {
      throw new Error("Restaurante não encontrado");
    }

    if (!restaurant.pix_gateway_token) {
      throw new Error("Token não configurado");
    }

    // Check payment status on Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${restaurant.pix_gateway_token}`,
      },
    });

    if (!response.ok) {
      // If 401, try refresh
      if (response.status === 401 && restaurant.mp_refresh_token) {
        const appId = Deno.env.get("MP_APP_ID");
        const clientSecret = Deno.env.get("MP_CLIENT_SECRET");

        if (appId && clientSecret) {
          const refreshRes = await fetch("https://api.mercadopago.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_secret: clientSecret,
              client_id: appId,
              grant_type: "refresh_token",
              refresh_token: restaurant.mp_refresh_token,
            }),
          });

          const refreshData = await refreshRes.json();
          if (refreshRes.ok && refreshData.access_token) {
            await supabaseClient
              .from("restaurants")
              .update({
                pix_gateway_token: refreshData.access_token,
                mp_refresh_token: refreshData.refresh_token,
              })
              .eq("id", restaurant_id);

            // Retry with new token
            const retryRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
              method: "GET",
              headers: { "Authorization": `Bearer ${refreshData.access_token}` },
            });

            if (!retryRes.ok) {
              throw new Error("Erro ao verificar pagamento após refresh");
            }

            const retryData = await retryRes.json();
            const status = retryData.status;
            logStep("Payment status after refresh", { status });

            if (status === "approved") {
              await supabaseClient.rpc("confirm_pix_payment", { p_order_id: order_id });
              logStep("Payment confirmed via DB function");
            }

            return new Response(JSON.stringify({ success: true, status }), {
              headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      throw new Error(`Erro ao consultar pagamento: ${response.status}`);
    }

    const paymentData = await response.json();
    const status = paymentData.status;
    logStep("Payment status", { status, mp_status_detail: paymentData.status_detail });

    // If approved, confirm payment in DB
    if (status === "approved") {
      await supabaseClient.rpc("confirm_pix_payment", { p_order_id: order_id });
      logStep("Payment confirmed via DB function");
    }

    return new Response(JSON.stringify({ success: true, status }), {
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
