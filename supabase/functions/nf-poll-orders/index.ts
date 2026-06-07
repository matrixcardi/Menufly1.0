import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[NF-POLL] ${s}${d ? " " + JSON.stringify(d) : ""}`);

// TODO: Atualizar com a URL base correta da API do 99food
const NINE9FOOD_BASE = "https://api.99food.com.br"; // PLACEHOLDER - atualizar com URL real

function mapPaymentMethod(nine9foodMethod: string | undefined): { method: string; status: string } {
  const m = (nine9foodMethod || "").toUpperCase();
  if (m.includes("CASH") || m.includes("DINHEIRO")) return { method: "cash", status: "pending" };
  if (m.includes("CREDIT") || m.includes("DEBIT") || m.includes("CARD")) return { method: "card", status: "paid" };
  if (m.includes("PIX")) return { method: "pix", status: "paid" };
  // 99food online payments are pre-paid
  return { method: "card", status: "paid" };
}

function mapStatus(nine9foodStatus: string | undefined): string {
  const s = (nine9foodStatus || "").toUpperCase();
  if (["CONCLUDED", "DELIVERED", "ENTREGUE"].includes(s)) return "delivered";
  if (["CANCELLED", "CANCELED", "CANCELADO"].includes(s)) return "cancelled";
  if (["DISPATCHED", "READY_TO_PICKUP", "SAIU_PARA_ENTREGA", "PRONTO"].includes(s)) return "out_for_delivery";
  if (["CONFIRMED", "PLACED", "INTEGRATED", "CONFIRMADO"].includes(s)) return "preparing";
  return "pending";
}

async function processIntegration(supabase: any, integ: any) {
  const apiToken = integ.api_token;
  const merchantId = integ.merchant_id;

  // TODO: Atualizar com o endpoint correto para buscar pedidos do 99food
  // Exemplo: fetch orders from 99food API
  const ordersRes = await fetch(
    `${NINE9FOOD_BASE}/merchants/${merchantId}/orders`,
    {
      headers: { 
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!ordersRes.ok) {
    const txt = await ordersRes.text();
    log("Orders fetch failed", { merchant: merchantId, status: ordersRes.status, txt });
    await supabase.from("platform_integrations").update({ 
      last_error: `Orders ${ordersRes.status}: ${txt.slice(0,200)}` 
    }).eq("id", integ.id);
    return { merchant: merchantId, error: ordersRes.status };
  }

  // TODO: Atualizar com a estrutura correta da resposta da API do 99food
  const orders: any[] = await ordersRes.json();
  let inserted = 0;

  for (const order of orders) {
    try {
      // TODO: Atualizar com os campos corretos do payload do 99food
      const orderId = order.id || order.orderId;
      const orderNumber = order.displayId || order.shortId || orderId?.slice(0, 8).toUpperCase();
      
      // Check if order already exists
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("source", "99food")
        .eq("external_id", orderId)
        .maybeSingle();

      if (existing) {
        // Update status if changed
        const newStatus = mapStatus(order.status);
        if (newStatus !== "pending") {
          await supabase.from("orders").update({ status: newStatus })
            .eq("source", "99food")
            .eq("external_id", orderId);
        }
        continue;
      }

      // TODO: Atualizar com o mapeamento correto dos campos do 99food
      const customer = order.customer || {};
      const delivery = order.delivery || {};
      const addr = delivery.address || {};
      const payments = order.payments || [];
      const firstPayment = Array.isArray(payments) ? payments[0] : payments;
      const pm = mapPaymentMethod(firstPayment?.method || firstPayment?.type);

      const items = (order.items || []).map((it: any) => ({
        name: it.name || it.productName,
        price: Number(it.unitPrice || it.price || 0),
        quantity: Number(it.quantity || 1),
        notes: it.observations || it.notes || null,
        addons: (it.addons || it.options || []).map((op: any) => ({
          name: op.name, 
          price: Number(op.price || 0), 
          quantity: Number(op.quantity || 1),
        })),
      }));

      const subtotal = Number(order.subtotal || order.subTotal || 0);
      const deliveryFee = Number(order.deliveryFee || order.delivery_fee || 0);
      const discount = Number(order.discount || order.benefits || 0);
      const total = Number(order.total || order.totalAmount || subtotal + deliveryFee - discount);

      const addressStr = [
        addr.street, 
        addr.number, 
        addr.neighborhood, 
        addr.city,
        addr.state
      ].filter(Boolean).join(", ").slice(0, 500);

      const { error: insErr } = await supabase.from("orders").insert({
        restaurant_id: integ.restaurant_id,
        source: "99food",
        external_id: orderId,
        external_data: order,
        order_number: `99FOOD-${orderNumber}`,
        customer_name: customer.name || customer.customerName || "Cliente 99food",
        customer_phone: customer.phone || customer.phoneNumber || "00000000000",
        customer_address: addressStr || null,
        delivery_type: order.deliveryType === "PICKUP" || order.type === "TAKEOUT" ? "pickup" : "delivery",
        payment_method: pm.method,
        payment_status: pm.status,
        status: "pending",
        subtotal,
        discount,
        delivery_fee: deliveryFee,
        total,
        items,
        notes: order.observations || order.notes || null,
      });

      if (insErr) {
        if (!String(insErr.message).includes("duplicate")) {
          log("Insert failed", { orderId, err: insErr.message });
        }
      } else {
        inserted++;
      }
    } catch (e) {
      log("Order processing error", { order, err: e instanceof Error ? e.message : String(e) });
    }
  }

  await supabase
    .from("platform_integrations")
    .update({ last_sync_at: new Date().toISOString(), last_error: null })
    .eq("id", integ.id);

  return { merchant: merchantId, orders: orders.length, inserted };
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
      .select("id, restaurant_id, merchant_id, api_token")
      .eq("platform", "99food")
      .eq("status", "connected")
      .not("merchant_id", "is", null)
      .not("api_token", "is", null);

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
