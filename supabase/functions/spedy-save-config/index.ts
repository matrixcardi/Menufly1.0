// Cadastro/validação da integração fiscal Spedy para um restaurante.
// Recebe os dados do wizard (empresa, endereço, credenciais Spedy), confirma
// que a API Key informada é válida chamando a Spedy de verdade, e só então
// persiste: a API Key vai para fiscal_secrets (nunca lida pelo client), o
// restante para fiscal_config. Ao final, registra o webhook de status na Spedy.
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient, requireRestaurantAccess } from "../_shared/spedy-auth.ts";
import { spedyRequest, SpedyApiError, SpedyEnvironment } from "../_shared/spedy-client.ts";
import { registerSpedyWebhook } from "../_shared/spedy-webhook-registration.ts";

interface SaveConfigPayload {
  restaurant_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  inscricao_estadual: string;
  regime_tributario: "simples_nacional" | "lucro_presumido" | "lucro_real";
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  default_ncm?: string;
  auto_issue_mode?: "manual" | "automatic";
  api_key: string;
  environment: SpedyEnvironment;
}

const REQUIRED_FIELDS: Array<keyof SaveConfigPayload> = [
  "restaurant_id", "cnpj", "razao_social", "inscricao_estadual", "regime_tributario",
  "cep", "logradouro", "numero", "bairro", "cidade", "uf", "api_key", "environment",
];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const payload = (await req.json()) as SaveConfigPayload;

    for (const field of REQUIRED_FIELDS) {
      if (!payload[field]) return jsonResponse(400, { error: `Campo obrigatório ausente: ${field}` });
    }

    // V1 só suporta Simples Nacional — NFC-e na Spedy exige tributação completa
    // por item, e só temos a regra fixa (CSOSN 400 / PIS-COFINS CST 07) pronta.
    if (payload.regime_tributario !== "simples_nacional") {
      return jsonResponse(400, {
        error: "Por enquanto só oferecemos emissão para empresas no Simples Nacional. Os demais regimes chegam em breve.",
      });
    }

    const supabase = createServiceRoleClient();
    const access = await requireRestaurantAccess(supabase, req, payload.restaurant_id);
    if (!access.ok) return jsonResponse(access.status, { error: access.error });

    // Valida a API Key contra a Spedy de verdade antes de salvar qualquer coisa.
    try {
      await spedyRequest("/consumer-invoices?pageSize=1", {
        apiKey: payload.api_key,
        environment: payload.environment,
      });
    } catch (err) {
      if (err instanceof SpedyApiError) {
        return jsonResponse(err.status === 429 ? 429 : 400, { error: `Não foi possível validar a chave: ${err.message}` });
      }
      throw err;
    }

    const { error: secretsError } = await supabase
      .from("fiscal_secrets")
      .upsert({ restaurant_id: payload.restaurant_id, spedy_api_key: payload.api_key }, { onConflict: "restaurant_id" });
    if (secretsError) throw secretsError;

    const { data: existingSecrets } = await supabase
      .from("fiscal_secrets")
      .select("webhook_secret")
      .eq("restaurant_id", payload.restaurant_id)
      .single();

    const { error: configError } = await supabase
      .from("fiscal_config")
      .upsert(
        {
          restaurant_id: payload.restaurant_id,
          provider: "spedy",
          environment: payload.environment,
          cnpj: payload.cnpj.replace(/\D/g, ""),
          razao_social: payload.razao_social,
          nome_fantasia: payload.nome_fantasia || null,
          inscricao_estadual: payload.inscricao_estadual,
          regime_tributario: payload.regime_tributario,
          cep: payload.cep.replace(/\D/g, ""),
          logradouro: payload.logradouro,
          numero: payload.numero,
          complemento: payload.complemento || null,
          bairro: payload.bairro,
          cidade: payload.cidade,
          uf: payload.uf,
          default_ncm: payload.default_ncm || "21069090",
          default_cfop: "5102",
          auto_issue_mode: payload.auto_issue_mode || "manual",
          is_configured: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id" }
      );
    if (configError) throw configError;

    let webhookWarning: string | null = null;
    try {
      await registerSpedyWebhook(
        supabase,
        payload.restaurant_id,
        payload.api_key,
        payload.environment,
        existingSecrets?.webhook_secret ?? ""
      );
    } catch (err) {
      // Não bloqueia o cadastro por falha no webhook — o job de polling
      // (spedy-poll-invoice-status) cobre a reconciliação de qualquer forma.
      webhookWarning = err instanceof Error ? err.message : "Falha ao registrar webhook na Spedy.";
    }

    return jsonResponse(200, { success: true, webhook_warning: webhookWarning });
  } catch (err) {
    console.error("[spedy-save-config] error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return jsonResponse(500, { error: message });
  }
});
