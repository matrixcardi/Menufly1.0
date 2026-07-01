import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { spedyRequest, SpedyEnvironment } from "./spedy-client.ts";

interface SpedyWebhookDto {
  id: string;
}

// Registra (ou substitui) o webhook de status de nota fiscal na Spedy para um
// restaurante. Escopo do webhook na Spedy é por conta — como cada restaurante
// tem sua própria conta, um único webhook por restaurante cobre todas as notas.
export async function registerSpedyWebhook(
  supabase: SupabaseClient,
  restaurantId: string,
  apiKey: string,
  environment: SpedyEnvironment,
  webhookSecret: string
): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const webhookUrl = `${supabaseUrl}/functions/v1/spedy-webhook?restaurant_id=${restaurantId}&secret=${webhookSecret}`;

  const webhook = await spedyRequest<SpedyWebhookDto>("/webhooks", {
    apiKey,
    environment,
    method: "POST",
    body: { event: "invoice.status_changed", url: webhookUrl },
  });

  await supabase.from("fiscal_config").update({ webhook_id: webhook.id }).eq("restaurant_id", restaurantId);

  return webhook.id;
}
