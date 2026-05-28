import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-MP-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  try {
    const body = await req.json();
    const { plan, payer_email, payment_method, card_token, installments } = body;
    logStep("Request received", { plan, payer_email, payment_method });

    if (!plan || !payer_email) {
      throw new Error("plan and payer_email are required");
    }

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MP_ACCESS_TOKEN not configured");

    // Plan pricing
    const planConfig: Record<string, { title: string; price: number }> = {
      start: { title: "MenuFly Start", price: 97 },
      elite: { title: "MenuFly Elite", price: 160 },
    };

    const selectedPlan = planConfig[plan];
    if (!selectedPlan) throw new Error("Invalid plan");

    const method = payment_method || "pix";

    if (method === "pix") {
      // Create PIX payment directly
      const paymentBody: any = {
        transaction_amount: selectedPlan.price,
        description: `${selectedPlan.title} - Assinatura Mensal`,
        payment_method_id: "pix",
        payer: {
          email: payer_email,
        },
        statement_descriptor: "MENUFLY",
        external_reference: `subscription_${plan}_${Date.now()}`,
      };

      logStep("Creating PIX payment", paymentBody);

      const paymentRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Idempotency-Key": `sub_pix_${plan}_${Date.now()}`,
        },
        body: JSON.stringify(paymentBody),
      });

      if (!paymentRes.ok) {
        const errorText = await paymentRes.text();
        logStep("MP PIX error", { status: paymentRes.status, body: errorText });
        throw new Error(`Mercado Pago error: ${paymentRes.status}`);
      }

      const payment = await paymentRes.json();
      logStep("PIX payment created", { id: payment.id, status: payment.status });

      const pixData = payment.point_of_interaction?.transaction_data;

      return new Response(JSON.stringify({
        success: true,
        payment_id: payment.id,
        status: payment.status,
        qr_code: pixData?.qr_code,
        qr_code_base64: pixData?.qr_code_base64,
        ticket_url: pixData?.ticket_url,
      }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      });

    } else if (method === "card") {
      // Process card payment with token
      if (!card_token) throw new Error("card_token is required for card payments");

      const paymentBody: any = {
        transaction_amount: selectedPlan.price,
        description: `${selectedPlan.title} - Assinatura Mensal`,
        payment_method_id: body.payment_method_id || "visa",
        token: card_token,
        installments: installments || 1,
        payer: {
          email: payer_email,
        },
        statement_descriptor: "MENUFLY",
        external_reference: `subscription_${plan}_${Date.now()}`,
      };

      if (body.issuer_id) {
        paymentBody.issuer_id = parseInt(body.issuer_id);
      }

      logStep("Creating card payment", { ...paymentBody, token: "[REDACTED]" });

      const paymentRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Idempotency-Key": `sub_card_${plan}_${Date.now()}`,
        },
        body: JSON.stringify(paymentBody),
      });

      if (!paymentRes.ok) {
        const errorText = await paymentRes.text();
        logStep("MP Card error", { status: paymentRes.status, body: errorText });
        throw new Error(`Mercado Pago error: ${paymentRes.status}`);
      }

      const payment = await paymentRes.json();
      logStep("Card payment created", { id: payment.id, status: payment.status, detail: payment.status_detail });

      return new Response(JSON.stringify({
        success: true,
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
      }), {
        headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error("Invalid payment_method. Use 'pix' or 'card'.");
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
