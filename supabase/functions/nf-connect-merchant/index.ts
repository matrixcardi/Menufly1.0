// Conexão de loja com o 99Food (fluxo self-service em duas etapas):
//   action 'start'  → gera a URL de autorização (válida 7 dias) que o lojista abre
//   action 'verify' → checa se a loja autorizou (consegue auth_token) e finaliza
// O webhook shopBindStatus também finaliza a conexão automaticamente quando
// o lojista autoriza — o 'verify' é o caminho manual pelo painel.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  ensureAuthToken,
  getNfCredentials,
  NfApiError,
  nfApi,
  signParams,
  type NfIntegration,
} from "../_shared/nine9food.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[NF-CONNECT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "").trim()
    );
    if (claimsErr || !claims?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { restaurant_id, action } = await req.json();
    if (!restaurant_id || !["start", "verify"].includes(action)) {
      return json({ error: "restaurant_id and action ('start' | 'verify') are required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify ownership
    const { data: rest } = await supabase
      .from("restaurants")
      .select("id, user_id")
      .eq("id", restaurant_id)
      .maybeSingle();
    if (!rest) {
      return json({ error: "Restaurante não encontrado" }, 404);
    }

    const { data: existing } = await supabase
      .from("platform_integrations")
      .select("id, restaurant_id, access_token, token_expires_at, merchant_id, status, metadata")
      .eq("restaurant_id", restaurant_id)
      .eq("platform", "99food")
      .maybeSingle();

    if (action === "start") {
      const { appId, appSecret } = getNfCredentials();
      const params = { app_id: appId };
      const sign = await signParams(params, appSecret);
      const data = await nfApi("/v1/auth/authorizationpage/getUrl", {
        method: "POST",
        body: { ...params, sign },
      });

      let authUrl: string = data?.url || data?.auth_url || data?.authorization_url || "";
      if (!authUrl) throw new Error("Resposta do 99Food sem URL de autorização");

      // Vincula a URL à loja: app_shop_id é o NOSSO identificador (restaurant_id)
      // — comportamento a confirmar na homologação
      if (!authUrl.includes("app_shop_id=")) {
        authUrl += `${authUrl.includes("?") ? "&" : "?"}app_shop_id=${restaurant_id}`;
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const payload = {
        restaurant_id,
        platform: "99food",
        status: "pending",
        last_error: null,
        metadata: { auth_url: authUrl, auth_url_expires_at: expiresAt },
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from("platform_integrations")
          .update({ ...payload, metadata: { ...(existing.metadata || {}), ...payload.metadata } })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("platform_integrations").insert(payload);
        if (error) throw error;
      }

      log("Auth URL generated", { restaurant_id });
      return json({ success: true, auth_url: authUrl });
    }

    // action === 'verify'
    if (!existing) {
      return json({ success: false, pending: true, message: "Gere o link de autorização primeiro." });
    }

    try {
      const token = await ensureAuthToken(supabase, existing as NfIntegration);
      const detail = await nfApi("/v1/shop/shop/detail", { query: { auth_token: token } });
      const merchantName: string = detail?.shop_name || detail?.name || "Loja 99Food";

      const { error } = await supabase
        .from("platform_integrations")
        .update({
          merchant_id: detail?.shop_id ? String(detail.shop_id) : existing.merchant_id,
          merchant_name: merchantName,
          status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw error;

      log("Connected", { restaurant_id, merchantName });
      return json({ success: true, merchant_name: merchantName });
    } catch (e) {
      // Loja ainda não autorizou (sem token disponível) → pendente, não é erro
      if (e instanceof NfApiError) {
        log("Verify pending", { restaurant_id, errno: e.errno, errmsg: e.errmsg });
        return json({ success: false, pending: true });
      }
      throw e;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return json({ error: msg }, 500);
  }
});
