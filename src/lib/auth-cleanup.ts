import { supabase } from "@/integrations/supabase/client";

/**
 * Limpa completamente o estado de sessão local para evitar "contaminação"
 * entre contas diferentes no mesmo navegador.
 *
 * Remove:
 * - Tokens do Supabase (sb-*)
 * - Contexto de acesso (authAccessScope, masterManaging, masterManagedRestaurantId, selectedRestaurantId)
 * - Qualquer cache de tenant
 */
export function clearLocalAuthState() {
  try {
    // Contexto de tenant/master
    localStorage.removeItem("authAccessScope");
    localStorage.removeItem("masterManaging");
    localStorage.removeItem("masterManagedRestaurantId");
    localStorage.removeItem("selectedRestaurantId");

    // Tokens Supabase (qualquer chave que comece com sb- ou supabase.auth)
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key.startsWith("supabase.auth.")) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith("sb-") || key.startsWith("supabase.auth.")) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {
    // noop — localStorage indisponível (SSR / modo privado)
  }
}

/**
 * Faz logout global + limpa estado local.
 * Use antes de qualquer signIn para garantir que a nova sessão
 * começa 100% limpa, evitando "2 contas conectadas".
 */
export async function performCleanSignOut() {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Ignora erros (ex: já deslogado / token inválido)
  }
  clearLocalAuthState();
}

/**
 * Detecta erros de refresh token corrompido/ausente e,
 * se encontrado, limpa estado local e retorna true.
 */
export function isRefreshTokenError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error as any)?.message?.toLowerCase?.() || "";
  const code = (error as any)?.code?.toLowerCase?.() || "";
  return (
    msg.includes("refresh token") ||
    msg.includes("refresh_token") ||
    code === "refresh_token_not_found" ||
    code === "invalid_grant"
  );
}
