import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PIX-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Plan pricing (BRL)
const PLAN_PRICES: Record<string, { monthly: number; name: string }> = {
  start: { monthly: 97, name: "MenuFly Start — Mensal" },
  elite: { monthly: 160, name: "MenuFly Elite — Mensal" },
};

const IMPLEMENTATION_AMOUNT = 399.90;

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body = await req.json();
    const { plan, includeImplementation } = body;
    const planData = PLAN_PRICES[plan];
    if (!planData) throw new Error("Invalid plan. Use 'start' or 'elite'.");
    logStep("Plan selected", { plan, includeImplementation });

    const totalAmount = Number(
      (planData.monthly + (includeImplementation ? IMPLEMENTATION_AMOUNT : 0)).toFixed(2)
    );
    const description = includeImplementation
      ? `${planData.name} + Implementação`
      : planData.name;

    const externalRef = `subscription_${plan}_${user.id}_${Date.now()}`;
    const paymentBody = {
      transaction_amount: totalAmount,
      description,
      payment_method_id: "pix",
      payer: { email: user.email },
      statement_descriptor: "MENUFLY",
      external_reference: externalRef,
      metadata: {
        user_id: user.id,
        plan,
        include_implementation: includeImplementation ? "1" : "0",
      },
    };

    logStep("Creating MP PIX payment", { totalAmount, plan });

    const paymentRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": externalRef,
      },
      body: JSON.stringify(paymentBody),
    });

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      logStep("MP PIX error", { status: paymentRes.status, body: errorText });
      throw new Error(`Mercado Pago error: ${paymentRes.status} - ${errorText}`);
    }

    const payment = await paymentRes.json();
    const pixData = payment.point_of_interaction?.transaction_data;
    logStep("PIX payment created", { id: payment.id, status: payment.status });

    return new Response(JSON.stringify({
      success: true,
      payment_id: payment.id,
      status: payment.status,
      qr_code: pixData?.qr_code,
      qr_code_base64: pixData?.qr_code_base64,
      ticket_url: pixData?.ticket_url,
      amount: totalAmount,
      plan,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
