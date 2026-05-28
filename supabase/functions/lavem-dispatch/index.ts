// Lá Vem Entregas - Dispatch order to delivery platform
// The platform-level API key is stored as a backend secret (LAVEM_API_KEY) and
// is hidden from admins. Each restaurant only stores their Lá Vem account
// credentials (account_email + account_password), which are forwarded to the
// platform on every dispatch request.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: ensure caller is logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.lavem_delivery_id) {
      return new Response(
        JSON.stringify({ error: "Pedido já enviado ao Lá Vem", delivery_id: order.lavem_delivery_id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load integration (admin must have linked their Lá Vem account)
    const { data: integ } = await supabase
      .from("lavem_integrations")
      .select("is_active, dispatch_mode, account_email, account_password, webhook_secret")
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();

    if (!integ || !integ.is_active) {
      return new Response(
        JSON.stringify({ error: "Integração Lá Vem está desativada para este restaurante" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!integ.account_email || !integ.account_password) {
      return new Response(
        JSON.stringify({
          error:
            "Conta Lá Vem Entregas não vinculada. Vá em Integrações e informe e-mail/senha da sua conta.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Platform-level credential (hidden from admins, set as Edge Function secret)
    const platformApiKey = Deno.env.get("LAVEM_API_KEY");
    if (!platformApiKey) {
      return new Response(
        JSON.stringify({ error: "LAVEM_API_KEY não configurada no backend" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load restaurant for pickup address
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name, address, phone, latitude, longitude")
      .eq("id", order.restaurant_id)
      .maybeSingle();

    // Build payload (generic shape — adjust to Lá Vem's real schema)
    const payload = {
      external_id: order.id,
      account: {
        email: integ.account_email,
        password: integ.account_password,
      },
      pickup: {
        name: restaurant?.name,
        address: (restaurant as any)?.address,
        phone: (restaurant as any)?.phone,
        latitude: (restaurant as any)?.latitude,
        longitude: (restaurant as any)?.longitude,
      },
      dropoff: {
        name: order.customer_name,
        phone: order.customer_phone,
        address: order.customer_address,
      },
      order: {
        number: order.order_number,
        total: Number(order.total),
        items: order.items,
        notes: order.notes,
      },
      webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/lavem-webhook`,
      webhook_secret: integ.webhook_secret,
    };

    // ========== TODO: REPLACE WITH REAL LÁ VEM ENTREGAS API CALL ==========
    // Once Lá Vem provides docs, replace the simulated block below with:
    //
    // const lavemResp = await fetch("https://api.laventregas.com.br/v1/deliveries", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${platformApiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload),
    // });
    // const lavemData = await lavemResp.json();
    // if (!lavemResp.ok) throw new Error(lavemData?.message || "Erro Lá Vem");
    //
    // const externalId = lavemData.id;
    // const trackingUrl = lavemData.tracking_url;
    // const fee = lavemData.fee;
    //
    const simulated = {
      id: `LAVEM-SIM-${Date.now()}`,
      tracking_url: `https://laventregas.com.br/track/SIMULATED`,
      fee: 0,
      status: "created",
      _note:
        "Resposta simulada — substitua pela chamada real em supabase/functions/lavem-dispatch/index.ts assim que tiver a documentação da API Lá Vem.",
    };
    console.log("[lavem-dispatch] using platform key:", platformApiKey.slice(0, 4) + "***");
    console.log("[lavem-dispatch] payload:", JSON.stringify(payload));
    console.log("[lavem-dispatch] simulated response:", simulated);
    // ======================================================================

    await supabase
      .from("orders")
      .update({
        lavem_delivery_id: simulated.id,
        lavem_status: simulated.status,
        lavem_tracking_url: simulated.tracking_url,
        lavem_fee: simulated.fee,
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({
        success: true,
        delivery_id: simulated.id,
        tracking_url: simulated.tracking_url,
        simulated: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[lavem-dispatch] error:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
