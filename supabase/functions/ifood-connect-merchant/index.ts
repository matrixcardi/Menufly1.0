import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[IFOOD-CONNECT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const IFOOD_BASE = "https://merchant-api.ifood.com.br";

async function fetchIfoodToken(): Promise<{ token: string; expires_at: string }> {
  const clientId = Deno.env.get("IFOOD_CLIENT_ID");
  const clientSecret = Deno.env.get("IFOOD_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("iFood credentials not configured on platform");

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
  if (!res.ok || !data.accessToken) {
    log("Token error", { status: res.status, data });
    throw new Error(data?.error_description || "Falha ao autenticar com iFood");
  }

  const expiresAt = new Date(Date.now() + (data.expiresIn - 60) * 1000).toISOString();
  return { token: data.accessToken, expires_at: expiresAt };
}

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

    const { restaurant_id, merchant_id } = await req.json();
    if (!restaurant_id || !merchant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id and merchant_id are required" }), {
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

    // Get token + validate merchant
    const { token, expires_at } = await fetchIfoodToken();

    const merchRes = await fetch(`${IFOOD_BASE}/merchant/v1.0/merchants/${merchant_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const merchData = await merchRes.json();
    if (!merchRes.ok) {
      log("Merchant fetch failed", { status: merchRes.status, data: merchData });
      const msg = merchRes.status === 403 || merchRes.status === 404
        ? "Merchant ID inválido ou Menufly ainda não está autorizado nessa loja. Acesse o portal do iFood e autorize a Menufly."
        : merchData?.message || "Falha ao validar merchant";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const merchantName: string = merchData?.name || merchData?.corporateName || "Loja iFood";

    // Upsert integration
    const { data: existing } = await supabase
      .from("platform_integrations")
      .select("id")
      .eq("restaurant_id", restaurant_id)
      .eq("platform", "ifood")
      .maybeSingle();

    const payload = {
      restaurant_id,
      platform: "ifood",
      merchant_id,
      merchant_name: merchantName,
      access_token: token,
      token_expires_at: expires_at,
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