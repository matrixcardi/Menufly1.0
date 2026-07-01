// Alterna configurações simples de fiscal_config (ativo/inativo, modo de
// emissão) que antes eram gravadas direto do client — agora fiscal_config só
// aceita SELECT via RLS para authenticated, então até esses toggles passam
// por uma Edge Function com service role.
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient, requireRestaurantAccess } from "../_shared/spedy-auth.ts";

interface UpdateSettingsPayload {
  restaurant_id: string;
  is_active?: boolean;
  auto_issue_mode?: "manual" | "automatic";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const payload = (await req.json()) as UpdateSettingsPayload;
    if (!payload.restaurant_id) return jsonResponse(400, { error: "restaurant_id é obrigatório" });
    if (payload.is_active === undefined && !payload.auto_issue_mode) {
      return jsonResponse(400, { error: "Nada para atualizar." });
    }

    const supabase = createServiceRoleClient();
    const access = await requireRestaurantAccess(supabase, req, payload.restaurant_id);
    if (!access.ok) return jsonResponse(access.status, { error: access.error });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.is_active !== undefined) update.is_active = payload.is_active;
    if (payload.auto_issue_mode) update.auto_issue_mode = payload.auto_issue_mode;

    const { error } = await supabase.from("fiscal_config").update(update).eq("restaurant_id", payload.restaurant_id);
    if (error) throw error;

    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error("[spedy-update-settings] error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return jsonResponse(500, { error: message });
  }
});
