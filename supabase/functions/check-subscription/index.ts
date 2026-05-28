import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe price IDs to internal plan codes
const PRICE_TO_PLAN: Record<string, string> = {
  price_1TEX5kDct1iEI7GEVq3sBOvF: "start",
  price_1TEX67Dct1iEI7GEEVAW610Q: "elite",
};

async function syncProfile(
  supabaseClient: any,
  userId: string,
  status: string,
  plan: string | null,
  trialEndsAt: Date | null,
  isActive: boolean,
) {
  try {
    const profileUpdate: Record<string, any> = { subscription_status: status };
    if (plan) profileUpdate.subscription_plan = plan;
    await supabaseClient.from("profiles").update(profileUpdate).eq("id", userId);

    const restaurantUpdate: Record<string, any> = { subscription_active: isActive };
    if (trialEndsAt) restaurantUpdate.trial_ends_at = trialEndsAt.toISOString();
    await supabaseClient.from("restaurants").update(restaurantUpdate).eq("user_id", userId);
    logStep("Profile synced", { userId, status, plan, isActive });
  } catch (e) {
    logStep("Profile sync failed", { error: String(e) });
  }
}

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

  // Separate client to validate the user's JWT (anon key + user's Authorization header)
  const supabaseAuthClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Authentication error: empty bearer token");
    const { data: userData, error: userError } = await supabaseAuthClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check trial first (works regardless of Stripe customer existence)
    const { data: restaurant } = await supabaseClient
      .from("restaurants")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const trialEndsAt = restaurant?.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
    const now = new Date();
    const isTrialActive = trialEndsAt ? trialEndsAt.getTime() > now.getTime() : false;
    const trialExpired = trialEndsAt ? trialEndsAt.getTime() <= now.getTime() : false;

    // Check if user already has an active subscription via PIX (Mercado Pago) tracked in profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_plan, subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    const hasActivePixSub =
      profile?.subscription_status === "active" &&
      !!profile?.subscription_plan &&
      profile.subscription_plan !== "none";

    if (hasActivePixSub) {
      logStep("Active PIX subscription found in profile", {
        plan: profile!.subscription_plan,
      });
      return new Response(JSON.stringify({
        subscribed: true,
        is_trial: false,
        trial_expired: false,
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
        product_id: null,
        subscription_end: null,
        cancel_at_period_end: false,
        collection_method: "pix",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found", { isTrialActive, trialExpired });
      await syncProfile(
        supabaseClient,
        user.id,
        isTrialActive ? "trial" : (trialExpired ? "expired" : "inactive"),
        null,
        trialEndsAt,
        isTrialActive,
      );
      return new Response(JSON.stringify({
        subscribed: isTrialActive,
        is_trial: isTrialActive,
        trial_expired: trialExpired,
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
        product_id: null,
        subscription_end: isTrialActive ? trialEndsAt?.toISOString() : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let cancelAtPeriodEnd = false;
    let collectionMethod = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product;
      cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
      collectionMethod = subscription.collection_method ?? null;
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, productId, endDate: subscriptionEnd,
        cancelAtPeriodEnd, collectionMethod
      });
      const priceId = subscription.items.data[0].price.id;
      const plan = PRICE_TO_PLAN[priceId] || "start";
      await syncProfile(supabaseClient, user.id, "active", plan, null, true);
    } else {
      logStep("No active subscription found");
      await syncProfile(
        supabaseClient,
        user.id,
        isTrialActive ? "trial" : (trialExpired ? "expired" : "inactive"),
        null,
        trialEndsAt,
        isTrialActive,
      );
    }

    // No active Stripe sub but trial may still cover access
    const effectiveSubscribed = hasActiveSub || isTrialActive;

    return new Response(JSON.stringify({
      subscribed: effectiveSubscribed,
      is_trial: !hasActiveSub && isTrialActive,
      trial_expired: !hasActiveSub && trialExpired,
      trial_ends_at: trialEndsAt?.toISOString() ?? null,
      product_id: productId,
      subscription_end: subscriptionEnd ?? (isTrialActive ? trialEndsAt?.toISOString() : null),
      cancel_at_period_end: cancelAtPeriodEnd,
      collection_method: collectionMethod,
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
