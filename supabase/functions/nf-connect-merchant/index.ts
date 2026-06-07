import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[NF-CONNECT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

// TODO: Atualizar com a URL base correta da API do 99food
const NINE9FOOD_BASE = "https://api.99food.com.br"; // PLACEHOLDER - atualizar com URL real

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "").trim()
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { restaurant_id, merchant_id, api_token } = await req.json();
    if (!restaurant_id || !merchant_id || !api_token) {
      return new Response(JSON.stringify({ error: "restaurant_id, merchant_id and api_token are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify ownership
    const { data: rest } = await supabase
      .from("restaurants")
      .select("id, user_id")
      .eq("id", restaurant_id)
      .maybeSingle();
    if (!rest) {
      return new Response(JSON.stringify({ error: "Restaurante não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Atualizar com o endpoint correto para validar merchant_id e api_token
    // Exemplo: validate merchant with 99food API
    const merchRes = await fetch(`${NINE9FOOD_BASE}/merchants/${merchant_id}`, {
      headers: { 
        "Authorization": `Bearer ${api_token}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!merchRes.ok) {
      log("Merchant fetch failed", { status: merchRes.status });
      const msg = merchRes.status === 403 || merchRes.status === 404
        ? "Merchant ID ou Token de API inválidos. Verifique suas credenciais no portal do 99food."
        : "Falha ao validar credenciais com o 99food.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Atualizar com a estrutura correta da resposta da API do 99food
    const merchData = await merchRes.json();
    const merchantName: string = merchData?.name || merchData?.storeName || "Loja 99food";

    // Upsert integration
    const { data: existing } = await supabase
      .from("platform_integrations")
      .select("id")
      .eq("restaurant_id", restaurant_id)
      .eq("platform", "99food")
      .maybeSingle();

    const payload = {
      restaurant_id,
      platform: "99food",
      merchant_id,
      api_token,
      merchant_name: merchantName,
      status: "connected",
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase.from("platform_integrations").update(payload).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("platform_integrations").insert(payload);
      if (error) throw error;
    }

    log("Connected", { restaurant_id, merchant_id, merchantName });
    return new Response(JSON.stringify({ success: true, merchant_name: merchantName }), {
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
