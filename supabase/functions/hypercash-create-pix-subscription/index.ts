import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  hypercashRequest,
  hypercashErrorDetails,
  isPaidStatus,
  activateSubscription,
  claimTransactionForActivation,
  PLAN_PRICES_CENTS,
  IMPLEMENTATION_PRICE_CENTS,
  PLAN_LABELS,
  type HyperCashTransaction,
} from "../_shared/hypercash.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[HYPERCASH-CREATE-PIX-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Espelha hypercash-create-transaction (cartão), trocando paymentMethod para PIX
// e removendo o objeto `card` — que não se aplica aqui. O shape exato da resposta
// de PIX (qual campo traz o copia-e-cola / QR) ainda não foi confirmado contra a
// API real; por isso devolvemos `pix_raw` junto para diagnóstico na primeira
// chamada real, além das tentativas mais prováveis de nome de campo.
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
    logStep("Function started");

    const secretKey = Deno.env.get("HYPERCASH_SECRET_KEY");
    if (!secretKey) throw new Error("HYPERCASH_SECRET_KEY is not set");

    const webhookToken = Deno.env.get("HYPERCASH_WEBHOOK_TOKEN");
    if (!webhookToken) throw new Error("HYPERCASH_WEBHOOK_TOKEN is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Authentication error: empty bearer token");

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    const body = await req.json().catch(() => ({}));
    const { plan, includeImplementation, customer } = body ?? {};

    const planPrice = PLAN_PRICES_CENTS[plan];
    if (!planPrice) throw new Error("Plano inválido. Use 'start' ou 'elite'.");

    // CPF é obrigatório: sem ele a HyperCash aceita o payload e o provedor recusa
    // a cobrança com "Erro ao realizar pagamento", sem indicar o campo faltante.
    const documentNumber = customer?.document ? String(customer.document).replace(/\D/g, "") : "";
    if (documentNumber.length !== 11) throw new Error("CPF do pagador é obrigatório para o PIX.");

    const customerName = String(customer?.name ?? "").trim();
    if (customerName.length < 3) throw new Error("Nome do pagador é obrigatório para o PIX.");

    // Mesmo backstop contra cobrança dupla usado no cartão.
    const { data: existing } = await supabase
      .from("platform_subscriptions")
      .select("gateway, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      existing?.gateway === "stripe" &&
      existing.status === "active" &&
      new Date(existing.current_period_end).getTime() > Date.now()
    ) {
      logStep("Blocked: user has an active Stripe subscription", { userId: user.id });
      return new Response(JSON.stringify({
        error: "stripe_subscription_active",
        message: "Você já possui uma assinatura ativa com renovação automática. Gerencie-a pelo portal de cobrança.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 });
    }

    const items = [{
      title: PLAN_LABELS[plan] ?? plan,
      unitPrice: planPrice,
      quantity: 1,
      tangible: false,
      externalRef: `plan-${plan}`,
    }];

    if (includeImplementation) {
      items.push({
        title: "Implementação Completa",
        unitPrice: IMPLEMENTATION_PRICE_CENTS,
        quantity: 1,
        tangible: false,
        externalRef: "implementation",
      });
    }

    const amount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const externalRef = `sub_${plan}_${user.id}_${Date.now()}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const postbackUrl = `${supabaseUrl}/functions/v1/hypercash-webhook?token=${encodeURIComponent(webhookToken)}`;

    const clientIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;

    const payload: Record<string, unknown> = {
      amount,
      paymentMethod: "PIX",
      // expiresInSeconds: prazo de pagamento do QR/copia-e-cola.
      pix: { expiresInSeconds: 3600 },
      customer: {
        name: customerName,
        email: user.email,
        document: { number: documentNumber, type: "CPF" },
        ...(customer?.phone ? { phone: String(customer.phone).replace(/\D/g, "") } : {}),
      },
      items,
      shipping: { fee: 0 },
      traceable: false,
      ...(clientIp ? { ip: clientIp } : {}),
      postbackUrl,
      metadata: {
        user_id: user.id,
        plan,
        include_implementation: includeImplementation ? "1" : "0",
        external_ref: externalRef,
      },
    };

    logStep("Creating HyperCash PIX transaction", { amount, plan, includeImplementation });

    const transaction = await hypercashRequest<HyperCashTransaction & Record<string, unknown>>(
      "/api/user/transactions",
      { secretKey, method: "POST", body: payload },
    );

    logStep("PIX transaction created", { id: transaction?.id, status: transaction?.status });

    if (!transaction?.id) throw new Error("HyperCash não retornou id da transação");

    await supabase
      .from("platform_transactions")
      .upsert({
        user_id: user.id,
        gateway: "hypercash",
        gateway_transaction_id: String(transaction.id),
        amount_cents: amount,
        status: String(transaction.status ?? "processing"),
        plan,
        payment_method: "pix",
        include_implementation: !!includeImplementation,
        raw: transaction as unknown as Record<string, unknown>,
      }, { onConflict: "gateway,gateway_transaction_id" });

    // PIX às vezes confirma na hora (ambiente de teste); mantém o mesmo padrão do cartão.
    let activated = false;
    if (isPaidStatus(transaction.status)) {
      if (await claimTransactionForActivation(supabase, String(transaction.id))) {
        await activateSubscription(supabase, {
          userId: user.id,
          plan,
          gateway: "hypercash",
          transactionId: String(transaction.id),
          hypercashCustomerId: transaction.customer?.id ?? null,
        });
        logStep("Activated immediately", { userId: user.id, plan });
      }
      activated = true;
    }

    // Tentativas mais prováveis de onde a HyperCash coloca o copia-e-cola/QR.
    // `pix_raw` fica só para diagnóstico enquanto confirmamos o shape real.
    const t = transaction as Record<string, unknown>;
    const pix = (t.pix ?? t.qrcode ?? t.qrCode) as Record<string, unknown> | undefined;
    const qrCode = (pix?.payload ?? pix?.qrcode ?? pix?.code ?? pix?.copyPaste ?? t.pixCopyPaste ?? t.qrCodeText) as string | undefined;
    const qrCodeBase64 = (pix?.image ?? pix?.qrcodeBase64 ?? pix?.imageBase64 ?? t.pixQrCodeBase64) as string | undefined;

    return new Response(JSON.stringify({
      success: true,
      payment_id: String(transaction.id),
      status: transaction.status,
      activated,
      amount: amount / 100,
      plan,
      qr_code: qrCode ?? null,
      qr_code_base64: qrCodeBase64 ?? null,
      pix_raw: qrCode ? undefined : t,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = hypercashErrorDetails(error);
    logStep("ERROR", { message, ...(details ?? {}) });
    return new Response(JSON.stringify({ error: message, ...(details ?? {}) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
