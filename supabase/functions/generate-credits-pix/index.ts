import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GENERATE-CREDITS-PIX] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurantId, packageType, userId } = await req.json();

    if (!restaurantId || !packageType || !userId) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const packages: Record<string, { credits: number; price: number }> = {
      "1000": { credits: 1000, price: 19.90 },
      "3000": { credits: 3000, price: 49.90 },
      "5000": { credits: 5000, price: 79.90 },
    };

    const pkg = packages[packageType];
    if (!pkg) {
      return new Response(JSON.stringify({ success: false, error: "Invalid package" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: "Payment not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idempotencyKey = `credits-${restaurantId}-${packageType}-${Date.now()}`;

    logStep("Creating PIX payment", { credits: pkg.credits, price: pkg.price });

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: pkg.price,
        description: `${pkg.credits} Mensagens WhatsApp - MenuFly`,
        payment_method_id: "pix",
        payer: {
          email: `credits-${restaurantId}@menufly.app`,
        },
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
      logStep("MP PIX error", { status: mpResponse.status, error: mpData });
      return new Response(JSON.stringify({ success: false, error: "Erro ao gerar PIX" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    logStep("PIX created successfully", { paymentId: mpData.id });

    return new Response(JSON.stringify({
      success: true,
      payment_id: String(mpData.id),
      qr_code: pixInfo?.qr_code || null,
      qr_code_base64: pixInfo?.qr_code_base64 || null,
      expiration: mpData.date_of_expiration || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
