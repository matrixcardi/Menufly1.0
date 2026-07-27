// Cliente compartilhado para a API do 99Food (99Food Protocol / DiDi).
// Doc: https://developer-food.99app.com/pt-BR/openapi
//
// Convenções da API:
// - Respostas sempre no formato { errno, errmsg, data } (errno 0 = sucesso)
// - IDs são int64 de até 19 dígitos — JSON.parse perde precisão, usar parseNfJson
// - Valores monetários em centavos (int)
// - Assinatura de webhook: didi-header-sign = MD5(rawBody + app_secret)

import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { toHashString } from "https://deno.land/std@0.190.0/crypto/to_hash_string.ts";

export const NINE9FOOD_BASE = Deno.env.get("NINE9FOOD_BASE") || "https://openapi.99food.com";

export function getNfCredentials(): { appId: string; appSecret: string } {
  const appId = Deno.env.get("NINE9FOOD_APP_ID");
  const appSecret = Deno.env.get("NINE9FOOD_APP_SECRET");
  if (!appId || !appSecret) throw new Error("Credenciais do 99Food não configuradas na plataforma");
  return { appId, appSecret };
}

// WebCrypto não expõe MD5 — o std do Deno fornece via WASM
export async function md5Hex(input: string): Promise<string> {
  return toHashString(await crypto.subtle.digest("MD5", new TextEncoder().encode(input)));
}

// Assinatura de parâmetros app-level: ordena chaves (ASCII), junta k=v com &,
// concatena o app_secret e aplica MD5 hex.
export async function signParams(params: Record<string, string | number>, secret: string): Promise<string> {
  const joined = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return md5Hex(joined + secret);
}

export async function verifyWebhookSignature(
  rawBody: string,
  headerSign: string | null,
  secret: string,
): Promise<boolean> {
  if (!headerSign) return false;
  const expected = await md5Hex(rawBody + secret);
  return expected.toLowerCase() === headerSign.trim().toLowerCase();
}

// Parse bigint-safe: quota os campos de ID int64 no texto cru antes do JSON.parse,
// senão order_id de 19 dígitos perde precisão silenciosamente.
const ID_FIELDS_RE = /"(order_id|shop_id|app_id|sub_order_id|delivery_id|rider_id)"\s*:\s*(\d+)/g;

export function parseNfJson(raw: string): any {
  return JSON.parse(raw.replace(ID_FIELDS_RE, '"$1":"$2"'));
}

export class NfApiError extends Error {
  errno: number;
  errmsg: string;

  constructor(errno: number, errmsg: string) {
    super(`99Food errno ${errno}: ${errmsg}`);
    this.name = "NfApiError";
    this.errno = errno;
    this.errmsg = errmsg;
  }
}

// Errnos conhecidos
export const NF_ERRNO_TOKEN_EXPIRED = 10102;

interface NfApiOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number>;
  body?: Record<string, unknown>;
  // Corpo JSON pré-serializado — fallback para enviar order_id numérico
  // sem passar pelo JSON.stringify (que não aceita bigint)
  rawBody?: string;
  timeoutMs?: number;
}

// fetch → parse bigint-safe → errno ≠ 0 lança NfApiError. Retorna response.data.
export async function nfApi(path: string, options: NfApiOptions = {}): Promise<any> {
  const { method = "GET", query, body, rawBody, timeoutMs = 10000 } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = new URL(`${NINE9FOOD_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/json" },
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = parseNfJson(text);
    } catch {
      throw new NfApiError(res.status || -1, `Resposta inválida do 99Food: ${text.slice(0, 200)}`);
    }

    if (typeof parsed?.errno === "number" && parsed.errno !== 0) {
      throw new NfApiError(parsed.errno, parsed.errmsg || "Erro 99Food");
    }
    if (!res.ok) {
      throw new NfApiError(res.status, parsed?.errmsg || `HTTP ${res.status}`);
    }
    return parsed?.data ?? parsed;
  } catch (err) {
    if (err instanceof NfApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new NfApiError(408, "Tempo limite excedido ao contatar o 99Food.");
    }
    throw new NfApiError(0, err instanceof Error ? err.message : "Erro desconhecido ao contatar o 99Food.");
  } finally {
    clearTimeout(timeout);
  }
}

export interface NfIntegration {
  id: string;
  restaurant_id: string;
  access_token: string | null;
  token_expires_at: string | null;
  merchant_id?: string | null;
}

async function fetchAuthToken(appShopId: string): Promise<{ token: string; expiresAt: string }> {
  const { appId, appSecret } = getNfCredentials();
  const params = { app_id: appId, app_shop_id: appShopId };
  const sign = await signParams(params, appSecret);
  const data = await nfApi("/v1/auth/authtoken/get", { query: { ...params, sign } });

  const token: string | undefined = data?.auth_token || data?.token;
  if (!token) throw new NfApiError(-1, "Resposta do authtoken/get sem auth_token");

  // expires_in em segundos, expire_time em epoch (s ou ms); fallback 30 min
  let expiresAt: Date;
  if (data.expires_in) {
    expiresAt = new Date(Date.now() + (Number(data.expires_in) - 300) * 1000);
  } else if (data.expire_time) {
    const t = Number(data.expire_time);
    expiresAt = new Date(String(data.expire_time).length > 11 ? t : t * 1000);
  } else {
    expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  }
  return { token, expiresAt: expiresAt.toISOString() };
}

async function refreshAuthToken(appShopId: string): Promise<void> {
  const { appId, appSecret } = getNfCredentials();
  const params = { app_id: appId, app_shop_id: appShopId };
  const sign = await signParams(params, appSecret);
  await nfApi("/v1/auth/authtoken/refresh", { query: { ...params, sign } });
}

// Garante um auth_token válido para a loja (app_shop_id = restaurant_id).
// Persiste em platform_integrations.access_token/token_expires_at.
// O endpoint /get tem rate limit de 1 req/30s — em caso de limite, reusa o token antigo.
export async function ensureAuthToken(supabase: any, integ: NfIntegration): Promise<string> {
  if (
    integ.access_token &&
    integ.token_expires_at &&
    new Date(integ.token_expires_at).getTime() - 60_000 > Date.now()
  ) {
    return integ.access_token;
  }

  let tokenData: { token: string; expiresAt: string };
  try {
    tokenData = await fetchAuthToken(integ.restaurant_id);
  } catch (e) {
    if (e instanceof NfApiError && e.errno === NF_ERRNO_TOKEN_EXPIRED) {
      // Token expirado no lado do 99Food: refresh (cooldown de 2 min) e /get de novo
      await refreshAuthToken(integ.restaurant_id);
      tokenData = await fetchAuthToken(integ.restaurant_id);
    } else if (integ.access_token) {
      // Rate limit ou instabilidade: tenta com o token antigo em vez de falhar
      return integ.access_token;
    } else {
      throw e;
    }
  }

  await supabase
    .from("platform_integrations")
    .update({
      access_token: tokenData.token,
      token_expires_at: tokenData.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integ.id);

  // Reflete no objeto em memória para chamadas subsequentes na mesma invocação
  integ.access_token = tokenData.token;
  integ.token_expires_at = tokenData.expiresAt;
  return tokenData.token;
}

// POST em endpoint de ação de pedido (confirm/ready/delivered/cancel) com auth_token.
// Envia order_id como string; se a API recusar o tipo, refaz com o int64 cru
// via corpo pré-serializado (JSON.stringify não representa int64 sem perder precisão).
export async function nfOrderPost(
  path: string,
  authToken: string,
  orderId: string,
  extra: Record<string, unknown> = {},
): Promise<any> {
  try {
    return await nfApi(path, {
      method: "POST",
      body: { auth_token: authToken, order_id: orderId, ...extra },
    });
  } catch (e) {
    const looksLikeParamError =
      e instanceof NfApiError && /param|invalid|type/i.test(e.errmsg || "") && /^\d+$/.test(orderId);
    if (!looksLikeParamError) throw e;
    const extraJson = Object.entries(extra)
      .map(([k, v]) => `,${JSON.stringify(k)}:${JSON.stringify(v)}`)
      .join("");
    const rawBody = `{"auth_token":${JSON.stringify(authToken)},"order_id":${orderId}${extraJson}}`;
    return await nfApi(path, { method: "POST", rawBody });
  }
}

// A API retorna erro quando o pedido já está no status pedido — para nós isso é sucesso
export function isNfAlreadyInStateError(e: unknown): boolean {
  return e instanceof NfApiError && /already|same\s*state|current\s*status|repeat/i.test(e.errmsg || "");
}

// ---------------------------------------------------------------------------
// Mapeadores 99Food → Menufly
// ---------------------------------------------------------------------------

// Status numérico do pedido: 100 criado, 200 aceito, 400 entregador coletou,
// 500 chegou ao cliente, 600 concluído, 9xx cancelado
export function mapNfStatus(status: number): string {
  if (status >= 900) return "cancelled";
  if (status >= 600) return "delivered";
  if (status >= 400) return "out_for_delivery";
  if (status >= 200) return "preparing";
  return "pending";
}

export function nfCancelReasonText(status: number): string {
  switch (status) {
    case 902: return "Cancelado pelo cliente no 99Food";
    case 921:
    case 923: return "Cancelado pela loja no 99Food";
    case 922: return "Cancelado automaticamente pelo 99Food — pedido não confirmado a tempo";
    case 961: return "Cancelado pelo suporte 99Food";
    case 971:
    case 981: return "Cancelado pelo entregador 99Food";
    default: return `Cancelado no 99Food (código ${status})`;
  }
}

// CHECK de orders.payment_method só aceita cash|card|pix (vale-refeição → card)
export function mapNfPayment(orderInfo: any): { method: string; status: string } {
  const payChannel = Number(orderInfo?.pay_channel ?? 0);
  const payType = Number(orderInfo?.pay_type ?? 0);
  const payMethod = Number(orderInfo?.pay_method ?? 0);

  if (payChannel === 212 || payChannel === 280) return { method: "pix", status: "paid" };
  if (payChannel === 153 || payType === 2) return { method: "cash", status: "pending" };
  if (payType === 3) return { method: "card", status: "pending" }; // maquininha na entrega
  if (payMethod === 1) return { method: "card", status: "paid" }; // online pré-pago
  return { method: "card", status: "pending" };
}

const cents = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v) / 100);

const formatBRL = (v: number): string => `R$ ${v.toFixed(2).replace(".", ",")}`;

// Monta a row de insert em `orders` a partir do order_info do 99Food,
// no mesmo shape usado pelo ifood-poll-orders.
export function buildOrderRow(orderInfo: any, restaurantId: string): Record<string, unknown> {
  const addr = orderInfo?.receive_address || {};

  const customerName: string =
    addr.name ||
    [addr.first_name, addr.last_name].filter(Boolean).join(" ") ||
    [orderInfo?.first_name, orderInfo?.last_name].filter(Boolean).join(" ") ||
    "Cliente 99Food";

  const customerPhone: string =
    addr.virtual_phone_number || addr.phone ||
    orderInfo?.virtual_phone_number || orderInfo?.phone ||
    "00000000000";

  const addressStr = [
    addr.poi_display_name || addr.poi_address,
    addr.street,
    addr.complement,
    addr.reference,
    addr.city,
  ].filter(Boolean).join(", ").slice(0, 500);

  const items = (orderInfo?.order_items || []).map((it: any) => ({
    name: it.name || it.item_name || "Item",
    price: cents(it.sku_price ?? it.price) ?? 0,
    quantity: Number(it.amount ?? it.quantity ?? 1),
    notes: it.remark || null,
    addons: (it.sub_item_list || []).map((sub: any) => ({
      name: sub.name || sub.item_name || "Complemento",
      price: cents(sub.sku_price ?? sub.price) ?? 0,
      quantity: Number(sub.amount ?? sub.quantity ?? 1),
    })),
  }));

  // Cobre os dois price models da API (campos novos e legados)
  const subtotal = cents(orderInfo?.order_price) ?? 0;
  const discount = (cents(orderInfo?.items_discount) ?? 0) + (cents(orderInfo?.delivery_discount) ?? 0);
  const deliveryFee = cents(orderInfo?.delivery_price) ?? 0;
  const totalRaw =
    orderInfo?.customer_need_paying_money ?? orderInfo?.real_pay_price ?? orderInfo?.real_price;
  const total = totalRaw !== null && totalRaw !== undefined
    ? cents(totalRaw)!
    : subtotal + deliveryFee - discount;

  const notesParts: string[] = [];
  if (orderInfo?.remark) notesParts.push(String(orderInfo.remark));
  if (orderInfo?.need_cutlery === 1 || orderInfo?.need_cutlery === true) notesParts.push("Enviar talheres");
  if (orderInfo?.pickup_code) notesParts.push(`Código de retirada: ${orderInfo.pickup_code}`);
  if (orderInfo?.handover_code) notesParts.push(`Código de entrega: ${orderInfo.handover_code}`);
  const changeFor = cents(orderInfo?.change_for);
  if (changeFor && changeFor > 0) notesParts.push(`Troco para ${formatBRL(changeFor)}`);

  const orderId = String(orderInfo?.order_id ?? "");
  const orderNumber = orderInfo?.order_index ?? orderId.slice(-6);
  const isPickup = Number(orderInfo?.fulfillment_mode) === 1;
  const pm = mapNfPayment(orderInfo);

  return {
    restaurant_id: restaurantId,
    source: "99food",
    external_id: orderId,
    external_data: orderInfo,
    order_number: `99FOOD-${orderNumber}`,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: addressStr || null,
    delivery_type: isPickup ? "pickup" : "delivery",
    payment_method: pm.method,
    payment_status: pm.status,
    status: "pending",
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    total,
    items,
    notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
  };
}
