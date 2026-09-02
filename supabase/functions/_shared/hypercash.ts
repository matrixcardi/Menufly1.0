// Cliente compartilhado para a API da HyperCash (billing da assinatura MenuFly).
// Doc: https://docs.hypercash.com.br/docs/intro/getting-started
//
// A API expõe apenas transações avulsas — não há endpoint de assinatura nem
// cofre de cartão. O ciclo de 30 dias é controlado por nós em
// `platform_subscriptions`; ver supabase/migrations/20260818120000.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const BASE_URL = "https://api.hypercashbrasil.com.br";

/** Preços em centavos — a API da HyperCash trabalha exclusivamente em centavos. */
export const PLAN_PRICES_CENTS: Record<string, number> = {
  start: 9700,
  elite: 16000,
};

export const IMPLEMENTATION_PRICE_CENTS = 39990;

export const PLAN_LABELS: Record<string, string> = {
  start: "MenuFly Start — Mensal",
  elite: "MenuFly Elite — Mensal",
};

/** Dias liberados por cobrança confirmada. */
export const SUBSCRIPTION_PERIOD_DAYS = 30;

// A doc lista os status em maiúsculas (PAID, WAITING_PAYMENT…) mas o exemplo de
// webhook devolve "paid". Comparar sempre normalizado.
const PAID_STATUSES = new Set(["paid", "approved"]);
const FAILED_STATUSES = new Set(["refused", "canceled", "cancelled", "chargedback", "refunded"]);

export function isPaidStatus(status: unknown): boolean {
  return typeof status === "string" && PAID_STATUSES.has(status.trim().toLowerCase());
}

export function isFailedStatus(status: unknown): boolean {
  return typeof status === "string" && FAILED_STATUSES.has(status.trim().toLowerCase());
}

export class HyperCashApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "HyperCashApiError";
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(status: number, body: unknown): string {
  if (status === 401) return "Credenciais da HyperCash inválidas.";
  if (status === 403) return "Chave da HyperCash sem permissão para esta operação.";
  if (status === 404) return "Transação não encontrada na HyperCash.";
  const b = body as { message?: string; error?: string } | null;
  return b?.message || b?.error || `Erro HyperCash (${status})`;
}

/** Basic auth: base64("x:" + SECRET_KEY), conforme a doc de autenticação. */
function authHeader(secretKey: string): string {
  return `Basic ${btoa(`x:${secretKey}`)}`;
}

/**
 * A HyperCash embrulha as respostas em `{ status, message, data }` — o recurso
 * em si vem em `data`. Ler o envelope como se fosse a transação faz `id` sumir.
 *
 * O `status` do envelope é numérico (HTTP) e o da transação é string ("paid",
 * "refused"), então é isso que distingue os dois com segurança.
 */
function unwrapEnvelope(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const body = parsed as Record<string, unknown>;
  const isEnvelope = typeof body.status === "number" &&
    body.data !== null &&
    typeof body.data === "object";
  return isEnvelope ? body.data : parsed;
}

interface HyperCashRequestOptions {
  secretKey: string;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

export async function hypercashRequest<T = unknown>(
  path: string,
  options: HyperCashRequestOptions,
): Promise<T> {
  const { secretKey, method = "GET", body, timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Authorization": authHeader(secretKey),
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new HyperCashApiError(res.status, extractErrorMessage(res.status, parsed), parsed);
    }

    return unwrapEnvelope(parsed) as T;
  } catch (err) {
    if (err instanceof HyperCashApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HyperCashApiError(408, "Tempo limite excedido ao contatar a HyperCash.");
    }
    throw new HyperCashApiError(0, err instanceof Error ? err.message : "Erro desconhecido na HyperCash.");
  } finally {
    clearTimeout(timeout);
  }
}

export interface HyperCashTransaction {
  id: string;
  status: string;
  amount: number;
  paymentMethod?: string;
  externalRef?: string | null;
  metadata?: Record<string, unknown> | null;
  customer?: { id?: string; email?: string; name?: string } | null;
  refusedReason?: string | null;
}

/**
 * Busca a transação direto na HyperCash.
 *
 * O webhook da HyperCash não é assinado, então o corpo do POST nunca é fonte de
 * verdade — só gatilho. Toda ativação passa por aqui.
 */
export function fetchTransaction(secretKey: string, transactionId: string) {
  return hypercashRequest<HyperCashTransaction>(
    `/api/user/transactions/${encodeURIComponent(transactionId)}`,
    { secretKey },
  );
}

export interface ActivateResult {
  activated: boolean;
  plan: string;
  currentPeriodEnd: string;
}

/**
 * Reserva o direito de ativar esta transação, de forma atômica.
 *
 * O webhook da HyperCash e o polling do checkout confirmam o mesmo pagamento em
 * paralelo. Um simples "já ativei?" seguido de "ativa" é leitura-depois-escrita
 * e deixa os dois passarem, somando 60 dias. Aqui o banco decide: o UPDATE só
 * casa enquanto `activated_at` é NULL, então exatamente um dos concorrentes
 * recebe a linha de volta.
 *
 * Retorna true para quem venceu a corrida; false para quem chegou depois.
 */
export async function claimTransactionForActivation(
  supabase: SupabaseClient,
  transactionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_transactions")
    .update({ activated_at: new Date().toISOString() })
    .eq("gateway", "hypercash")
    .eq("gateway_transaction_id", transactionId)
    .is("activated_at", null)
    .select("id");

  if (error) throw new Error(`Falha ao reservar ativação: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Ativa (ou estende) a assinatura da plataforma após um pagamento confirmado.
 *
 * Se o usuário ainda tem período válido, soma em cima dele — pagar adiantado
 * não pode fazer o cliente perder dias. `profiles` continua sendo o read model
 * lido pelo app, então é atualizado junto.
 */
export async function activateSubscription(
  supabase: SupabaseClient,
  params: {
    userId: string;
    plan: string;
    gateway: "hypercash" | "mercadopago";
    transactionId?: string | null;
    hypercashCustomerId?: string | null;
    months?: number;
  },
): Promise<ActivateResult> {
  const { userId, plan, gateway, transactionId, hypercashCustomerId, months = 1 } = params;

  const { data: existing } = await supabase
    .from("platform_subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  const existingEnd = existing?.current_period_end ? new Date(existing.current_period_end) : null;
  const base = existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;

  const periodEnd = new Date(base);
  periodEnd.setDate(periodEnd.getDate() + SUBSCRIPTION_PERIOD_DAYS * months);

  const { error: subError } = await supabase
    .from("platform_subscriptions")
    .upsert({
      user_id: userId,
      plan,
      status: "active",
      gateway,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      auto_renew: true,
      renewal_attempts: 0,
      last_renewal_notice_at: null,
      ...(transactionId ? { last_transaction_id: transactionId } : {}),
      ...(hypercashCustomerId ? { hypercash_customer_id: hypercashCustomerId } : {}),
    }, { onConflict: "user_id" });

  if (subError) throw new Error(`Falha ao gravar assinatura: ${subError.message}`);

  // Read model consumido pelo app (usePlan, useCurrentPlan, RLS, master).
  await supabase
    .from("profiles")
    .update({ subscription_plan: plan, subscription_status: "active", updated_at: now.toISOString() })
    .eq("id", userId);

  await supabase
    .from("restaurants")
    .update({ subscription_active: true })
    .eq("user_id", userId);

  return { activated: true, plan, currentPeriodEnd: periodEnd.toISOString() };
}
