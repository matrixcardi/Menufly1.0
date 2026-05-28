import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Wrapper around fetch with hard timeout so Evolution API outages
// don't cause the edge function to hang for 75s and return 500.
async function apiFetch(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function isUnreachableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timed out|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|aborted|tcp connect|Connect/i.test(msg);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

  // Ensure URL has protocol prefix
  if (EVOLUTION_API_URL && !EVOLUTION_API_URL.startsWith("http")) {
    EVOLUTION_API_URL = `https://${EVOLUTION_API_URL}`;
  }
  // Remove trailing slash
  EVOLUTION_API_URL = EVOLUTION_API_URL.replace(/\/+$/, "");

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const adminSupabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  try {
    const { action, restaurantId } = await req.json();

    // Check if user is owner, collaborator, or master
    const { data: restaurant } = await adminSupabaseAuth
      .from("restaurants")
      .select("id, name, slug, whatsapp_instance_name, whatsapp_connected, user_id")
      .eq("id", restaurantId)
      .maybeSingle();

    if (!restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access: owner, collaborator, or master
    const isOwner = restaurant.user_id === userId;

    const { data: isMasterRole } = await adminSupabaseAuth
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "master")
      .maybeSingle();

    const { data: isCollab } = await adminSupabaseAuth
      .from("restaurant_collaborators")
      .select("id")
      .eq("user_id", userId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!isOwner && !isMasterRole && !isCollab) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instanceName = restaurant.whatsapp_instance_name || `menufly-${restaurant.slug || restaurant.id.slice(0, 8)}`;

    if (action === "create") {
      // First, try to delete any existing instance to avoid duplicates
      try {
        await apiFetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        console.log("Logged out existing instance (if any)");
      } catch (e) {
        console.log("Logout attempt (may not exist):", e);
      }

      try {
        await apiFetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        });
        console.log("Deleted existing instance (if any)");
      } catch (e) {
        console.log("Delete attempt (may not exist):", e);
      }

      // Wait a moment for cleanup
      await new Promise((r) => setTimeout(r, 1000));

      const createRes = await apiFetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

      const createData = await createRes.json();
      console.log("Create instance response:", JSON.stringify(createData));

      // Configure webhook so incoming messages trigger our auto-reply bot.
      try {
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-bot`;
        await apiFetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: false,
              events: ["MESSAGES_UPSERT"],
            },
            // Backward-compatible flat fields for older Evolution versions
            enabled: true,
            url: webhookUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
          }),
        }, 6000);
        console.log("Webhook configured for instance", instanceName);
      } catch (e) {
        console.warn("Failed to configure Evolution webhook:", e instanceof Error ? e.message : e);
      }

      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await adminSupabase
        .from("restaurants")
        .update({ whatsapp_instance_name: instanceName })
        .eq("id", restaurant.id);

      const qrcode = createData?.qrcode?.base64 || createData?.base64 || null;

      return new Response(JSON.stringify({
        success: true,
        instanceName,
        qrcode,
        status: "created",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qrcode") {
      // Restart the instance to force a new QR code
      try {
        await apiFetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
          method: "PUT",
          headers: { apikey: EVOLUTION_API_KEY },
        });
      } catch (e) {
        console.log("Restart attempt:", e);
      }

      await new Promise((r) => setTimeout(r, 1500));

      const qrRes = await apiFetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: { apikey: EVOLUTION_API_KEY },
      });

      const qrData = await qrRes.json();
      console.log("QR code response:", JSON.stringify(qrData).slice(0, 200));

      const qrcode = qrData?.base64 || qrData?.qrcode?.base64 || null;

      return new Response(JSON.stringify({
        success: true,
        instanceName,
        qrcode,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      // Status check must NEVER 500 — degrade gracefully so UI keeps working
      let isConnected = false;
      let state = "unknown";
      let unreachable = false;
      try {
        const statusRes = await apiFetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
          { method: "GET", headers: { apikey: EVOLUTION_API_KEY } },
          6000,
        );
        const statusData = await statusRes.json();
        console.log("Status response:", JSON.stringify(statusData));
        isConnected = statusData?.instance?.state === "open";
        state = statusData?.instance?.state || "unknown";
      } catch (e) {
        console.warn("Evolution API unreachable on status check:", e instanceof Error ? e.message : e);
        unreachable = true;
      }

      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (!unreachable) {
        await adminSupabase
          .from("restaurants")
          .update({ whatsapp_connected: isConnected })
          .eq("id", restaurant.id);
      }

      // Ensure the webhook is always configured on connected instances so
      // incoming messages reach the bot — older instances created before
      // webhook auto-config still need this.
      if (!unreachable && isConnected) {
        try {
          const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-bot`;
          await apiFetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              webhook: {
                enabled: true,
                url: webhookUrl,
                webhookByEvents: false,
                webhookBase64: false,
                events: ["MESSAGES_UPSERT"],
              },
              enabled: true,
              url: webhookUrl,
              webhook_by_events: false,
              events: ["MESSAGES_UPSERT"],
            }),
          }, 5000);
        } catch (e) {
          console.warn("Webhook reconfig failed:", e instanceof Error ? e.message : e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        instanceName,
        connected: isConnected,
        state,
        unreachable,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await apiFetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers: { apikey: EVOLUTION_API_KEY },
      });

      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await adminSupabase
        .from("restaurants")
        .update({ whatsapp_connected: false })
        .eq("id", restaurant.id);

      return new Response(JSON.stringify({ success: true, disconnected: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    if (isUnreachableError(error)) {
      return new Response(JSON.stringify({
        error: "Servidor de WhatsApp temporariamente indisponível. Tente novamente em alguns instantes.",
        code: "EVOLUTION_API_UNREACHABLE",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});