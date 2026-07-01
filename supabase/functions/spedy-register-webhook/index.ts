// Registra (ou re-registra) o webhook de status de nota fiscal na Spedy para
// um restaurante. Chamado internamente por spedy-save-config, e exposto aqui
// também para o botão "Testar conexão" do FiscalStatus poder reforçar o
// registro sem precisar refazer o wizard inteiro.
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient, requireRestaurantAccess } from "../_shared/spedy-auth.ts";
import { registerSpedyWebhook } from "../_shared/spedy-webhook-registration.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { restaurant_id } = await req.json();
    if (!restaurant_id) return jsonResponse(400, { error: "restaurant_id é obrigatório" });

    const supabase = createServiceRoleClient();
    const access = await requireRestaurantAccess(supabase, req, restaurant_id);
    if (!access.ok) return jsonResponse(access.status, { error: access.error });

    const { data: config } = await supabase
      .from("fiscal_config")
      .select("environment")
      .eq("restaurant_id", restaurant_id)
      .single();
    const { data: secrets } = await supabase
      .from("fiscal_secrets")
      .select("spedy_api_key, webhook_secret")
      .eq("restaurant_id", restaurant_id)
      .single();

    if (!config || !secrets) return jsonResponse(404, { error: "Configuração fiscal não encontrada." });

    const webhookId = await registerSpedyWebhook(
      supabase,
      restaurant_id,
      secrets.spedy_api_key,
      config.environment,
      secrets.webhook_secret
    );

    return jsonResponse(200, { success: true, webhook_id: webhookId });
  } catch (err) {
    console.error("[spedy-register-webhook] error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return jsonResponse(500, { error: message });
  }
});
