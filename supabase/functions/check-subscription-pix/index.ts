import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { publicCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION-PIX] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  try {
    const { payment_id } = await req.json();
    if (!payment_id) throw new Error("payment_id is required");

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MP_ACCESS_TOKEN not configured");

    logStep("Checking payment status", { payment_id });

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`MP API error: ${res.status}`);
    }

    const payment = await res.json();
    logStep("Payment status", { id: payment.id, status: payment.status });

    return new Response(JSON.stringify({
      status: payment.status,
      status_detail: payment.status_detail,
    }), {
      headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
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
