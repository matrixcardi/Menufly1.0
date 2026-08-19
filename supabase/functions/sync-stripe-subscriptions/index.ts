import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: unknown) => console.log(`[SYNC-STRIPE] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const PRICE_TO_PLAN: Record<string, string> = {
  price_1TEX5kDct1iEI7GEVq3sBOvF: "start",
  price_1TEX67Dct1iEI7GEEVAW610Q: "elite",
};

/**
 * Reconcilia a base legada do Stripe com `platform_subscriptions`.
 *
 * É o que mantém `gateway = 'stripe'` confiável: o check-subscription confia na
 * flag no caminho quente em vez de consultar o Stripe a cada carregamento do
 * painel. Roda por cron diário e também sob demanda pelo painel master.
 *
 * Diferença importante em relação à versão anterior desta função: ela só sabia
 * ativar. Se um cliente cancelasse no Stripe, ele simplesmente sumia da
 * listagem e a conta seguia ativa para sempre. Agora a ausência também é
 * tratada — ver a etapa de reconciliação no fim.
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Aceita duas origens: o cron (que usa a service role key) e um usuário master.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "").trim();

    const isCron = !!serviceRoleKey && token === serviceRoleKey;
    if (!isCron) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData.user) throw new Error("Auth failed");
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "master")
        .maybeSingle();
      if (!roleRow) throw new Error("Master role required");
    }
    log("Authorized", { isCron });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Paginação real: a versão antiga parava em 100 assinaturas e passaria a
    // "esquecer" clientes silenciosamente assim que a base crescesse.
    const activeSubs: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        expand: ["data.customer"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      activeSubs.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    log("Active subscriptions fetched", { count: activeSubs.length });

    let updated = 0;
    const seenUserIds = new Set<string>();
    const results: Array<Record<string, unknown>> = [];

    for (const sub of activeSubs) {
      const customer = sub.customer as Stripe.Customer;
      const email = customer?.email;
      if (!email) { results.push({ sub: sub.id, skipped: "no email" }); continue; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!profile) { results.push({ email, skipped: "no profile" }); continue; }

      const item = sub.items.data[0];
      const plan = PRICE_TO_PLAN[item?.price?.id ?? ""] || "start";

      // current_period_end migrou para o item em versões recentes da API;
      // manter os dois caminhos evita depender da versão negociada.
      const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end
        ?? (item as unknown as { current_period_end?: number })?.current_period_end;
      const periodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const periodStartUnix = (sub as unknown as { current_period_start?: number }).current_period_start;

      await supabase
        .from("platform_subscriptions")
        .upsert({
          user_id: profile.id,
          plan,
          status: "active",
          gateway: "stripe",
          current_period_start: periodStartUnix
            ? new Date(periodStartUnix * 1000).toISOString()
            : new Date().toISOString(),
          current_period_end: periodEnd,
          auto_renew: true,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
        }, { onConflict: "user_id" });

      await supabase
        .from("profiles")
        .update({ subscription_status: "active", subscription_plan: plan })
        .eq("id", profile.id);

      await supabase
        .from("restaurants")
        .update({ subscription_active: true })
        .eq("user_id", profile.id);

      seenUserIds.add(profile.id);
      updated++;
      results.push({ email, plan, cancel_at_period_end: sub.cancel_at_period_end, until: periodEnd });
    }

    // Reconciliação: quem estava marcado como Stripe ativo e não apareceu na
    // listagem cancelou ou teve o pagamento recusado. Sem esta etapa a conta
    // ficaria ativa indefinidamente.
    const { data: staleRows } = await supabase
      .from("platform_subscriptions")
      .select("user_id")
      .eq("gateway", "stripe")
      .eq("status", "active");

    const stale = (staleRows ?? [])
      .map((r: { user_id: string }) => r.user_id)
      .filter((id: string) => !seenUserIds.has(id));

    let canceled = 0;

    // Trava de segurança: se o Stripe não devolveu nenhuma assinatura ativa mas
    // o banco tem linhas ativas, o cenário provável é falha de credencial ou
    // conta errada — não cancelamento em massa real. Melhor não fazer nada.
    if (activeSubs.length === 0 && stale.length > 0) {
      log("Refusing mass-cancel: Stripe returned zero active subs", { wouldCancel: stale.length });
    } else {
      for (const userId of stale) {
        await supabase
          .from("platform_subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId);
        await supabase
          .from("profiles")
          .update({ subscription_status: "expired" })
          .eq("id", userId);
        await supabase
          .from("restaurants")
          .update({ subscription_active: false })
          .eq("user_id", userId);
        canceled++;
        log("Marked canceled (gone from Stripe)", { userId });
      }
    }

    log("Done", { updated, canceled });

    return new Response(JSON.stringify({ success: true, updated, canceled, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
