import { logger } from "@/lib/logger";

/**
 * Extrai a mensagem real de um erro de `supabase.functions.invoke`.
 *
 * O supabase-js não lê o corpo da resposta quando o status não é 2xx: ele
 * levanta um FunctionsHttpError com a mensagem genérica "Edge Function returned
 * a non-2xx status code" e guarda a `Response` original em `context`. Nossas
 * Edge Functions devolvem `{ error: "motivo" }` — sem abrir esse corpo, o motivo
 * (ex.: a recusa que veio da HyperCash) nunca chega ao usuário nem ao log.
 */
export async function extractEdgeFunctionError(
  error: unknown,
  fallback: string,
): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;

  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).clone().json();
      const message = body?.error || body?.message;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // corpo vazio ou não-JSON: cai no texto abaixo.
    }

    try {
      const text = await (context as Response).clone().text();
      if (text.trim()) return text.trim();
    } catch {
      // Response já consumida: usa o fallback.
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (message && message !== "Edge Function returned a non-2xx status code") {
    return message;
  }

  logger.error("Edge Function falhou sem corpo legível", { error });
  return fallback;
}
