import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

  if (EVOLUTION_API_URL && !EVOLUTION_API_URL.startsWith("http")) {
    EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
  }
  EVOLUTION_API_URL = EVOLUTION_API_URL.replace(/\/+$/, "");

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("Missing Evolution API credentials");
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date();
    const hour = now.getUTCHours() - 3;
    const adjustedHour = hour < 0 ? hour + 24 : hour;

    if (adjustedHour < 9 || adjustedHour >= 21) {
      console.log(`Outside allowed hours (BRT ${adjustedHour}h). Skipping.`);
      return new Response(JSON.stringify({ skipped: "Outside allowed hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Find eligible campaigns (scheduled/running, past scheduled_at, correct day)
    const brtDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const currentDayOfWeek = brtDate.getUTCDay();

    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, message_template, image_url, status, restaurant_id, sent_count, failed_count, total_recipients, dispatch_days, scheduled_at")
      .in("status", ["scheduled", "running"])
      .lte("scheduled_at", now.toISOString())
      .order("created_at", { ascending: true });

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      throw campaignsError;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("No eligible campaigns found");
      return new Response(JSON.stringify({ processed: 0, message: "No eligible campaigns" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter campaigns by dispatch day
    const eligibleCampaigns = campaigns.filter((c: any) => {
      const allowedDays: number[] = c.dispatch_days || [0, 1, 2, 3, 4, 5, 6];
      return allowedDays.includes(currentDayOfWeek);
    });

    if (eligibleCampaigns.length === 0) {
      console.log(`No campaigns for today (day ${currentDayOfWeek}). Skipping.`);
      return new Response(JSON.stringify({ skipped: "No campaigns for today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: For each eligible campaign, check WhatsApp connection and find a pending recipient
    let processedRecipient = null;
    let selectedCampaign = null;

    for (const campaign of eligibleCampaigns) {
      // Check restaurant WhatsApp connection
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("whatsapp_instance_name, whatsapp_connected")
        .eq("id", campaign.restaurant_id)
        .maybeSingle();

      if (!restaurant?.whatsapp_instance_name || !restaurant?.whatsapp_connected) {
        console.log(`Restaurant ${campaign.restaurant_id} has no connected WhatsApp. Skipping campaign "${campaign.name}".`);
        continue;
      }

      // Check WhatsApp credits balance
      const { data: creditsData } = await supabase
        .from("whatsapp_credits")
        .select("balance")
        .eq("restaurant_id", campaign.restaurant_id)
        .maybeSingle();

      const currentBalance = creditsData?.balance || 0;
      if (currentBalance <= 0) {
        console.log(`Restaurant ${campaign.restaurant_id} has no WhatsApp credits (balance: ${currentBalance}). Skipping campaign "${campaign.name}".`);
        continue;
      }

      // Check daily limit per restaurant (50 messages per day)
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count: todaySentCount } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact" })
        .eq("status", "sent")
        .gte("sent_at", todayStart.toISOString())
        .in("campaign_id", eligibleCampaigns.filter((c: any) => c.restaurant_id === campaign.restaurant_id).map((c: any) => c.id));

      if ((todaySentCount || 0) >= 50) {
        console.log(`Daily limit reached for restaurant ${campaign.restaurant_id}. Skipping.`);
        continue;
      }

      // Find a pending recipient for this campaign
      const { data: recipient, error: recipientError } = await supabase
        .from("campaign_recipients")
        .select("id, campaign_id, customer_name, customer_phone, status")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (recipientError) {
        console.error(`Error fetching recipient for campaign ${campaign.id}:`, recipientError);
        continue;
      }

      if (recipient) {
        processedRecipient = recipient;
        selectedCampaign = { ...campaign, instanceName: restaurant.whatsapp_instance_name };
        break;
      }
    }

    if (!processedRecipient || !selectedCampaign) {
      console.log("No pending recipients found across eligible campaigns");
      return new Response(JSON.stringify({ processed: 0, message: "No pending recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Mark campaign as running if still scheduled
    if (selectedCampaign.status === "scheduled") {
      await supabase
        .from("campaigns")
        .update({ status: "running", started_at: now.toISOString() })
        .eq("id", selectedCampaign.id);
    }

    // Step 4: Send message
    const firstName = processedRecipient.customer_name.split(" ")[0];
    const personalizedMessage = selectedCampaign.message_template.replace(/\{nome\}/gi, firstName);

    let phone = processedRecipient.customer_phone.replace(/\D/g, "");
    if (phone.length === 11 && phone.startsWith("0")) {
      phone = "55" + phone.substring(1);
    } else if (phone.length === 11) {
      phone = "55" + phone;
    } else if (phone.length === 10) {
      phone = "55" + phone;
    }

    const instanceName = selectedCampaign.instanceName;
    console.log(`Sending to ${processedRecipient.customer_name} (${phone}) via instance ${instanceName} [Campaign: ${selectedCampaign.name}]`);

    let sendResponse: Response;
    let sendResult: any;

    if (selectedCampaign.image_url) {
      const sendUrl = `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`;
      sendResponse = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
        body: JSON.stringify({
          number: phone,
          mediatype: "image",
          media: selectedCampaign.image_url,
          caption: personalizedMessage,
        }),
      });
      sendResult = await sendResponse.json();
    } else {
      const sendUrl = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
      sendResponse = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
        body: JSON.stringify({ number: phone, text: personalizedMessage, linkPreview: false }),
      });
      sendResult = await sendResponse.json();
    }

    console.log("Evolution API response:", JSON.stringify(sendResult));

    if (!sendResponse.ok) {
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: `HTTP ${sendResponse.status}: ${JSON.stringify(sendResult)}`,
          sent_at: now.toISOString(),
        })
        .eq("id", processedRecipient.id);

      await supabase
        .from("campaigns")
        .update({ failed_count: (selectedCampaign.failed_count || 0) + 1 })
        .eq("id", selectedCampaign.id);
    } else {
      await supabase
        .from("campaign_recipients")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", processedRecipient.id);

      const newSentCount = selectedCampaign.sent_count + 1;
      await supabase
        .from("campaigns")
        .update({ sent_count: newSentCount })
        .eq("id", selectedCampaign.id);

      // Deduct WhatsApp credit
      const { data: currentCredits } = await supabase
        .from("whatsapp_credits")
        .select("balance, total_used")
        .eq("restaurant_id", selectedCampaign.restaurant_id)
        .maybeSingle();

      if (currentCredits) {
        await supabase
          .from("whatsapp_credits")
          .update({
            balance: Math.max(0, currentCredits.balance - 1),
            total_used: currentCredits.total_used + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("restaurant_id", selectedCampaign.restaurant_id);
      }

      // Check if all recipients processed
      const { count: pendingCount } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact" })
        .eq("campaign_id", selectedCampaign.id)
        .eq("status", "pending");

      if ((pendingCount || 0) === 0) {
        await supabase
          .from("campaigns")
          .update({ status: "completed", completed_at: now.toISOString() })
          .eq("id", selectedCampaign.id);
        console.log(`Campaign ${selectedCampaign.name} completed!`);
      }
    }

    return new Response(
      JSON.stringify({
        processed: 1,
        recipient: processedRecipient.customer_name,
        phone: phone,
        campaign: selectedCampaign.name,
        success: sendResponse.ok,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing campaigns:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
