// Push-back de ações do Kanban para o 99Food: ready | delivered | cancel.
// Não atualiza o status local — o frontend já fez o update otimista
// (mesmo contrato de lavem-dispatch/refund-payment em useLiveOrders).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  ensureAuthToken,
  isNfAlreadyInStateError,
  NfApiError,
  NF_ERRNO_TOKEN_EXPIRED,
  nfOrderPost,
  type NfIntegration,
} from "../_shared/nine9food.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[NF-ORDER-ACTION] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Cancelamento exige reason_id — 1080 = "outro" (motivo em texto livre)
const CANCEL_REASON_OTHER = 1080;

const ACTION_PATHS: Record<string, string> = {
  ready: "/v1/order/order/ready",
  delivered: "/v1/order/order/delivered",
  cancel: "/v1/order/order/cancel",
};

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

    const { restaurant_id, order_id, action, reason } = await req.json();
    if (!restaurant_id || !order_id || !ACTION_PATHS[action]) {
      return json({ error: "restaurant_id, order_id and action ('ready' | 'delivered' | 'cancel') are required" }, 400);
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

    const { data: order } = await supabase
      .from("orders")
      .select("id, external_id, external_data, source")
      .eq("id", order_id)
      .eq("restaurant_id", restaurant_id)
      .eq("source", "99food")
      .maybeSingle();
    if (!order?.external_id) {
      return json({ error: "Pedido 99Food não encontrado" }, 404);
    }

    // 'delivered' na API só vale para entrega própria da loja (delivery_type 2);
    // entregas da 99 (delivery_type 1) são concluídas pelo entregador deles
    if (action === "delivered" && Number((order.external_data as any)?.delivery_type) !== 2) {
      return json({ success: true, skipped: true });
    }

    const { data: integ } = await supabase
      .from("platform_integrations")
      .select("id, restaurant_id, access_token, token_expires_at, merchant_id, status")
      .eq("restaurant_id", restaurant_id)
      .eq("platform", "99food")
      .maybeSingle();
    if (!integ) {
      return json({ error: "Integração 99Food não encontrada" }, 404);
    }

    const extra = action === "cancel"
      ? { reason_id: CANCEL_REASON_OTHER, reason: String(reason || "Cancelado pelo restaurante").slice(0, 200) }
      : {};

    const attempt = async () => {
      const token = await ensureAuthToken(supabase, integ as NfIntegration);
      await nfOrderPost(ACTION_PATHS[action], token, String(order.external_id), extra);
    };

    try {
      await attempt();
    } catch (e) {
      if (isNfAlreadyInStateError(e)) {
        // Pedido já está nesse status no 99Food → idempotente, sucesso
        return json({ success: true, already: true });
      }
      if (e instanceof NfApiError && e.errno === NF_ERRNO_TOKEN_EXPIRED) {
        (integ as NfIntegration).access_token = null;
        (integ as NfIntegration).token_expires_at = null;
        await attempt();
      } else {
        throw e;
      }
    }

    log("Action sent", { action, order: order.external_id });
    return json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return json({ error: msg }, 500);
  }
});
