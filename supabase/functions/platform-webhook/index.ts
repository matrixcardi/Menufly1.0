import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[PLATFORM-WEBHOOK] ${s}${d ? " " + JSON.stringify(d) : ""}`);

function mapPaymentMethod(paymentMethod: string | undefined): { method: string; status: string } {
  const m = (paymentMethod || "").toUpperCase();
  if (m.includes("CASH") || m.includes("DINHEIRO")) return { method: "cash", status: "pending" };
  if (m.includes("CREDIT") || m.includes("DEBIT") || m.includes("CARD")) return { method: "card", status: "paid" };
  if (m.includes("PIX")) return { method: "pix", status: "paid" };
  return { method: "card", status: "paid" };
}

function mapStatus(status: string | undefined): string {
  const s = (status || "").toUpperCase();
  if (["CONCLUDED", "DELIVERED", "ENTREGUE"].includes(s)) return "delivered";
  if (["CANCELLED", "CANCELED", "CANCELADO"].includes(s)) return "cancelled";
  if (["DISPATCHED", "READY_TO_PICKUP", "SAIU_PARA_ENTREGA", "PRONTO"].includes(s)) return "out_for_delivery";
  if (["CONFIRMED", "PLACED", "INTEGRATED", "CONFIRMADO"].includes(s)) return "preparing";
  return "pending";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get platform from URL path or header
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const platform = pathParts[pathParts.length - 1] || req.headers.get("x-platform") || "unknown";
    
    // Get webhook signature for verification (optional)
    const signature = req.headers.get("x-signature") || req.headers.get("x-webhook-signature");
    
    // Parse payload
    const payload = await req.json();
    log("Webhook received", { platform, payload });

    // Identify restaurant by merchant_id or restaurant_id from payload
    // TODO: Atualizar com os campos corretos do payload do 99food
    const merchantId = payload.merchant_id || payload.storeId || payload.merchantId;
    const restaurantId = payload.restaurant_id;

    if (!merchantId && !restaurantId) {
      log("Missing merchant/restaurant identifier", { payload });
      return new Response(JSON.stringify({ error: "Missing merchant_id or restaurant_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find integration
    let integration;
    if (merchantId) {
      const { data } = await supabase
        .from("platform_integrations")
        .select("id, restaurant_id, platform, merchant_id, api_token")
        .eq("platform", platform)
        .eq("merchant_id", merchantId)
        .eq("status", "connected")
        .maybeSingle();
      integration = data;
    } else if (restaurantId) {
      const { data } = await supabase
        .from("platform_integrations")
        .select("id, restaurant_id, platform, merchant_id, api_token")
        .eq("platform", platform)
        .eq("restaurant_id", restaurantId)
        .eq("status", "connected")
        .maybeSingle();
      integration = data;
    }

    if (!integration) {
      log("Integration not found", { platform, merchantId, restaurantId });
      return new Response(JSON.stringify({ error: "Integration not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Atualizar com a estrutura correta do payload do 99food
    const orderId = payload.order_id || payload.orderId || payload.id;
    const eventType = payload.event_type || payload.eventType || payload.type || "order.created";

    // Handle different event types
    if (eventType.includes("cancel") || eventType.includes("CANCEL")) {
      // Cancel order
      await supabase
        .from("orders")
        .update({ 
          status: "cancelled", 
          cancellation_reason: `Cancelado via webhook ${platform}` 
        })
        .eq("source", platform)
        .eq("external_id", orderId);
      
      log("Order cancelled", { platform, orderId });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle order status updates
    if (payload.status) {
      const newStatus = mapStatus(payload.status);
      if (newStatus !== "pending") {
        await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("source", platform)
          .eq("external_id", orderId);
        
        log("Order status updated", { platform, orderId, newStatus });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Handle new order creation
    // TODO: Atualizar com o mapeamento correto dos campos do 99food
    const customer = payload.customer || {};
    const delivery = payload.delivery || {};
    const addr = delivery.address || delivery.deliveryAddress || {};
    const payments = payload.payments || [];
    const firstPayment = Array.isArray(payments) ? payments[0] : payments;
    const pm = mapPaymentMethod(firstPayment?.method || firstPayment?.type);

    const items = (payload.items || []).map((it: any) => ({
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

    const subtotal = Number(payload.subtotal || payload.subTotal || 0);
    const deliveryFee = Number(payload.deliveryFee || payload.delivery_fee || 0);
    const discount = Number(payload.discount || payload.benefits || 0);
    const total = Number(payload.total || payload.totalAmount || subtotal + deliveryFee - discount);

    const addressStr = [
      addr.street, 
      addr.number, 
      addr.neighborhood, 
      addr.city,
      addr.state
    ].filter(Boolean).join(", ").slice(0, 500);

    const orderNumber = payload.display_id || payload.displayId || payload.shortId || orderId?.slice(0, 8).toUpperCase();

    const { error: insErr } = await supabase.from("orders").insert({
      restaurant_id: integration.restaurant_id,
      source: platform,
      external_id: orderId,
      external_data: payload,
      order_number: `${platform.toUpperCase()}-${orderNumber}`,
      customer_name: customer.name || customer.customerName || `Cliente ${platform}`,
      customer_phone: customer.phone || customer.phoneNumber || "00000000000",
      customer_address: addressStr || null,
      delivery_type: payload.delivery_type === "PICKUP" || payload.type === "TAKEOUT" ? "pickup" : "delivery",
      payment_method: pm.method,
      payment_status: pm.status,
      status: "pending",
      subtotal,
      discount,
      delivery_fee: deliveryFee,
      total,
      items,
      notes: payload.observations || payload.notes || null,
    });

    if (insErr) {
      if (String(insErr.message).includes("duplicate")) {
        log("Order already exists", { platform, orderId });
        return new Response(JSON.stringify({ success: true, message: "Order already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      log("Insert failed", { platform, orderId, err: insErr.message });
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Order created", { platform, orderId, orderNumber });
    return new Response(JSON.stringify({ success: true, order_number: orderNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
