import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GENERATE-AI-CREDITS-PIX] ${step}${detailsStr}`);
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
      "10": { credits: 10, price: 9.90 },
      "30": { credits: 30, price: 24.90 },
      "100": { credits: 100, price: 69.90 },
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

    const idempotencyKey = `ai-credits-${restaurantId}-${packageType}-${Date.now()}`;

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
        description: `${pkg.credits} Créditos IA - MenuFly`,
        payment_method_id: "pix",
        payer: {
          email: `ai-credits-${restaurantId}@menufly.app`,
        },
        external_reference: JSON.stringify({
          type: "ai_credits",
          restaurantId,
          credits: pkg.credits,
          userId,
        }),
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-ai-credits`,
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
