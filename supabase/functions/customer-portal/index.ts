import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

/**
 * Portal de cobrança do Stripe — exclusivo da base legada.
 *
 * Clientes novos assinam pela HyperCash e gerenciam a assinatura dentro do
 * próprio painel (/admin/assinatura), sem portal externo. Esta função só faz
 * sentido para quem já era cobrado pelo Stripe antes da troca de gateway;
 * nenhuma assinatura Stripe nova é criada.
 */
serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY is not set");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Authentication error: empty bearer token");

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Caminho rápido: o id gravado pelo sync. Só cai no lookup por e-mail
    // enquanto o sync ainda não passou por esta conta.
    const { data: sub } = await supabase
      .from("platform_subscriptions")
      .select("stripe_customer_id, gateway")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id ?? null;

    if (!customerId) {
      logStep("No stored customer id, falling back to email lookup");
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;

      if (customerId) {
        // Aproveita a descoberta para não repetir o lookup na próxima vez.
        await supabase
          .from("platform_subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id);
      }
    }

    if (!customerId) {
      logStep("No Stripe customer for user", { userId: user.id });
      return new Response(
        JSON.stringify({
          error: "no_subscription",
          message: "Você não possui assinatura no cartão antigo. Assine um plano para gerenciá-lo.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    const returnUrl = origin || "https://menufly.com.br";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${returnUrl}/admin/assinatura`,
    });
    logStep("Customer portal session created", { customerId });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
