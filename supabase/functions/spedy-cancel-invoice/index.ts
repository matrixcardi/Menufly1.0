// Cancela uma NFC-e já autorizada. Respeita a janela legal informada pela
// Spedy (ela mesma rejeita se o prazo já passou — normalmente ~30min para NFC-e).
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient, requireRestaurantAccess } from "../_shared/spedy-auth.ts";
import { spedyRequest, SpedyApiError } from "../_shared/spedy-client.ts";

const MIN_JUSTIFICATION_LENGTH = 15;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { order_id, justification } = await req.json();
    if (!order_id) return jsonResponse(400, { error: "order_id é obrigatório" });
    if (!justification || justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
      return jsonResponse(400, { error: `Justificativa deve ter no mínimo ${MIN_JUSTIFICATION_LENGTH} caracteres.` });
    }

    const supabase = createServiceRoleClient();

    const { data: invoice, error: invoiceError } = await supabase
      .from("fiscal_invoices")
      .select("id, restaurant_id, provider_id, status")
      .eq("order_id", order_id)
      .eq("provider", "spedy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invoiceError) throw invoiceError;
    if (!invoice || !invoice.provider_id) return jsonResponse(404, { error: "Nota fiscal não encontrada." });
    if (invoice.status !== "authorized") {
      return jsonResponse(400, { error: "Só é possível cancelar notas autorizadas." });
    }

    const access = await requireRestaurantAccess(supabase, req, invoice.restaurant_id);
    if (!access.ok) return jsonResponse(access.status, { error: access.error });

    const { data: config } = await supabase
      .from("fiscal_config")
      .select("environment")
      .eq("restaurant_id", invoice.restaurant_id)
      .maybeSingle();
    const { data: secrets } = await supabase
      .from("fiscal_secrets")
      .select("spedy_api_key")
      .eq("restaurant_id", invoice.restaurant_id)
      .maybeSingle();
    if (!config || !secrets) return jsonResponse(400, { error: "Módulo fiscal não configurado." });

    try {
      await spedyRequest(`/consumer-invoices/${invoice.provider_id}`, {
        apiKey: secrets.spedy_api_key,
        environment: config.environment,
        method: "DELETE",
        body: { justification: justification.trim() },
      });
    } catch (err) {
      const message = err instanceof SpedyApiError ? err.message : (err instanceof Error ? err.message : "Erro desconhecido");
      return jsonResponse(400, { error: message });
    }

    await supabase
      .from("fiscal_invoices")
      .update({ status: "cancelled", justification: justification.trim(), updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error("[spedy-cancel-invoice] error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return jsonResponse(500, { error: message });
  }
});
