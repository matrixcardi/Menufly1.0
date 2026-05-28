import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API_URL = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, event_name, event_id, event_data } = await req.json();

    if (!restaurant_id || !event_name) {
      return new Response(
        JSON.stringify({ error: "restaurant_id and event_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch restaurant's pixel ID and access token using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: restaurant, error: dbError } = await supabaseAdmin
      .from("restaurants")
      .select("meta_pixel_id, meta_access_token")
      .eq("id", restaurant_id)
      .maybeSingle();

    if (dbError || !restaurant) {
      return new Response(
        JSON.stringify({ error: "Restaurant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { meta_pixel_id, meta_access_token } = restaurant;

    if (!meta_pixel_id || !meta_access_token) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP from various headers
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || undefined;

    // Build user_data with hashed PII from client
    const userData: Record<string, unknown> = {
      client_ip_address: clientIp,
      client_user_agent: event_data?.user_agent || req.headers.get("user-agent") || undefined,
      fbp: event_data?.fbp || undefined,
      fbc: event_data?.fbc || undefined,
    };

    // Merge pre-hashed user data from client (ph, fn, ln, external_id)
    if (event_data?.user_data) {
      Object.assign(userData, event_data.user_data);
    }

    // Clean undefined values
    Object.keys(userData).forEach((key) => {
      if (userData[key] === undefined || userData[key] === null) {
        delete userData[key];
      }
    });

    // Build event payload for Meta Conversions API
    const eventTime = Math.floor(Date.now() / 1000);
    const eventPayload = {
      data: [
        {
          event_name,
          event_time: eventTime,
          event_id: event_id || undefined, // Critical for deduplication with browser Pixel
          action_source: "website",
          event_source_url: event_data?.source_url || undefined,
          user_data: userData,
          custom_data: {
            currency: "BRL",
            ...(event_data?.custom_data || {}),
          },
        },
      ],
    };

    console.log(`Sending ${event_name} to Meta CAPI (event_id: ${event_id || "none"}, has_ph: ${!!userData.ph}, has_fbp: ${!!userData.fbp})`);

    // Send to Meta Conversions API
    const metaResponse = await fetch(
      `${META_API_URL}/${meta_pixel_id}/events?access_token=${meta_access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta API error:", JSON.stringify(metaResult));
      return new Response(
        JSON.stringify({ error: "Meta API error", details: metaResult }),
        { status: metaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Meta CAPI success: ${event_name}, events_received: ${metaResult.events_received}`);

    return new Response(
      JSON.stringify({ success: true, events_received: metaResult.events_received }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in meta-conversions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
