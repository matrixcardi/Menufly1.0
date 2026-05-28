import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PIX-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const body = await req.json();
    const { payment_id } = body;
    if (!payment_id) throw new Error("payment_id is required");

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`MP API error: ${res.status}`);
    const payment = await res.json();
    logStep("MP payment status", { id: payment.id, status: payment.status });

    // Verify the payment belongs to this user
    const metaUserId = payment.metadata?.user_id;
    if (metaUserId && metaUserId !== user.id) {
      throw new Error("Payment does not belong to this user");
    }

    if (payment.status !== "approved") {
      return new Response(JSON.stringify({
        verified: false,
        status: payment.status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const plan = payment.metadata?.plan || "start";
    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        subscription_plan: plan,
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      logStep("Error updating profile", { error: updateError.message });
      throw new Error("Failed to activate subscription");
    }

    logStep("Subscription activated via PIX", { plan, userId: user.id });

    return new Response(JSON.stringify({
      verified: true,
      status: "approved",
      plan,
      subscription_end: subscriptionEnd.toISOString(),
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
