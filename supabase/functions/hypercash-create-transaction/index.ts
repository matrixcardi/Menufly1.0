import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  hypercashRequest,
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
  console.log(`[HYPERCASH-CREATE-TRANSACTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // service_role: precisamos gravar em platform_transactions, que é fechada ao cliente.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Cliente separado só para validar o JWT do usuário.
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

    const body = await req.json();
    const { plan, includeImplementation, cardToken, customer, address, installments } = body ?? {};

    const planPrice = PLAN_PRICES_CENTS[plan];
    if (!planPrice) throw new Error("Plano inválido. Use 'start' ou 'elite'.");
    if (!cardToken) throw new Error("cardToken é obrigatório");
    if (!customer?.name || !customer?.document) {
      throw new Error("Nome e CPF do titular são obrigatórios");
    }

    const documentNumber = String(customer.document).replace(/\D/g, "");
    if (documentNumber.length !== 11) throw new Error("CPF inválido");

    // Backstop contra cobrança dupla. O /checkout já esconde o formulário de
    // quem é da base legada, mas essa guarda depende do check-subscription ter
    // respondido no browser. Cobrar duas vezes é irreversível do ponto de vista
    // do cliente, então a recusa definitiva mora aqui.
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

    // Assinatura é serviço: tangible = false e sem frete.
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
      paymentMethod: "CREDIT_CARD",
      // NOTA: a doc de tokenização (FastSoft.encrypt) não documenta o nome do
      // campo do token no corpo da transação. `card.token` é a hipótese; se a
      // HyperCash recusar, conferir com o suporte antes de mudar qualquer outra coisa.
      card: {
        token: cardToken,
        installments: Number(installments) > 0 ? Number(installments) : 1,
      },
      installments: Number(installments) > 0 ? Number(installments) : 1,
      customer: {
        name: customer.name,
        email: user.email,
        document: { number: documentNumber, type: "CPF" },
        ...(customer.phone ? { phone: String(customer.phone).replace(/\D/g, "") } : {}),
      },
      items,
      shipping: { fee: 0, ...(address ? { address } : {}) },
      traceable: false,
      ...(clientIp ? { ip: clientIp } : {}),
      postbackUrl,
      externalRef,
      metadata: {
        user_id: user.id,
        plan,
        include_implementation: includeImplementation ? "1" : "0",
      },
    };

    logStep("Creating HyperCash transaction", { amount, plan, includeImplementation });

    const transaction = await hypercashRequest<HyperCashTransaction>("/api/user/transactions", {
      secretKey,
      method: "POST",
      body: payload,
    });

    logStep("Transaction created", { id: transaction?.id, status: transaction?.status });

    if (!transaction?.id) throw new Error("HyperCash não retornou id da transação");

    // Auditoria. O UNIQUE(gateway, gateway_transaction_id) impede corrida com o webhook,
    // que pode chegar antes desta linha em pagamentos aprovados na hora.
    await supabase
      .from("platform_transactions")
      .upsert({
        user_id: user.id,
        gateway: "hypercash",
        gateway_transaction_id: String(transaction.id),
        amount_cents: amount,
        status: String(transaction.status ?? "processing"),
        plan,
        payment_method: "credit_card",
        include_implementation: !!includeImplementation,
        raw: transaction as unknown as Record<string, unknown>,
      }, { onConflict: "gateway,gateway_transaction_id" });

    // Cartão às vezes já volta aprovado. Nesse caso não faz sentido esperar o
    // webhook — mas o claim garante que ele não some outros 30 dias ao chegar.
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

    return new Response(JSON.stringify({
      success: true,
      transactionId: String(transaction.id),
      status: transaction.status,
      activated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
