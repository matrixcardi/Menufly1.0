import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { publicCorsHeaders } from "../_shared/cors.ts";

// Checkout endpoints use public CORS to support embedding from various domains

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: publicCorsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Parse request body for email (optional)
    let requestEmail: string | undefined;
    try {
      const body = await req.json();
      requestEmail = body?.email;
    } catch {
      // No body or invalid JSON
    }

    const authHeader = req.headers.get("Authorization");
    let userEmail: string | undefined;
    let customerId: string | undefined;

    // Try to get authenticated user, but allow guest checkout
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data.user?.email) {
        userEmail = data.user.email;
        logStep("User authenticated", { email: userEmail });
      }
    }

    // Use request email if no authenticated user
    const emailToUse = userEmail || requestEmail;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    if (emailToUse) {
      const customers = await stripe.customers.list({ email: emailToUse, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { customerId });
      } else {
        // Create new customer
        const customer = await stripe.customers.create({ email: emailToUse });
        customerId = customer.id;
        logStep("Created new Stripe customer", { customerId });
      }
    }

    const origin = req.headers.get("origin") || "https://menufly.com.br";

    // Create checkout session with ui_mode: 'embedded' for Stripe Elements
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : emailToUse,
      line_items: [
        {
          price: "price_1SoqbVPfmrrFKGnKO2FqdTkC", // MenuFly Pro - R$97/mês
          quantity: 1,
        },
      ],
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      locale: "pt-BR",
    });

    logStep("Embedded checkout session created", { sessionId: session.id });

    // Return the client_secret for embedded checkout
    return new Response(JSON.stringify({ 
      clientSecret: session.client_secret,
      sessionId: session.id
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
