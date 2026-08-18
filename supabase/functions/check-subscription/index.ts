import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

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
  supabase: any,
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

    const { data: sub } = await supabase
      .from("platform_subscriptions")
      .select("plan, status, gateway, current_period_end, auto_renew")
      .eq("user_id", user.id)
      .maybeSingle();

    const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
    const subActive = !!sub
      && sub.status !== "canceled"
      && !!periodEnd
      && periodEnd.getTime() > now.getTime();

    // 1. Assinatura paga vigente — tem precedência sobre o trial.
    if (subActive) {
      logStep("Active subscription", { plan: sub.plan, gateway: sub.gateway, until: sub.current_period_end });
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
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Assinatura existe mas venceu: registrar o rebaixamento na própria linha
    // para que o cron de renovação e o painel enxerguem o mesmo estado.
    if (sub && sub.status === "active") {
      await supabase
        .from("platform_subscriptions")
        .update({ status: "past_due" })
        .eq("user_id", user.id);
      logStep("Subscription marked past_due", { userId: user.id });
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
