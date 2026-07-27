import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { restaurantId, packageType, userId } = await req.json();

    if (!restaurantId || !packageType || !userId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate package
    const packages: Record<string, { credits: number; price: number }> = {
      "1000": { credits: 1000, price: 19.90 },
      "3000": { credits: 3000, price: 49.90 },
      "5000": { credits: 5000, price: 79.90 },
    };

    const pkg = packages[packageType];
    if (!pkg) {
      return new Response(JSON.stringify({ error: "Invalid package" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify restaurant ownership
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, user_id")
      .eq("id", restaurantId)
      .maybeSingle();

    if (!restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get master MP access token for payment processing
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Payment not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Mercado Pago preference for the credits package
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [{
          title: `${pkg.credits} Mensagens WhatsApp - MenuFly`,
          quantity: 1,
          unit_price: pkg.price,
          currency_id: "BRL",
        }],
        back_urls: {
          success: `${req.headers.get("origin") || "https://menufly.com.br"}/admin/campanhas?credits_purchased=${pkg.credits}`,
          failure: `${req.headers.get("origin") || "https://menufly.com.br"}/admin/campanhas?credits_error=true`,
        },
        auto_return: "approved",
        external_reference: JSON.stringify({
          type: "whatsapp_credits",
          restaurantId,
          credits: pkg.credits,
          userId,
        }),
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-whatsapp-credits`,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP error:", mpData);
      return new Response(JSON.stringify({ error: "Payment creation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
