import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, order_total, customer_name, delivery_type, daily_number } = await req.json();

    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all device tokens for this restaurant's owner and collaborators
    const { data: tokens, error: tokensError } = await supabase.rpc(
      "get_device_tokens_for_restaurant",
      { _restaurant_id: restaurant_id }
    );

    if (tokensError) {
      console.error("Error fetching tokens:", tokensError);
      return new Response(JSON.stringify({ error: "Failed to fetch tokens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No devices registered", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get FCM server key from secrets
    const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");
    if (!FCM_SERVER_KEY) {
      console.error("FCM_SERVER_KEY not configured");
      return new Response(JSON.stringify({ error: "Push notifications not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(order_total || 0);

    const deliveryLabel = delivery_type === "pickup" ? "Retirada" : "Delivery";
    const orderLabel = daily_number ? `#${daily_number}` : "";

    const title = `💰 Nova Venda! ${totalFormatted}`;
    const body = `${customer_name || "Cliente"} • ${deliveryLabel} ${orderLabel}`;

    let sentCount = 0;
    const errors: string[] = [];

    // Send to each device via FCM HTTP v1 (legacy)
    for (const { token } of tokens) {
      try {
        const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${FCM_SERVER_KEY}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title,
              body,
              sound: "venda",
              icon: "ic_notification",
              color: "#FF6B00",
              click_action: "OPEN_ORDERS",
              tag: "new-order",
            },
            data: {
              type: "new_order",
              restaurant_id,
              order_total: String(order_total || 0),
              customer_name: customer_name || "",
              daily_number: String(daily_number || ""),
            },
            priority: "high",
          }),
        });

        const result = await fcmResponse.json();
        if (result.success === 1) {
          sentCount++;
        } else {
          errors.push(`Token failed: ${JSON.stringify(result.results)}`);
          // Remove invalid tokens
          if (result.results?.[0]?.error === "NotRegistered" || result.results?.[0]?.error === "InvalidRegistration") {
            await supabase.from("device_tokens").delete().eq("token", token);
          }
        }
      } catch (e) {
        errors.push(`Send error: ${e.message}`);
      }
    }

    console.log(`Push sent: ${sentCount}/${tokens.length}`, errors.length ? errors : "");

    return new Response(
      JSON.stringify({ sent: sentCount, total: tokens.length, errors: errors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
