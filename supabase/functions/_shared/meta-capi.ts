// Meta Conversions API — Purchase disparado pelo servidor quando o pagamento
// online é confirmado. O event_id é o mesmo que o navegador usa no fbq
// (purchase-<order_id>), então a Meta deduplica os dois envios.

const META_API_URL = "https://graph.facebook.com/v21.0";
const META_TIMEOUT_MS = 3000;

export interface MetaContext {
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
}

interface BrowserMeta {
  fbp?: string;
  fbc?: string;
  source_url?: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[META-CAPI] ${step}${detailsStr}`);
};

export function purchaseEventId(orderId: string): string {
  return `purchase-${orderId}`;
}

// Junta os headers da requisição com o contexto que o navegador manda no body
// (cookies _fbp/_fbc e URL da página), que o servidor não consegue ver sozinho.
export function buildMetaContext(req: Request, meta?: BrowserMeta | null): MetaContext {
  return {
    clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
    fbp: meta?.fbp || undefined,
    fbc: meta?.fbc || undefined,
    sourceUrl: meta?.source_url || undefined,
  };
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Mesma regra de src/lib/meta-pixel.ts — o hash precisa bater com o do navegador.
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith("55")) cleaned = "55" + cleaned;
  return cleaned;
}

// Nunca lança: tracking não pode derrubar a confirmação do pagamento.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- client sem tipos gerados, igual às funções que chamam
export async function sendPurchaseEvent(supabaseAdmin: any, orderId: string, ctx: MetaContext): Promise<void> {
  const eventId = purchaseEventId(orderId);

  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, restaurant_id, customer_name, customer_phone, items")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      logStep("Order not found, skipping", { order_id: orderId });
      return;
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("meta_pixel_id, meta_access_token")
      .eq("id", order.restaurant_id)
      .maybeSingle();

    if (!restaurant?.meta_pixel_id || !restaurant?.meta_access_token) {
      return;
    }

    const userData: Record<string, string> = {
      country: await sha256("br"),
    };
    if (order.customer_phone) {
      const phoneHash = await sha256(normalizePhone(order.customer_phone));
      userData.ph = phoneHash;
      userData.external_id = phoneHash;
    }
    if (order.customer_name) {
      const parts = order.customer_name.trim().split(/\s+/);
      userData.fn = await sha256(parts[0]);
      if (parts.length > 1) userData.ln = await sha256(parts.slice(1).join(" "));
    }
    if (ctx.clientIp) userData.client_ip_address = ctx.clientIp;
    if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
    if (ctx.fbp) userData.fbp = ctx.fbp;
    if (ctx.fbc) userData.fbc = ctx.fbc;

    const items = Array.isArray(order.items) ? order.items : [];
    const contentIds = items
      .map((item: { productId?: unknown } | null) => item?.productId)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);

    const customData: Record<string, unknown> = {
      value: Number(order.total),
      currency: "BRL",
      num_items: items.length,
      content_type: "product",
      order_id: order.order_number,
    };
    if (contentIds.length > 0) customData.content_ids = contentIds;

    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: ctx.sourceUrl,
          user_data: userData,
          custom_data: customData,
        },
      ],
    };

    const response = await fetch(
      `${META_API_URL}/${restaurant.meta_pixel_id}/events?access_token=${restaurant.meta_access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(META_TIMEOUT_MS),
      },
    );

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      logStep("Meta API error", { event_id: eventId, status: response.status, error: result?.error?.message });
      return;
    }

    logStep("Purchase sent", { event_id: eventId, events_received: result?.events_received });
  } catch (error) {
    logStep("Failed to send Purchase", {
      event_id: eventId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
