import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  fetchTransaction,
  isPaidStatus,
  isFailedStatus,
  activateSubscription,
  claimTransactionForActivation,
  PLAN_PRICES_CENTS,
} from "../_shared/hypercash.ts";

// Webhook é servidor-para-servidor: sem browser envolvido, CORS irrelevante.
const jsonHeaders = { "Content-Type": "application/json" };

const log = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[HYPERCASH-WEBHOOK] ${step}${detailsStr}`);
};

/** Comparação de tempo constante para o token do postback. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** externalRef gerado por hypercash-create-transaction: sub_<plan>_<uuid>_<ts>. */
function parseExternalRef(ref: unknown): { plan?: string; userId?: string } {
  if (typeof ref !== "string") return {};
  const parts = ref.split("_");
  if (parts.length < 4 || parts[0] !== "sub") return {};
  return { plan: parts[1], userId: parts[2] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  try {
    const secretKey = Deno.env.get("HYPERCASH_SECRET_KEY");
    const webhookToken = Deno.env.get("HYPERCASH_WEBHOOK_TOKEN");
    if (!secretKey || !webhookToken) throw new Error("HyperCash secrets not configured");

    // Camada 1: token compartilhado na query do postbackUrl.
    // A HyperCash não assina o webhook, então isso sozinho não basta — ver camada 2.
    const url = new URL(req.url);
    const provided = url.searchParams.get("token") ?? "";
    if (!safeEqual(provided, webhookToken)) {
      log("Rejected: bad token");
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const payload = await req.json().catch(() => null);
    const transactionId = payload?.objectId ?? payload?.data?.id;
    if (!transactionId) {
      log("Rejected: no transaction id in payload");
      return new Response(JSON.stringify({ error: "missing transaction id" }), { status: 400, headers: jsonHeaders });
    }

    log("Postback received", { transactionId, bodyStatus: payload?.data?.status });

    // Camada 2: o corpo do POST é só gatilho. A verdade vem da própria HyperCash.
    // Sem isso, qualquer um que descobrisse o token poderia forjar um "paid".
    const transaction = await fetchTransaction(secretKey, String(transactionId));
    if (!transaction?.id) {
      log("Rejected: transaction not found upstream", { transactionId });
      return new Response(JSON.stringify({ error: "transaction not found" }), { status: 404, headers: jsonHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const fromRef = parseExternalRef(transaction.externalRef);
    const userId = (transaction.metadata?.user_id as string | undefined) ?? fromRef.userId;
    const plan = (transaction.metadata?.plan as string | undefined) ?? fromRef.plan;

    if (!userId || !plan || !PLAN_PRICES_CENTS[plan]) {
      // Transação legítima mas que não é assinatura da plataforma — ignorar sem erro.
      log("Ignored: not a platform subscription transaction", { transactionId, userId, plan });
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: jsonHeaders });
    }

    const status = String(transaction.status ?? "").toLowerCase();

    // Registro de auditoria. Reentrega do mesmo postback cai no ON CONFLICT.
    const { data: inserted } = await supabase
      .from("platform_transactions")
      .upsert({
        user_id: userId,
        gateway: "hypercash",
        gateway_transaction_id: String(transaction.id),
        amount_cents: Number(transaction.amount ?? 0),
        status,
        plan,
        payment_method: String(transaction.paymentMethod ?? "credit_card").toLowerCase(),
        raw: transaction as unknown as Record<string, unknown>,
      }, { onConflict: "gateway,gateway_transaction_id" })
      .select("id")
      .maybeSingle();

    if (!isPaidStatus(status)) {
      if (isFailedStatus(status)) log("Payment failed", { transactionId, status });
      else log("Payment pending", { transactionId, status });
      return new Response(JSON.stringify({ ok: true, status }), { headers: jsonHeaders });
    }

    // Reentrega do postback, ou corrida com o polling do checkout: só quem vence
    // o claim atômico estende o período.
    if (!(await claimTransactionForActivation(supabase, String(transaction.id)))) {
      log("Already activated for this transaction", { transactionId });
      return new Response(JSON.stringify({ ok: true, alreadyActivated: true }), { headers: jsonHeaders });
    }

    const result = await activateSubscription(supabase, {
      userId,
      plan,
      gateway: "hypercash",
      transactionId: String(transaction.id),
      hypercashCustomerId: transaction.customer?.id ?? null,
    });

    log("Subscription activated", { userId, plan, until: result.currentPeriodEnd, row: inserted?.id });

    return new Response(JSON.stringify({ ok: true, activated: true }), { headers: jsonHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    // 500 sinaliza à HyperCash que vale reenviar o postback.
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
