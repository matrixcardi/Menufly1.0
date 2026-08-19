import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { PLAN_LABELS } from "../_shared/hypercash.ts";

const log = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[HYPERCASH-RENEW] ${step}${detailsStr}`);
};

/** Janela de aviso antes do vencimento. */
const NOTICE_DAYS = [7, 3, 1, 0];
/** Não reenviar aviso para o mesmo ciclo em menos de 20h. */
const NOTICE_COOLDOWN_MS = 20 * 60 * 60 * 1000;

/**
 * Cobrança automática no cartão salvo.
 *
 * A API pública da HyperCash (Transações, Cashout, Carteira) não expõe cofre de
 * cartão nem cobrança recorrente, e o token do FastSoft expira em 15 minutos —
 * não há como reutilizá-lo no mês seguinte. Enquanto isso não mudar, o cron
 * roda em modo notificação.
 *
 * ESTE É O ÚNICO PONTO A IMPLEMENTAR quando a HyperCash confirmar card-on-file:
 * ligar a env HYPERCASH_CARD_ON_FILE=true e preencher a cobrança aqui usando
 * `subscription.hypercash_customer_id`. O restante do motor (ciclo, retry,
 * estados, auditoria) já está pronto.
 */
async function attemptAutoCharge(
  _subscription: { user_id: string; plan: string; hypercash_customer_id: string | null },
): Promise<{ charged: boolean; reason?: string }> {
  return { charged: false, reason: "card-on-file não disponível na API da HyperCash" };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const cardOnFileEnabled = Deno.env.get("HYPERCASH_CARD_ON_FILE") === "true";

  try {
    const now = Date.now();
    const horizon = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString();

    // Apenas gateways de cobrança avulsa. Assinatura Stripe é recorrente: o
    // gateway renova sozinho, e mandar "sua assinatura vence, renove agora"
    // para quem tem débito automático assusta e gera cancelamento.
    const { data: subs, error } = await supabase
      .from("platform_subscriptions")
      .select("user_id, plan, status, gateway, current_period_end, auto_renew, renewal_attempts, last_renewal_notice_at, hypercash_customer_id")
      .in("gateway", ["hypercash", "mercadopago"])
      .in("status", ["active", "past_due"])
      .lte("current_period_end", horizon);

    if (error) throw new Error(error.message);

    log("Subscriptions in renewal window", { count: subs?.length ?? 0, cardOnFileEnabled });

    let charged = 0, notified = 0, expired = 0, skipped = 0;

    for (const sub of subs ?? []) {
      const endTs = new Date(sub.current_period_end).getTime();
      const daysLeft = Math.ceil((endTs - now) / (1000 * 60 * 60 * 24));

      // Venceu: rebaixa e corta o acesso. check-subscription chega à mesma
      // conclusão sob demanda; aqui garantimos sem depender de o usuário logar.
      if (endTs <= now && sub.status !== "past_due") {
        await supabase
          .from("platform_subscriptions")
          .update({ status: "past_due" })
          .eq("user_id", sub.user_id);
        await supabase
          .from("profiles")
          .update({ subscription_status: "expired" })
          .eq("id", sub.user_id);
        await supabase
          .from("restaurants")
          .update({ subscription_active: false })
          .eq("user_id", sub.user_id);
        expired++;
        log("Subscription expired", { userId: sub.user_id });
      }

      if (!sub.auto_renew) { skipped++; continue; }

      if (cardOnFileEnabled) {
        const result = await attemptAutoCharge(sub);
        if (result.charged) {
          charged++;
          continue;
        }
        await supabase
          .from("platform_subscriptions")
          .update({ renewal_attempts: (sub.renewal_attempts ?? 0) + 1 })
          .eq("user_id", sub.user_id);
        log("Auto charge unavailable, falling back to notice", { userId: sub.user_id, reason: result.reason });
      }

      // Modo notificação: avisa nos checkpoints, sem spammar.
      if (!NOTICE_DAYS.includes(Math.max(daysLeft, 0))) { skipped++; continue; }

      const lastNotice = sub.last_renewal_notice_at ? new Date(sub.last_renewal_notice_at).getTime() : 0;
      if (now - lastNotice < NOTICE_COOLDOWN_MS) { skipped++; continue; }

      const { data: userResp } = await supabase.auth.admin.getUserById(sub.user_id);
      const email = userResp?.user?.email;
      if (!email) { skipped++; continue; }

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("name")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      try {
        await sendRenewalNotice(email, restaurant?.name ?? null, sub.plan, Math.max(daysLeft, 0));
        await supabase
          .from("platform_subscriptions")
          .update({ last_renewal_notice_at: new Date().toISOString() })
          .eq("user_id", sub.user_id);
        notified++;
      } catch (e) {
        log("Failed to send renewal notice", { userId: sub.user_id, error: String(e) });
      }
    }

    log("Done", { charged, notified, expired, skipped });

    return new Response(JSON.stringify({ charged, notified, expired, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function sendRenewalNotice(
  to: string,
  restaurantName: string | null,
  plan: string,
  daysRemaining: number,
) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      template: "subscription-renewal",
      to,
      data: { restaurantName, planLabel: PLAN_LABELS[plan] ?? plan, daysRemaining },
      // Uma notificação por checkpoint por ciclo de vencimento.
      idempotency_key: `renewal-d${daysRemaining}-${to}-${new Date().toISOString().slice(0, 10)}`,
      purpose: "transactional",
    }),
  });
  if (!resp.ok) throw new Error(`Email send failed: ${resp.status}`);
}
