import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const PRICE_TO_PLAN: Record<string, string> = {
  price_1TEX5kDct1iEI7GEVq3sBOvF: "start",
  price_1TEX67Dct1iEI7GEEVAW610Q: "elite",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

/**
 * Fonte de verdade do acesso do restaurante.
 *
 * Antes consultava o Stripe a cada chamada. Agora lê `platform_subscriptions`,
 * que é preenchida pelo webhook/verificação da HyperCash e pelo fluxo PIX do
 * Mercado Pago. `profiles` continua sendo o read model do app e é sincronizado
 * aqui — inclusive para rebaixar quem venceu.
 */
async function syncProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  status: string,
  plan: string | null,
  isActive: boolean,
) {
  try {
    const profileUpdate: Record<string, unknown> = { subscription_status: status };
    if (plan) profileUpdate.subscription_plan = plan;
    await supabase.from("profiles").update(profileUpdate).eq("id", userId);
    await supabase.from("restaurants").update({ subscription_active: isActive }).eq("user_id", userId);
    logStep("Profile synced", { userId, status, plan, isActive });
  } catch (e) {
    logStep("Profile sync failed", { error: String(e) });
  }
}

interface StripeRefresh {
  plan: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

/**
 * Confirma no Stripe o estado de uma assinatura legada que parece vencida no
 * banco, e grava o resultado. Devolve os campos atualizados quando a assinatura
 * segue ativa; `null` quando realmente acabou (ou quando não deu para checar).
 *
 * Falha de rede devolve `null` de propósito: sem confirmação, o fluxo normal
 * segue e o cliente é rebaixado. É o comportamento conservador do ponto de
 * vista de receita; o cron corrige na próxima passada.
 */
async function refreshStripeSubscription(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string | null,
  sub: { stripe_subscription_id?: string | null; stripe_customer_id?: string | null },
): Promise<StripeRefresh | null> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    logStep("Cannot verify Stripe: STRIPE_SECRET_KEY not set");
    return null;
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let subscription: Stripe.Subscription | null = null;

    if (sub.stripe_subscription_id) {
      const found = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      if (found && found.status === "active") subscription = found;
    }

    if (!subscription) {
      // Sem id gravado (linha vinda do backfill) ou assinatura trocada: procura
      // pelo customer, e por e-mail se nem isso houver.
      let customerId = sub.stripe_customer_id ?? null;
      if (!customerId && email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        customerId = customers.data[0]?.id ?? null;
      }
      if (!customerId) return null;

      const list = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      subscription = list.data[0] ?? null;
      if (subscription) sub.stripe_customer_id = customerId;
    }

    if (!subscription) return null;

    const item = subscription.items.data[0];
    const periodEndUnix = (subscription as unknown as { current_period_end?: number }).current_period_end
      ?? (item as unknown as { current_period_end?: number })?.current_period_end;
    if (!periodEndUnix) return null;

    const refreshed: StripeRefresh = {
      plan: PRICE_TO_PLAN[item?.price?.id ?? ""] || "start",
      status: "active",
      current_period_end: new Date(periodEndUnix * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      stripe_customer_id: (subscription.customer as string) ?? sub.stripe_customer_id ?? "",
      stripe_subscription_id: subscription.id,
    };

    await supabase
      .from("platform_subscriptions")
      .update({
        plan: refreshed.plan,
        status: "active",
        current_period_end: refreshed.current_period_end,
        cancel_at_period_end: refreshed.cancel_at_period_end,
        stripe_customer_id: refreshed.stripe_customer_id || null,
        stripe_subscription_id: refreshed.stripe_subscription_id,
      })
      .eq("user_id", userId);

    return refreshed;
  } catch (e) {
    logStep("Stripe verification failed", { error: String(e) });
    return null;
  }
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Authentication error: empty bearer token");

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const now = new Date();

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const trialEndsAt = restaurant?.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
    const isTrialActive = trialEndsAt ? trialEndsAt.getTime() > now.getTime() : false;
    const trialExpired = trialEndsAt ? trialEndsAt.getTime() <= now.getTime() : false;

    const { data: subRow } = await supabase
      .from("platform_subscriptions")
      .select("plan, status, gateway, current_period_end, auto_renew, cancel_at_period_end, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let sub = subRow;
    let periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;

    const looksExpired = !!sub
      && sub.status !== "canceled"
      && (!periodEnd || periodEnd.getTime() <= now.getTime());

    // Linha Stripe aparentemente vencida não pode ser rebaixada de imediato: o
    // Stripe renova sozinho e o cron de sync pode não ter passado ainda. Cortar
    // aqui tiraria o acesso de quem acabou de ser cobrado. Este é o único ponto
    // quente que fala com o Stripe, e só neste caso duvidoso.
    if (looksExpired && sub!.gateway === "stripe") {
      const refreshed = await refreshStripeSubscription(supabase, user.id, user.email ?? null, sub!);
      if (refreshed) {
        sub = { ...sub!, ...refreshed };
        periodEnd = new Date(refreshed.current_period_end);
        logStep("Stripe subscription refreshed live", { until: refreshed.current_period_end });
      }
    }

    const subActive = !!sub
      && sub.status !== "canceled"
      && !!periodEnd
      && periodEnd.getTime() > now.getTime();

    // 1. Assinatura paga vigente — tem precedência sobre o trial.
    if (subActive) {
      logStep("Active subscription", { plan: sub.plan, gateway: sub.gateway, until: periodEnd!.toISOString() });
      await syncProfile(supabase, user.id, "active", sub.plan, true);

      return new Response(JSON.stringify({
        subscribed: true,
        is_trial: false,
        trial_expired: false,
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
        subscription_end: periodEnd!.toISOString(),
        plan: sub.plan,
        status: "active",
        gateway: sub.gateway,
        auto_renew: sub.auto_renew,
        cancel_at_period_end: !!sub.cancel_at_period_end,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Assinatura existe mas venceu de fato: registrar o rebaixamento na própria
    // linha para que o cron e o painel enxerguem o mesmo estado. Para Stripe,
    // só chega aqui depois da confirmação ao vivo acima.
    if (sub && sub.status === "active") {
      await supabase
        .from("platform_subscriptions")
        .update({ status: "past_due" })
        .eq("user_id", user.id);
      logStep("Subscription marked past_due", { userId: user.id, gateway: sub.gateway });
    }

    // 2. Trial ainda cobre o acesso.
    if (isTrialActive) {
      logStep("Trial active", { until: trialEndsAt?.toISOString() });
      await syncProfile(supabase, user.id, "trial", null, true);

      return new Response(JSON.stringify({
        subscribed: true,
        is_trial: true,
        trial_expired: false,
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
        subscription_end: trialEndsAt?.toISOString() ?? null,
        plan: sub?.plan ?? null,
        status: "trial",
        gateway: null,
        auto_renew: false,
        cancel_at_period_end: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // 3. Sem assinatura vigente e sem trial.
    const status = sub ? "expired" : (trialExpired ? "expired" : "inactive");
    logStep("No active access", { status });
    await syncProfile(supabase, user.id, status, null, false);

    return new Response(JSON.stringify({
      subscribed: false,
      is_trial: false,
      trial_expired: trialExpired,
      trial_ends_at: trialEndsAt?.toISOString() ?? null,
      subscription_end: periodEnd?.toISOString() ?? null,
      plan: sub?.plan ?? null,
      status,
      gateway: sub?.gateway ?? null,
      auto_renew: false,
      cancel_at_period_end: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
