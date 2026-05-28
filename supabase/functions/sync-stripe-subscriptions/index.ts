import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) => console.log(`[SYNC-STRIPE] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const PRICE_TO_PLAN: Record<string, string> = {
  price_1TEX5kDct1iEI7GEVq3sBOvF: "start",
  price_1TEX67Dct1iEI7GEEVAW610Q: "elite",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authorize: only master users can run this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Auth failed");
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "master")
      .maybeSingle();
    if (!roleRow) throw new Error("Master role required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const subs = await stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.customer"] });
    log("Active subscriptions found", { count: subs.data.length });

    let updated = 0;
    const results: any[] = [];
    for (const sub of subs.data) {
      const customer = sub.customer as Stripe.Customer;
      const email = customer?.email;
      if (!email) { results.push({ sub: sub.id, skipped: "no email" }); continue; }

      const priceId = sub.items.data[0]?.price?.id;
      const plan = PRICE_TO_PLAN[priceId] || "start";

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!profile) { results.push({ email, skipped: "no profile" }); continue; }

      await supabase
        .from("profiles")
        .update({ subscription_status: "active", subscription_plan: plan })
        .eq("id", profile.id);
      await supabase
        .from("restaurants")
        .update({ subscription_active: true })
        .eq("user_id", profile.id);

      updated++;
      results.push({ email, plan, status: "active" });
    }

    return new Response(JSON.stringify({ success: true, updated, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});