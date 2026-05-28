import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, restaurant_id } = await req.json();

    if (!payment_id || !restaurant_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: "Not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });

    const payment = await mpResponse.json();

    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: "Failed to check payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "approved") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let refData: any;
      try {
        refData = JSON.parse(payment.external_reference);
      } catch {
        refData = null;
      }

      if (refData?.type === "ai_credits" && refData.restaurantId === restaurant_id) {
        const credits = refData.credits;

        // Idempotency check
        const { data: existingTx } = await supabase
          .from("ai_credit_transactions")
          .select("id")
          .eq("restaurant_id", restaurant_id)
          .eq("type", "purchase")
          .eq("description", `mp_payment_${payment_id}`)
          .maybeSingle();

        if (!existingTx) {
          const { data: existing } = await supabase
            .from("ai_credits")
            .select("balance, total_purchased")
            .eq("restaurant_id", restaurant_id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("ai_credits")
              .update({
                balance: existing.balance + credits,
                total_purchased: existing.total_purchased + credits,
                updated_at: new Date().toISOString(),
              })
              .eq("restaurant_id", restaurant_id);
          } else {
            await supabase
              .from("ai_credits")
              .insert({
                restaurant_id,
                balance: credits,
                total_purchased: credits,
              });
          }

          await supabase
            .from("ai_credit_transactions")
            .insert({
              restaurant_id,
              amount: credits,
              type: "purchase",
              description: `mp_payment_${payment_id}`,
            });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: payment.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
