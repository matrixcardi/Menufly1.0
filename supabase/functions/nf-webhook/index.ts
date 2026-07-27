// Webhook único do 99Food (verify_jwt = false).
// URL configurada no portal do 99Food: https://<ref>.supabase.co/functions/v1/nf-webhook
//
// Contrato do 99Food: timeout de 6s e resposta obrigatória {"errno":0,"errmsg":"ok"} —
// qualquer outra resposta faz o 99Food reenviar o evento. Por isso TODO erro interno
// é logado e respondido com ok; o único caso de não-ok é assinatura inválida (401).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  buildOrderRow,
  ensureAuthToken,
  getNfCredentials,
  isNfAlreadyInStateError,
  mapNfStatus,
  NfApiError,
  NF_ERRNO_TOKEN_EXPIRED,
  nfApi,
  nfCancelReasonText,
  nfOrderPost,
  parseNfJson,
  verifyWebhookSignature,
  type NfIntegration,
} from "../_shared/nine9food.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[NF-WEBHOOK] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const ok = () =>
  new Response(JSON.stringify({ errno: 0, errmsg: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });

const unauthorized = () =>
  new Response(JSON.stringify({ errno: 401, errmsg: "invalid signature" }), {
    status: 401, headers: { "Content-Type": "application/json" },
  });

// Executa em background após responder — o 99Food exige resposta rápida (<6s)
const waitUntil = (p: Promise<unknown>) => {
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(p.catch((e) => log("Background error", { err: String(e) })));
  else p.catch((e) => log("Background error", { err: String(e) }));
};

type SupabaseAdmin = ReturnType<typeof createClient>;

async function getIntegration(supabase: SupabaseAdmin, restaurantId: string): Promise<NfIntegration | null> {
  const { data } = await supabase
    .from("platform_integrations")
    .select("id, restaurant_id, access_token, token_expires_at, merchant_id, status")
    .eq("restaurant_id", restaurantId)
    .eq("platform", "99food")
    .maybeSingle();
  return data as NfIntegration | null;
}

async function findLocalOrder(supabase: SupabaseAdmin, externalId: string) {
  const { data } = await supabase
    .from("orders")
    .select("id, status, notes, external_data, restaurant_id")
    .eq("source", "99food")
    .eq("external_id", externalId)
    .maybeSingle();
  return data;
}

// Merge raso do payload do evento em external_data, preservando o pedido original
async function mergeExternalData(supabase: SupabaseAdmin, order: any, key: string, value: unknown) {
  const merged = { ...(order.external_data || {}), [key]: value };
  await supabase.from("orders").update({ external_data: merged }).eq("id", order.id);
}

async function touchLastSync(supabase: SupabaseAdmin, integrationId: string) {
  await supabase
    .from("platform_integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integrationId);
}

// Auto-confirm com 1 retry em token expirado; falha persistente marca o pedido e a integração
async function confirmOrder(supabase: SupabaseAdmin, integ: NfIntegration, orderIdStr: string) {
  const attempt = async () => {
    const token = await ensureAuthToken(supabase, integ);
    await nfOrderPost("/v1/order/order/confirm", token, orderIdStr);
  };

  try {
    try {
      await attempt();
    } catch (e) {
      if (isNfAlreadyInStateError(e)) return;
      if (e instanceof NfApiError && e.errno === NF_ERRNO_TOKEN_EXPIRED) {
        // Token inválido no lado deles: força renovação e tenta uma vez mais
        integ.access_token = null;
        integ.token_expires_at = null;
        await attempt();
        return;
      }
      throw e;
    }
    log("Order confirmed", { order: orderIdStr });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("Confirm FAILED", { order: orderIdStr, err: msg });
    await supabase
      .from("platform_integrations")
      .update({ last_error: `Confirm ${orderIdStr}: ${msg.slice(0, 250)}` })
      .eq("id", integ.id);
    // Reenvio do webhook re-tenta o confirm; se nada funcionar em 5 min o 99Food
    // cancela e o orderCancel cancela o pedido local. Avisa o lojista via notes.
    const order = await findLocalOrder(supabase, orderIdStr);
    if (order && !String(order.notes || "").includes("CONFIRMAÇÃO AUTOMÁTICA FALHOU")) {
      const warning = "⚠️ CONFIRMAÇÃO AUTOMÁTICA FALHOU — confirme no app 99Food";
      await supabase
        .from("orders")
        .update({ notes: order.notes ? `${warning} | ${order.notes}` : warning })
        .eq("id", order.id);
    }
  }
}

async function handleOrderNew(supabase: SupabaseAdmin, appShopId: string, orderInfo: any) {
  const integ = await getIntegration(supabase, appShopId);
  if (!integ) {
    log("Integration not found for orderNew", { appShopId });
    return;
  }

  const orderIdStr = String(orderInfo?.order_id ?? "");
  if (!orderIdStr) {
    log("orderNew without order_id");
    return;
  }

  const row = buildOrderRow(orderInfo, integ.restaurant_id);
  const { error: insErr } = await supabase.from("orders").insert(row);

  if (insErr) {
    if (String(insErr.message).includes("duplicate")) {
      // Reenvio do webhook: re-tenta o confirm apenas se o pedido segue pendente
      const existing = await findLocalOrder(supabase, orderIdStr);
      if (existing?.status !== "pending") return;
    } else {
      log("Insert failed", { order: orderIdStr, err: insErr.message });
      return;
    }
  }

  await touchLastSync(supabase, integ.id);
  waitUntil(confirmOrder(supabase, integ, orderIdStr));
}

async function handleOrderCancel(supabase: SupabaseAdmin, data: any, orderInfo: any) {
  const orderIdStr = String(orderInfo?.order_id ?? data?.order_id ?? "");
  if (!orderIdStr) return;
  const statusCode = Number(orderInfo?.status ?? data?.status ?? 0);
  const reason = data?.reason || orderInfo?.cancel_reason ||
    (statusCode >= 900 ? nfCancelReasonText(statusCode) : "Cancelado no 99Food");

  await supabase
    .from("orders")
    .update({ status: "cancelled", cancellation_reason: reason })
    .eq("source", "99food")
    .eq("external_id", orderIdStr);
  log("Order cancelled", { order: orderIdStr, reason });
}

async function handleOrderFinish(supabase: SupabaseAdmin, data: any, orderInfo: any) {
  const orderIdStr = String(orderInfo?.order_id ?? data?.order_id ?? "");
  if (!orderIdStr) return;
  await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("source", "99food")
    .eq("external_id", orderIdStr);
}

async function handleDeliveryStatus(supabase: SupabaseAdmin, data: any, orderInfo: any) {
  const orderIdStr = String(orderInfo?.order_id ?? data?.order_id ?? "");
  if (!orderIdStr) return;
  const order = await findLocalOrder(supabase, orderIdStr);
  if (!order) return;

  // Guarda os dados do entregador para exibição/debug
  await mergeExternalData(supabase, order, "delivery_status", data);

  if (order.status === "cancelled" || order.status === "delivered") return;
  const statusCode = Number(data?.order_status ?? data?.status ?? orderInfo?.status ?? 0);
  const mapped = mapNfStatus(statusCode);
  if (mapped === "out_for_delivery" || mapped === "delivered") {
    await supabase.from("orders").update({ status: mapped }).eq("id", order.id);
  }
}

// orderConfirm/orderReady normalmente são eco das nossas próprias chamadas —
// não sobrescrevem o Kanban. Exceção: orderReady quando o pedido local ainda está
// pending/preparing significa que o lojista usou o app do 99Food → sincroniza.
async function handleOrderEcho(supabase: SupabaseAdmin, type: string, appShopId: string | null, data: any, orderInfo: any) {
  const orderIdStr = String(orderInfo?.order_id ?? data?.order_id ?? "");
  if (!orderIdStr) return;
  const order = await findLocalOrder(supabase, orderIdStr);
  if (!order) return;

  await mergeExternalData(supabase, order, `last_${type}`, data);

  const restaurantId = appShopId || order.restaurant_id;
  const integ = await getIntegration(supabase, restaurantId);
  if (integ) await touchLastSync(supabase, integ.id);

  if (type === "orderReady" && ["pending", "preparing"].includes(order.status)) {
    await supabase.from("orders").update({ status: "ready" }).eq("id", order.id);
  }
}

async function handleShopBindStatus(supabase: SupabaseAdmin, appShopId: string | null, data: any) {
  const list: string[] = (data?.appShopIDList || data?.app_shop_id_list || (appShopId ? [appShopId] : []))
    .map((v: unknown) => String(v));
  const bindRaw = data?.bind_status ?? data?.bindStatus ?? data?.status ?? "";
  const isUnbind = String(bindRaw).toLowerCase().includes("unbind") || Number(bindRaw) === 2;

  for (const restaurantId of list) {
    const integ = await getIntegration(supabase, restaurantId);

    if (isUnbind) {
      if (integ) {
        await supabase
          .from("platform_integrations")
          .update({
            status: "disconnected",
            access_token: null,
            token_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integ.id);
        log("Shop unbound", { restaurantId });
      }
      continue;
    }

    // Bind: garante a linha da integração (o fluxo de conexão já cria como pending)
    let integration = integ;
    if (!integration) {
      const { data: rest } = await supabase
        .from("restaurants").select("id").eq("id", restaurantId).maybeSingle();
      if (!rest) {
        log("Bind for unknown restaurant", { restaurantId });
        continue;
      }
      const { data: created, error } = await supabase
        .from("platform_integrations")
        .insert({ restaurant_id: restaurantId, platform: "99food", status: "pending" })
        .select("id, restaurant_id, access_token, token_expires_at, merchant_id, status")
        .single();
      if (error) {
        log("Bind insert failed", { restaurantId, err: error.message });
        continue;
      }
      integration = created as NfIntegration;
    }

    try {
      const token = await ensureAuthToken(supabase, integration!);
      const detail = await nfApi("/v1/shop/shop/detail", { query: { auth_token: token } });
      await supabase
        .from("platform_integrations")
        .update({
          merchant_id: detail?.shop_id ? String(detail.shop_id) : integration!.merchant_id,
          merchant_name: detail?.shop_name || detail?.name || null,
          status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration!.id);
      log("Shop bound", { restaurantId, shopId: detail?.shop_id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("Bind finalize failed", { restaurantId, err: msg });
      await supabase
        .from("platform_integrations")
        .update({ last_error: `Bind: ${msg.slice(0, 250)}` })
        .eq("id", integration!.id);
    }
  }
}

// Fase 2: cliente pediu cancelamento/reembolso — sem ação automática por enquanto
// (o 99Food auto-recusa cancelamento / auto-aceita refund por padrão). Só avisa o lojista.
async function handleCustomerApply(supabase: SupabaseAdmin, type: string, data: any, orderInfo: any) {
  const orderIdStr = String(orderInfo?.order_id ?? data?.order_id ?? "");
  if (!orderIdStr) return;
  const order = await findLocalOrder(supabase, orderIdStr);
  if (!order) return;

  await mergeExternalData(supabase, order, `last_${type}`, data);

  const warning = type === "orderCancelApply"
    ? "⚠️ Cliente solicitou cancelamento — responda no app 99Food em 5 min"
    : "⚠️ Cliente solicitou reembolso — verifique no app 99Food";
  if (!String(order.notes || "").includes(warning)) {
    await supabase
      .from("orders")
      .update({ notes: order.notes ? `${warning} | ${order.notes}` : warning })
      .eq("id", order.id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return ok();

  let rawBody = "";
  try {
    rawBody = await req.text();
    const { appId, appSecret } = getNfCredentials();

    const validSignature = await verifyWebhookSignature(
      rawBody,
      req.headers.get("didi-header-sign"),
      appSecret,
    );
    if (!validSignature) {
      log("Invalid signature");
      return unauthorized();
    }

    const payload = parseNfJson(rawBody);
    const type: string = payload?.type || payload?.event_type || "";
    const data = payload?.data ?? {};
    const orderInfo = data?.order_info ?? data;
    const appShopId: string | null =
      (payload?.app_shop_id ?? data?.app_shop_id ?? orderInfo?.app_shop_id)
        ? String(payload?.app_shop_id ?? data?.app_shop_id ?? orderInfo?.app_shop_id)
        : null;

    if (payload?.app_id && String(payload.app_id) !== appId) {
      log("app_id mismatch", { received: String(payload.app_id) });
      return ok();
    }

    log("Event", { type, appShopId, orderId: orderInfo?.order_id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (type) {
      case "orderNew":
        if (appShopId) await handleOrderNew(supabase, appShopId, orderInfo);
        else log("orderNew without app_shop_id");
        break;
      case "orderCancel":
      case "orderPartialCancel":
        await handleOrderCancel(supabase, data, orderInfo);
        break;
      case "orderFinish":
        await handleOrderFinish(supabase, data, orderInfo);
        break;
      case "deliveryStatus":
        await handleDeliveryStatus(supabase, data, orderInfo);
        break;
      case "orderConfirm":
      case "orderReady":
        await handleOrderEcho(supabase, type, appShopId, data, orderInfo);
        break;
      case "shopBindStatus":
        await handleShopBindStatus(supabase, appShopId, data);
        break;
      case "orderCancelApply":
      case "orderRefundApply":
        await handleCustomerApply(supabase, type, data, orderInfo);
        break;
      default:
        log("Unhandled event type", { type });
    }

    return ok();
  } catch (e) {
    // Nunca 500: o 99Food reenviaria o evento indefinidamente
    log("ERROR", { err: e instanceof Error ? e.message : String(e), body: rawBody.slice(0, 300) });
    return ok();
  }
});
