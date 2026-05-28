// Lá Vem Entregas - Webhook receiver
// Receives status updates from Lá Vem and syncs them to the order.
// Public endpoint (verify_jwt=false). Validates webhook_secret per restaurant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Maps Lá Vem status names to internal labels we display in the UI.
// Adjust once we know the real status values returned by the platform.
const STATUS_MAP: Record<string, string> = {
  created: "created",
  pending: "created",
  accepted: "assigned",
  assigned: "assigned",
  picked_up: "picked_up",
  collected: "picked_up",
  in_transit: "picked_up",
  delivered: "delivered",
  completed: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    // Expected (generic) payload — adjust to Lá Vem's real format:
    // { external_id, delivery_id, status, driver_name, driver_phone, tracking_url, fee, secret }
    const externalId = body.external_id || body.order_id;
    const deliveryId = body.delivery_id || body.id;
    const incomingSecret = body.secret || req.headers.get("x-webhook-secret");
    const rawStatus = String(body.status || "").toLowerCase();
    const mappedStatus = STATUS_MAP[rawStatus] || rawStatus || null;

    if (!externalId && !deliveryId) {
      return new Response(JSON.stringify({ error: "external_id ou delivery_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the order
    const orderQuery = supabase.from("orders").select("id, restaurant_id, lavem_delivery_id");
    const { data: order } = externalId
      ? await orderQuery.eq("id", externalId).maybeSingle()
      : await orderQuery.eq("lavem_delivery_id", deliveryId).maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate secret
    const { data: integ } = await supabase
      .from("lavem_integrations")
      .select("webhook_secret")
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();

    if (!integ || !incomingSecret || incomingSecret !== integ.webhook_secret) {
      return new Response(JSON.stringify({ error: "Webhook secret inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = {};
    if (mappedStatus) update.lavem_status = mappedStatus;
    if (deliveryId && !order.lavem_delivery_id) update.lavem_delivery_id = deliveryId;
    if (body.driver_name) update.lavem_driver_name = body.driver_name;
    if (body.driver_phone) update.lavem_driver_phone = body.driver_phone;
    if (body.tracking_url) update.lavem_tracking_url = body.tracking_url;
    if (typeof body.fee === "number") update.lavem_fee = body.fee;

    // When delivered by Lá Vem, mark order as delivered too
    if (mappedStatus === "delivered") {
      update.status = "delivered";
    }

    if (Object.keys(update).length > 0) {
      await supabase.from("orders").update(update).eq("id", order.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lavem-webhook] error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
