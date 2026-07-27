import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Stripe price IDs for each plan
const PLAN_PRICES: Record<string, string> = {
  start: "price_1TEX5kDct1iEI7GEVq3sBOvF",
  elite: "price_1TEX67Dct1iEI7GEEVAW610Q",
};

// One-time implementation service price
const IMPLEMENTATION_PRICE_ID = "price_1TFP9fDct1iEI7GEUHcgawEZ";

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const publishableKey = Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY");
    if (!publishableKey) throw new Error("VITE_STRIPE_PUBLISHABLE_KEY is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body = await req.json();
    const { plan, includeImplementation } = body;
    const priceId = PLAN_PRICES[plan];
    if (!priceId) throw new Error("Invalid plan. Use 'start' or 'elite'.");
    logStep("Plan selected", { plan, priceId, includeImplementation });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const returnOrigin = origin || "https://menufly.com.br";

    const lineItems: any[] = [{ price: priceId, quantity: 1 }];
    if (includeImplementation) {
      lineItems.push({ price: IMPLEMENTATION_PRICE_ID, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${returnOrigin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      locale: "pt-BR",
      allow_promotion_codes: true,
      payment_method_types: ["card"],
      metadata: {
        user_id: user.id,
        plan,
      },
    });

    logStep("Embedded checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ 
      clientSecret: session.client_secret,
      publishableKey,
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
