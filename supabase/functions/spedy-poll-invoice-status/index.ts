// Job de reconciliação: a Spedy desabilita o webhook de um restaurante depois
// de 5 falhas de entrega seguidas, então notas podem ficar presas em
// 'processing' indefinidamente sem esse fallback. Roda via pg_cron (ver nota
// de setup no fim do arquivo) a cada poucos minutos, consultando (GET, nunca
// o check-status síncrono) as notas mais antigas que ainda não fecharam.
import { createServiceRoleClient } from "../_shared/spedy-auth.ts";
import { spedyRequest, SpedyApiError, SpedyEnvironment } from "../_shared/spedy-client.ts";

const STALE_AFTER_MINUTES = 2;

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
  try {
    const supabase = createServiceRoleClient();
    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString();

    const { data: staleInvoices, error } = await supabase
      .from("fiscal_invoices")
      .select("id, restaurant_id, provider_id")
      .eq("provider", "spedy")
      .in("status", ["pending", "processing"])
      .not("provider_id", "is", null)
      .lt("updated_at", staleBefore)
      .limit(50);

    if (error) throw error;
    if (!staleInvoices || staleInvoices.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0 }), { status: 200 });
    }

    const restaurantIds = [...new Set(staleInvoices.map((i) => i.restaurant_id))];
    const { data: configs } = await supabase
      .from("fiscal_config")
      .select("restaurant_id, environment")
      .in("restaurant_id", restaurantIds);
    const { data: secrets } = await supabase
      .from("fiscal_secrets")
      .select("restaurant_id, spedy_api_key")
      .in("restaurant_id", restaurantIds);

    const envByRestaurant = new Map((configs ?? []).map((c) => [c.restaurant_id, c.environment as SpedyEnvironment]));
    const keyByRestaurant = new Map((secrets ?? []).map((s) => [s.restaurant_id, s.spedy_api_key as string]));

    let updated = 0;
    for (const invoice of staleInvoices) {
      const apiKey = keyByRestaurant.get(invoice.restaurant_id);
      const environment = envByRestaurant.get(invoice.restaurant_id);
      if (!apiKey || !environment) continue;

      try {
        const result = await spedyRequest<{ status: string; number?: number; accessKey?: string; processingDetail?: { message?: string } }>(
          `/consumer-invoices/${invoice.provider_id}`,
          { apiKey, environment }
        );

        const mapped = mapSpedyStatus(result.status);
        if (mapped === "processing") continue; // ainda não fechou, só atualiza updated_at implicitamente na próxima leitura

        const update: Record<string, unknown> = { status: mapped, updated_at: new Date().toISOString() };
        if (result.number != null) update.nfe_number = String(result.number);
        if (result.accessKey) update.nfe_key = result.accessKey;
        if (mapped === "error" && result.processingDetail?.message) update.error_message = result.processingDetail.message;

        await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
        updated++;
      } catch (err) {
        if (!(err instanceof SpedyApiError)) console.error("[spedy-poll-invoice-status] erro inesperado:", err);
        // Erro pontual numa nota não deve interromper o processamento das demais.
      }
    }

    return new Response(JSON.stringify({ success: true, checked: staleInvoices.length, updated }), { status: 200 });
  } catch (err) {
    console.error("[spedy-poll-invoice-status] error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500 });
  }
});

// ============================================================
// SETUP DE AGENDAMENTO (executar uma vez, fora desta migração de código-fonte,
// via SQL Editor do Supabase ou Management API — nunca comitar a service_role
// key em arquivo de migração versionado):
//
// select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'spedy_poll_service_role_key');
// select cron.schedule(
//   'spedy-poll-invoice-status',
//   '(a cada 5 minutos, expressão cron)',
//   $$
//   select net.http_post(
//     url := 'https://<project-ref>.supabase.co/functions/v1/spedy-poll-invoice-status',
//     headers := jsonb_build_object(
//       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'spedy_poll_service_role_key'),
//       'Content-Type', 'application/json'
//     )
//   );
//   $$
// );
// ============================================================
