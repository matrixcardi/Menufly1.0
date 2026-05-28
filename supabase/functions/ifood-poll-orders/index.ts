import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[IFOOD-POLL] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const IFOOD_BASE = "https://merchant-api.ifood.com.br";

async function refreshToken(): Promise<{ token: string; expires_at: string }> {
  const clientId = Deno.env.get("IFOOD_CLIENT_ID")!;
  const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET")!;
  const body = new URLSearchParams({
    grantType: "client_credentials",
    clientId,
    clientSecret,
  });
  const res = await fetch(`${IFOOD_BASE}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.accessToken) throw new Error("Failed to refresh iFood token");
  return {
    token: data.accessToken,
    expires_at: new Date(Date.now() + (data.expiresIn - 60) * 1000).toISOString(),
  };
}

function mapPaymentMethod(ifoodMethod: string | undefined): { method: string; status: string } {
  const m = (ifoodMethod || "").toUpperCase();
  if (m.includes("CASH") || m.includes("DINHEIRO")) return { method: "cash", status: "pending" };
  if (m.includes("CREDIT") || m.includes("DEBIT") || m.includes("CARD")) return { method: "card", status: "paid" };
  if (m.includes("PIX")) return { method: "pix", status: "paid" };
  // iFood online payments are pre-paid
  return { method: "card", status: "paid" };
}

function mapStatus(ifoodStatus: string | undefined): string {
  const s = (ifoodStatus || "").toUpperCase();
  if (["CONCLUDED", "DELIVERED"].includes(s)) return "delivered";
  if (["CANCELLED", "CANCELED"].includes(s)) return "cancelled";
  if (["DISPATCHED", "READY_TO_PICKUP"].includes(s)) return "out_for_delivery";
  if (["CONFIRMED", "PLACED", "INTEGRATED"].includes(s)) return "preparing";
  return "pending";
}

async function processIntegration(supabase: any, integ: any) {
  let token = integ.access_token;
  let expiresAt = integ.token_expires_at;

  // Refresh token if expired or missing
  if (!token || !expiresAt || new Date(expiresAt) < new Date()) {
    const fresh = await refreshToken();
    token = fresh.token;
    expiresAt = fresh.expires_at;
    await supabase
      .from("platform_integrations")
      .update({ access_token: token, token_expires_at: expiresAt })
      .eq("id", integ.id);
  }

  // Poll events for this merchant
  const eventsRes = await fetch(
    `${IFOOD_BASE}/order/v1.0/events:polling?merchantIds=${integ.merchant_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (eventsRes.status === 204) {
    // No events
    await supabase.from("platform_integrations").update({ last_sync_at: new Date().toISOString() }).eq("id", integ.id);
    return { merchant: integ.merchant_id, events: 0 };
  }

  if (!eventsRes.ok) {
    const txt = await eventsRes.text();
    log("Events fetch failed", { merchant: integ.merchant_id, status: eventsRes.status, txt });
    await supabase.from("platform_integrations").update({ last_error: `Events ${eventsRes.status}: ${txt.slice(0,200)}` }).eq("id", integ.id);
    return { merchant: integ.merchant_id, error: eventsRes.status };
  }

  const events: any[] = await eventsRes.json();
  const ackIds = events.map((e) => ({ id: e.id })).filter((x) => x.id);
  let inserted = 0;

  for (const evt of events) {
    try {
      // We mostly care about full PLC (placed) events to create the order
      if (evt.fullCode === "PLC" || evt.code === "PLC" || evt.code === "PLACED") {
        // Fetch order detail
        const detailRes = await fetch(`${IFOOD_BASE}/order/v1.0/orders/${evt.orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!detailRes.ok) {
          log("Order detail failed", { orderId: evt.orderId, status: detailRes.status });
          continue;
        }
        const order = await detailRes.json();

        const customer = order.customer || {};
        const delivery = order.delivery || {};
        const addr = delivery.deliveryAddress || {};
        const payments = order.payments?.methods || order.payments || [];
        const firstPayment = Array.isArray(payments) ? payments[0] : payments;
        const pm = mapPaymentMethod(firstPayment?.method || firstPayment?.code);

        const items = (order.items || []).map((it: any) => ({
          name: it.name,
          price: Number(it.unitPrice || it.price || 0),
          quantity: Number(it.quantity || 1),
          notes: it.observations || null,
          addons: (it.options || []).map((op: any) => ({
            name: op.name, price: Number(op.price || 0), quantity: Number(op.quantity || 1),
          })),
        }));

        const subtotal = Number(order.total?.subTotal || order.subTotal || 0);
        const deliveryFee = Number(order.total?.deliveryFee || order.deliveryFee || 0);
        const discount = Number(order.total?.benefits || order.benefits || 0);
        const total = Number(order.total?.orderAmount || order.totalPrice || subtotal + deliveryFee - discount);

        const addressStr = [addr.formattedAddress, addr.streetName, addr.streetNumber, addr.neighborhood, addr.city]
          .filter(Boolean).join(", ").slice(0, 500);

        const ifoodNumber = order.displayId || order.shortId || evt.orderId.slice(0, 6).toUpperCase();

        const { error: insErr } = await supabase.from("orders").insert({
          restaurant_id: integ.restaurant_id,
          source: "ifood",
          external_id: evt.orderId,
          external_data: order,
          order_number: `IFOOD-${ifoodNumber}`,
          customer_name: customer.name || "Cliente iFood",
          customer_phone: customer.phone?.number || customer.phone || "00000000000",
          customer_address: addressStr || null,
          delivery_type: order.orderType === "TAKEOUT" ? "pickup" : "delivery",
          payment_method: pm.method,
          payment_status: pm.status,
          status: "pending",
          subtotal,
          discount,
          delivery_fee: deliveryFee,
          total,
          items,
          notes: order.observations || null,
        });

        if (insErr) {
          // Likely duplicate (unique on source+external_id)
          if (!String(insErr.message).includes("duplicate")) {
            log("Insert failed", { orderId: evt.orderId, err: insErr.message });
          }
        } else {
          inserted++;
        }
      } else if (["CAN", "CANCELLED", "CANCELED"].includes((evt.fullCode || evt.code || "").toUpperCase())) {
        await supabase
          .from("orders")
          .update({ status: "cancelled", cancellation_reason: "Cancelado no iFood" })
          .eq("source", "ifood")
          .eq("external_id", evt.orderId);
      } else if (evt.code) {
        // Update existing order status for known transitions
        const newStatus = mapStatus(evt.fullCode || evt.code);
        if (newStatus !== "pending") {
          await supabase.from("orders").update({ status: newStatus }).eq("source", "ifood").eq("external_id", evt.orderId);
        }
      }
    } catch (e) {
      log("Event processing error", { evt, err: e instanceof Error ? e.message : String(e) });
    }
  }

  // Acknowledge events to prevent re-delivery
  if (ackIds.length > 0) {
    await fetch(`${IFOOD_BASE}/order/v1.0/events/acknowledgment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(ackIds),
    });
  }

  await supabase
    .from("platform_integrations")
    .update({ last_sync_at: new Date().toISOString(), last_error: null })
    .eq("id", integ.id);

  return { merchant: integ.merchant_id, events: events.length, inserted };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: integrations, error } = await supabase
      .from("platform_integrations")
      .select("id, restaurant_id, merchant_id, access_token, token_expires_at")
      .eq("platform", "ifood")
      .eq("status", "connected")
      .not("merchant_id", "is", null);

    if (error) throw error;

    const results = [];
    for (const integ of integrations || []) {
      try {
        results.push(await processIntegration(supabase, integ));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("Integration failed", { merchant: integ.merchant_id, err: msg });
        await supabase.from("platform_integrations").update({ last_error: msg.slice(0, 300) }).eq("id", integ.id);
        results.push({ merchant: integ.merchant_id, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("FATAL", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});