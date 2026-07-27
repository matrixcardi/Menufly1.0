import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-OAUTH] ${step}${detailsStr}`);
};

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // restaurant_id

  const appId = Deno.env.get("MP_APP_ID");
  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Redirect base — must match a redirect URI registered in the Mercado Pago
  // developer panel; update there before deploying a change here.
  const redirectBase = "https://menufly.com.br";

  if (!code || !state) {
    logStep("Missing code or state", { code: !!code, state: !!state });
    return Response.redirect(`${redirectBase}/admin/pagamentos?mp_error=missing_params`, 302);
  }

  if (!appId || !clientSecret) {
    logStep("Missing MP credentials");
    return Response.redirect(`${redirectBase}/admin/pagamentos?mp_error=config`, 302);
  }

  try {
    logStep("Exchanging code for token", { state });

    // Exchange authorization code for access token
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_secret: clientSecret,
        client_id: appId,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${supabaseUrl}/functions/v1/mercadopago-oauth`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      logStep("Token exchange failed", { status: tokenRes.status, error: tokenData });
      return Response.redirect(`${redirectBase}/admin/pagamentos?mp_error=token_exchange`, 302);
    }

    logStep("Token obtained", { user_id: tokenData.user_id });

    // Save tokens to the restaurant
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from("restaurants")
      .update({
        pix_gateway: "mercadopago",
        pix_gateway_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token,
        mp_public_key: tokenData.public_key || null,
        pix_enabled: true,
      })
      .eq("id", state);

    if (updateError) {
      logStep("DB update failed", { error: updateError.message });
      return Response.redirect(`${redirectBase}/admin/pagamentos?mp_error=save`, 302);
    }

    logStep("Successfully connected", { restaurant_id: state });
    return Response.redirect(`${redirectBase}/admin/pagamentos?mp_success=true`, 302);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return Response.redirect(`${redirectBase}/admin/pagamentos?mp_error=unknown`, 302);
  }
});
