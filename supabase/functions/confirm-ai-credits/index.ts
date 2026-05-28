import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

  try {
    const body = await req.json();
    console.log("AI Credits webhook received:", JSON.stringify(body));

    if (body.type !== "payment" && body.action !== "payment.created") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });

    const payment = await paymentResponse.json();
    console.log("Payment status:", payment.status, "External ref:", payment.external_reference);

    if (payment.status !== "approved") {
      return new Response(JSON.stringify({ ok: true, status: payment.status }), { status: 200 });
    }

    let refData: any;
    try {
      refData = JSON.parse(payment.external_reference);
    } catch {
      console.log("Not an AI credits payment");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (refData.type !== "ai_credits") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const { restaurantId, credits } = refData;

    // Idempotency check
    const { data: existingTx } = await supabase
      .from("ai_credit_transactions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("type", "purchase")
      .eq("description", `mp_payment_${paymentId}`)
      .maybeSingle();

    if (!existingTx) {
      const { data: existing } = await supabase
        .from("ai_credits")
        .select("balance, total_purchased")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_credits")
          .update({
            balance: existing.balance + credits,
            total_purchased: existing.total_purchased + credits,
            updated_at: new Date().toISOString(),
          })
          .eq("restaurant_id", restaurantId);
      } else {
        await supabase
          .from("ai_credits")
          .insert({
            restaurant_id: restaurantId,
            balance: credits,
            total_purchased: credits,
          });
      }

      await supabase
        .from("ai_credit_transactions")
        .insert({
          restaurant_id: restaurantId,
          amount: credits,
          type: "purchase",
          description: `mp_payment_${paymentId}`,
        });
    }

    console.log(`Added ${credits} AI credits to restaurant ${restaurantId}`);

    return new Response(JSON.stringify({ ok: true, credits_added: credits }), { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
