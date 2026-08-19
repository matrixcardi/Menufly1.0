import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  fetchTransaction,
  isPaidStatus,
  isFailedStatus,
  activateSubscription,
  claimTransactionForActivation,
  PLAN_PRICES_CENTS,
} from "../_shared/hypercash.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[HYPERCASH-VERIFY-TRANSACTION] ${step}${detailsStr}`);
};

/**
 * Consultado em polling pelo checkout enquanto o webhook não chega — autorização
 * de cartão leva 1–5s e a confirmação até 30s. Espelha verify-pix-subscription.
 */
serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const secretKey = Deno.env.get("HYPERCASH_SECRET_KEY");
    if (!secretKey) throw new Error("HYPERCASH_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Authentication error: empty bearer token");

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { transaction_id } = await req.json();
    if (!transaction_id) throw new Error("transaction_id is required");

    const transaction = await fetchTransaction(secretKey, String(transaction_id));
    logStep("Transaction fetched", { id: transaction?.id, status: transaction?.status });

    // A transação tem de pertencer a quem está perguntando.
    const metaUserId = transaction.metadata?.user_id as string | undefined;
    if (metaUserId && metaUserId !== user.id) {
      throw new Error("Transaction does not belong to this user");
    }

    const status = String(transaction.status ?? "").toLowerCase();

    if (!isPaidStatus(status)) {
      return new Response(JSON.stringify({
        verified: false,
        status,
        failed: isFailedStatus(status),
        refusedReason: transaction.refusedReason ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const plan = (transaction.metadata?.plan as string | undefined) ?? "start";
    if (!PLAN_PRICES_CENTS[plan]) throw new Error(`Plano desconhecido na transação: ${plan}`);

    // O webhook confirma o mesmo pagamento em paralelo. Só quem vence o claim
    // atômico estende o período; o outro apenas relata o estado já gravado.
    if (await claimTransactionForActivation(supabase, String(transaction.id))) {
      const result = await activateSubscription(supabase, {
        userId: user.id,
        plan,
        gateway: "hypercash",
        transactionId: String(transaction.id),
        hypercashCustomerId: transaction.customer?.id ?? null,
      });

      logStep("Subscription activated", { userId: user.id, plan });

      return new Response(JSON.stringify({
        verified: true,
        status,
        plan,
        subscription_end: result.currentPeriodEnd,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const { data: sub } = await supabase
      .from("platform_subscriptions")
      .select("current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    logStep("Already activated elsewhere", { userId: user.id });

    return new Response(JSON.stringify({
      verified: true,
      status,
      plan,
      subscription_end: sub?.current_period_end ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
