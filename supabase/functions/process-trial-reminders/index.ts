import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, user_id, trial_ends_at, subscription_active, trial_email_d7_sent, trial_email_d3_sent, trial_email_d1_sent, trial_email_d0_sent")
    .not("trial_ends_at", "is", null);

  const now = Date.now();
  let processed = 0, emailsSent = 0, deactivated = 0;

  for (const r of restaurants ?? []) {
    processed++;
    const endTs = new Date(r.trial_ends_at).getTime();
    const msLeft = endTs - now;
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    // Get user email
    const { data: userResp } = await supabase.auth.admin.getUserById(r.user_id);
    const email = userResp?.user?.email;
    if (!email) continue;

    // Check Stripe subscription
    const customers = await stripe.customers.list({ email, limit: 1 });
    let hasActiveSub = false;
    if (customers.data.length > 0) {
      const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
      hasActiveSub = subs.data.length > 0;
    }

    // Trial expired and no active sub -> deactivate
    if (msLeft <= 0 && !hasActiveSub) {
      if (r.subscription_active !== false) {
        await supabase.from("restaurants").update({ subscription_active: false }).eq("id", r.id);
        deactivated++;
      }
      // D-0 email
      if (!r.trial_email_d0_sent) {
        await sendReminder(email, r.name, 0);
        await supabase.from("restaurants").update({ trial_email_d0_sent: true }).eq("id", r.id);
        emailsSent++;
      }
      continue;
    }

    // If active sub exists, ensure subscription_active = true
    if (hasActiveSub && r.subscription_active === false) {
      await supabase.from("restaurants").update({ subscription_active: true }).eq("id", r.id);
    }

    if (hasActiveSub) continue;

    // Send reminders D-7, D-3, D-1
    const checkpoints: Array<{ days: number; flag: keyof typeof r }> = [
      { days: 7, flag: "trial_email_d7_sent" },
      { days: 3, flag: "trial_email_d3_sent" },
      { days: 1, flag: "trial_email_d1_sent" },
    ];
    for (const cp of checkpoints) {
      if (daysLeft === cp.days && !r[cp.flag]) {
        try {
          await sendReminder(email, r.name, cp.days);
          await supabase.from("restaurants").update({ [cp.flag]: true } as any).eq("id", r.id);
          emailsSent++;
        } catch (e) {
          console.error("Failed to send reminder", { restaurantId: r.id, error: String(e) });
        }
      }
    }
  }

  return new Response(JSON.stringify({ processed, emailsSent, deactivated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });

  async function sendReminder(to: string, restaurantName: string | null, daysRemaining: number) {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        template: "trial-reminder",
        to,
        data: { restaurantName, daysRemaining },
        idempotency_key: `trial-d${daysRemaining}-${to}`,
        purpose: "transactional",
      }),
    });
    if (!resp.ok) throw new Error(`Email send failed: ${resp.status}`);
  }
});