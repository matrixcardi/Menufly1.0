// Webhook público (verify_jwt=false) chamado pela Spedy quando o status de
// uma nota fiscal muda. Autenticado por um secret próprio por restaurante
// embutido na URL registrada (mesmo padrão de supabase/functions/lavem-webhook),
// já que a Spedy não documenta assinatura HMAC nesse callback.
import { createServiceRoleClient } from "../_shared/spedy-auth.ts";
import { spedyBaseUrl, SpedyEnvironment } from "../_shared/spedy-client.ts";

interface SpedyWebhookPayload {
  id: string;
  event: string;
  data: {
    id: string;
    integrationId?: string;
    status: string;
    number?: number;
    accessKey?: string;
    environmentType?: SpedyEnvironment;
    processingDetail?: { status: string; message?: string; code?: string };
  };
}

function mapSpedyStatus(status: string): "processing" | "authorized" | "cancelled" | "error" {
  switch (status) {
    case "authorized":
      return "authorized";
    case "canceled":
    case "disabled":
    case "removed":
      return "cancelled";
    case "rejected":
    case "denied":
      return "error";
    default:
      return "processing";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null);

  try {
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurant_id");
    const secret = url.searchParams.get("secret");

    if (!restaurantId || !secret) {
      return new Response(JSON.stringify({ error: "restaurant_id e secret são obrigatórios" }), { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: secretRow } = await supabase
      .from("fiscal_secrets")
      .select("webhook_secret")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!secretRow || secretRow.webhook_secret !== secret) {
      return new Response(JSON.stringify({ error: "Webhook secret inválido" }), { status: 401 });
    }

    const payload = (await req.json()) as SpedyWebhookPayload;
    const invoiceData = payload.data;
    if (!invoiceData?.integrationId) {
      // Nada para correlacionar — responde 200 para a Spedy não ficar retentando.
      return new Response(JSON.stringify({ success: true, ignored: true }), { status: 200 });
    }

    const environment = invoiceData.environmentType ?? "production";
    const update: Record<string, unknown> = {
      status: mapSpedyStatus(invoiceData.status),
      provider_id: invoiceData.id,
      updated_at: new Date().toISOString(),
    };
    if (invoiceData.number != null) update.nfe_number = String(invoiceData.number);
    if (invoiceData.accessKey) update.nfe_key = invoiceData.accessKey;
    if (mapSpedyStatus(invoiceData.status) === "authorized") {
      update.pdf_url = `${spedyBaseUrl(environment)}/consumer-invoices/${invoiceData.id}/pdf`;
      update.xml_url = `${spedyBaseUrl(environment)}/consumer-invoices/${invoiceData.id}/xml`;
    }
    if (invoiceData.processingDetail?.message && mapSpedyStatus(invoiceData.status) === "error") {
      update.error_message = invoiceData.processingDetail.message;
    }

    const { error: updateError } = await supabase
      .from("fiscal_invoices")
      .update(update)
      .eq("order_id", invoiceData.integrationId)
      .eq("restaurant_id", restaurantId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[spedy-webhook] error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500 });
  }
});
