import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { publicCorsHeaders } from "../_shared/cors.ts";

const ASAAS_API_URL = "https://api.asaas.com/v3";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ASAAS-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  try {
    logStep("Function started");

    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasKey) throw new Error("ASAAS_API_KEY is not set");
    logStep("Asaas key verified");

    // Parse optional email from body
    let email: string | undefined;
    try {
      const body = await req.json();
      email = body?.email;
    } catch {
      // no body
    }

    const origin = req.headers.get("origin") || "https://menufly.com.br";

    // Create a payment link for recurring subscription
    const paymentLinkResponse = await fetch(`${ASAAS_API_URL}/paymentLinks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasKey,
      },
      body: JSON.stringify({
        name: "MenuFly Pro - Assinatura Mensal",
        description: "Plano completo MenuFly Pro com cardápio digital, pedidos ilimitados, integração WhatsApp e muito mais.",
        value: 97.00,
        billingType: "UNDEFINED", // Allows PIX + Credit Card
        chargeType: "RECURRENT",
        subscriptionCycle: "MONTHLY",
        notificationEnabled: true,
        callback: {
          successUrl: `${origin}/checkout/sucesso`,
          cancelUrl: `${origin}/checkout/cancelado`,
          autoRedirect: true,
        },
      }),
    });

    if (!paymentLinkResponse.ok) {
      const errorData = await paymentLinkResponse.text();
      logStep("Asaas error", { status: paymentLinkResponse.status, body: errorData });
      throw new Error(`Asaas API error: ${paymentLinkResponse.status} - ${errorData}`);
    }

    const paymentLink = await paymentLinkResponse.json();
    logStep("Payment link created", { id: paymentLink.id, url: paymentLink.url });

    return new Response(JSON.stringify({ 
      url: paymentLink.url,
      id: paymentLink.id,
    }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
