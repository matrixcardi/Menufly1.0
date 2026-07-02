// Desconecta a loja do 99Food: unbind best-effort na API + delete da integração.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ensureAuthToken, nfApi, type NfIntegration } from "../_shared/nine9food.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[NF-DISCONNECT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

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
    const { data: claims, error } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "").trim()
    );
    if (error || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { restaurant_id } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Unbind best-effort no 99Food antes de apagar a integração local
    const { data: integ } = await supabase
      .from("platform_integrations")
      .select("id, restaurant_id, access_token, token_expires_at, merchant_id, status")
      .eq("restaurant_id", restaurant_id)
      .eq("platform", "99food")
      .maybeSingle();

    if (integ?.status === "connected") {
      try {
        const token = await ensureAuthToken(supabase, integ as NfIntegration);
        await nfApi("/v1/shop/shop/unbind", { method: "POST", body: { auth_token: token } });
        log("Unbound on 99Food", { restaurant_id });
      } catch (e) {
        log("Unbind failed (continuing)", { restaurant_id, err: e instanceof Error ? e.message : String(e) });
      }
    }

    await supabase
      .from("platform_integrations")
      .delete()
      .eq("restaurant_id", restaurant_id)
      .eq("platform", "99food");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
