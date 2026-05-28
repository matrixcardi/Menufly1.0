import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

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
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const checkInstanceConnected = async (instanceName: string): Promise<boolean> => {
    try {
      const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
        method: "GET",
        headers: { apikey: EVOLUTION_API_KEY! },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.instance?.state === "open";
    } catch (e) {
      console.warn("connectionState check failed:", e instanceof Error ? e.message : e);
      return false;
    }
  };

  const syncConnectionFlag = async (instanceName: string, connected: boolean) => {
    try {
      await supabase
        .from("restaurants")
        .update({ whatsapp_connected: connected })
        .eq("whatsapp_instance_name", instanceName);
    } catch (e) {
      console.warn("Failed to sync whatsapp_connected flag:", e instanceof Error ? e.message : e);
    }
  };

  const sendText = async (instanceName: string, remoteJid: string, text: string, disablePreview = false) => {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({ number: remoteJid, text, linkPreview: !disablePreview }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Evolution sendText failed [${res.status}] for ${instanceName}: ${errText}`);
      // If instance is offline/not found, mark restaurant as disconnected so UI is accurate.
      if (res.status === 404 || /not\s*found|instance.*does.*not.*exist|state.*close|not.*connected/i.test(errText)) {
        await syncConnectionFlag(instanceName, false);
      }
      throw new Error(`Evolution API error ${res.status}: ${errText.slice(0, 200)}`);
    }
    return res.json().catch(() => ({}));
  };

  try {
    const body = await req.json();
    let { action } = body;

    // Evolution API webhook posts payloads like { event: "messages.upsert", instance, data, ... }
    // Map those directly to our handle_webhook action so the same function can serve as the webhook URL.
    if (!action && body?.event) {
      const ev = String(body.event).toLowerCase();
      if (ev.includes("messages.upsert") || ev.includes("messages_upsert")) {
        action = "handle_webhook";
      } else {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── Action: send_order_confirmation ─────────────────────────────
    if (action === "send_order_confirmation") {
      const { restaurant_id, order_id } = body;

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("bot_enabled, bot_order_updates, whatsapp_instance_name, whatsapp_connected, slug, name, default_delivery_time_min")
        .eq("id", restaurant_id)
        .maybeSingle();

      if (!restaurant || !restaurant.bot_enabled || !restaurant.bot_order_updates) {
        return new Response(JSON.stringify({ success: false, reason: "Bot disabled or order updates off" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Always verify the real Evolution API state — the DB flag can be stale.
      const liveConnected = restaurant.whatsapp_instance_name
        ? await checkInstanceConnected(restaurant.whatsapp_instance_name)
        : false;
      if (liveConnected !== !!restaurant.whatsapp_connected) {
        await syncConnectionFlag(restaurant.whatsapp_instance_name, liveConnected);
      }
      if (!liveConnected) {
        return new Response(JSON.stringify({ success: false, reason: "WhatsApp instance not connected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .maybeSingle();

      if (!order) {
        return new Response(JSON.stringify({ success: false, reason: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderNum = order.daily_number ?? order.order_number;

      // Build items text
      const items = order.items as any[];
      let itemsText = "";
      for (const item of items) {
        itemsText += `\n➡ ${item.quantity}x ${item.name}`;
        // Show addon details if present
        if (item.addonNames && typeof item.addonNames === "object") {
          for (const [groupName, addonList] of Object.entries(item.addonNames)) {
            if (Array.isArray(addonList) && addonList.length > 0) {
              itemsText += `\n      ${groupName}`;
              for (const addon of addonList) {
                itemsText += `\n          ${typeof addon === "string" ? addon : (addon as any).name || addon}`;
              }
            }
          }
        }
        if (item.notes) {
          itemsText += `\n      📝 ${item.notes}`;
        }
      }

      // Payment method
      const paymentLabels: Record<string, string> = {
        pix: "💳 PIX",
        cash: "💵 Dinheiro",
        card: "💳 Cartão Online",
        card_on_delivery: "💳 Cartão na Entrega",
      };
      let paymentText = paymentLabels[order.payment_method] || order.payment_method;
      // Check for change note
      if (order.payment_method === "cash" && order.notes?.includes("Troco para:")) {
        const changeMatch = order.notes.match(/Troco para:\s*(.+)/);
        if (changeMatch) {
          paymentText += ` (troco para ${changeMatch[1]})`;
        }
      }

      // Delivery info
      const isDelivery = order.delivery_type === "delivery";
      const deliveryEmoji = isDelivery ? "🛵" : "🏪";
      const deliveryLabel = isDelivery ? "Delivery" : "Retirada";
      let deliveryText = `${deliveryEmoji} ${deliveryLabel}`;
      if (isDelivery && order.delivery_fee > 0) {
        deliveryText += ` (taxa de: ${formatCurrency(order.delivery_fee)})`;
      }

      // Address
      let addressText = "";
      if (isDelivery && order.customer_address) {
        addressText = `\n🏠 ${order.customer_address}`;
      }

      // Delivery estimate
      let estimateText = "";
      if (isDelivery && restaurant.default_delivery_time_min) {
        const minTime = restaurant.default_delivery_time_min;
        const maxTime = Math.round(minTime * 1.7);
        estimateText = `\n(Estimativa: entre ${minTime}~${maxTime} minutos)`;
      }

      // Discount
      let discountText = "";
      if (order.discount && order.discount > 0) {
        discountText = `\n🏷️ Desconto: -${formatCurrency(order.discount)}`;
      }

      const customerFirstName = order.customer_name?.split(" ")[0] || "Cliente";

      const message = `${customerFirstName}, o pedido Nº ${orderNum} está em produção! 🍔

📋 *Pedido nº ${orderNum}*

Itens:
${itemsText}

${paymentText}
${deliveryText}${addressText}${estimateText}${discountText}

*Total: ${formatCurrency(order.total)}*

Obrigado pela preferência, se precisar de algo é só chamar! 😉`;

      const phone = order.customer_phone.replace(/\D/g, "");
      const remoteJid = `55${phone}@s.whatsapp.net`.replace("5555", "55");

      await sendText(restaurant.whatsapp_instance_name, remoteJid, message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: send_status_update ──────────────────────────────────
    if (action === "send_status_update") {
      const { restaurant_id, order_id, new_status } = body;

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("bot_enabled, bot_order_updates, bot_feedback_enabled, google_review_link, bot_greeting_message, whatsapp_instance_name, whatsapp_connected, slug, name")
        .eq("id", restaurant_id)
        .maybeSingle();

      if (!restaurant || !restaurant.bot_enabled || !restaurant.bot_order_updates) {
        return new Response(JSON.stringify({ success: false, reason: "Bot disabled or order updates off" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const liveConnected2 = restaurant.whatsapp_instance_name
        ? await checkInstanceConnected(restaurant.whatsapp_instance_name)
        : false;
      if (liveConnected2 !== !!restaurant.whatsapp_connected) {
        await syncConnectionFlag(restaurant.whatsapp_instance_name, liveConnected2);
      }
      if (!liveConnected2) {
        return new Response(JSON.stringify({ success: false, reason: "WhatsApp instance not connected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order } = await supabase
        .from("orders")
        .select("daily_number, order_number, customer_phone, customer_name, delivery_type")
        .eq("id", order_id)
        .maybeSingle();

      if (!order) {
        return new Response(JSON.stringify({ success: false, reason: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderNum = order.daily_number ?? order.order_number;

      const statusMessages: Record<string, string> = {
        preparing: `🔥 Seu pedido *#${orderNum}* está sendo preparado com muito carinho! Em breve ficará prontinho para você. 🍔👨‍🍳`,
        ready: `✅ Seu pedido *#${orderNum}* está pronto! 🎉🍔 Já pode vir buscar ou aguarde, estamos finalizando os detalhes para você!`,
        pickup_ready: `🏪 Seu pedido *#${orderNum}* está prontinho te esperando! 🎉 Pode vir buscar quando quiser, estamos te aguardando!`,
        out_for_delivery: `🛵 Seu pedido *#${orderNum}* saiu para entrega e já está a caminho! 🛵💨 Fique de olho, logo logo ele chega até você!`,
        delivered: `💚 Seu pedido *#${orderNum}* foi entregue! Esperamos que aproveite cada mordida. 😄🍔🔥\n\nObrigado por escolher a *${restaurant.name}*! Volte sempre! ❤️`,
        rejected: `❌ Ops! Infelizmente não conseguimos aceitar o seu pedido *#${orderNum}* no momento. 😔\n\nIsso pode ter acontecido por indisponibilidade de algum item ou por estarmos com alta demanda agora.\n\nCaso queira mais informações, digite "Falar com Atendente" e um de nossos atendentes irá te ajudar. Pedimos desculpas pelo transtorno! 🙏`,
        cancelled: `🚫 Seu pedido *#${orderNum}* foi cancelado. 😔\n\nSe você não solicitou o cancelamento ou tem alguma dúvida, digite "Falar com Atendente" e um de nossos atendentes estará pronto para te ajudar.\n\nEsperamos te atender melhor em breve! Obrigado pela compreensão. ❤️`,
      };

      const message = statusMessages[new_status];
      if (!message) {
        return new Response(JSON.stringify({ success: false, reason: "No message for status" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = restaurant.whatsapp_instance_name;
      const phone = order.customer_phone.replace(/\D/g, "");
      const remoteJid = `55${phone}@s.whatsapp.net`.replace("5555", "55");

      await sendText(instanceName, remoteJid, message);

      // If delivered + feedback enabled + google link exists, send feedback msg after short delay
      if (new_status === "delivered" && restaurant.bot_feedback_enabled && restaurant.google_review_link) {
        await new Promise(r => setTimeout(r, 2000));

        const feedbackMsg = `Ficamos felizes em atendê-lo! 😊\nQue tal nos avaliar no Google? Sua opinião é muito importante para nós!\n\n⭐ ${restaurant.google_review_link}`;

        await sendText(instanceName, remoteJid, feedbackMsg);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: handle_webhook ──────────────────────────────────────
    if (action === "handle_webhook") {
      const { instance, data: msgData } = body;

      if (!msgData?.key?.remoteJid || msgData?.key?.fromMe) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ignore group chats and broadcast lists
      const remoteJid: string = msgData.key.remoteJid;
      if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find restaurant by instance name
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, bot_enabled, bot_auto_reply_enabled, bot_greeting_message, slug, name")
        .eq("whatsapp_instance_name", instance)
        .maybeSingle();

      if (!restaurant || !restaurant.bot_enabled || restaurant.bot_auto_reply_enabled === false) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const senderPhone = remoteJid.replace("@s.whatsapp.net", "");

      // Cooldown: avoid spamming the same sender. Reply at most once every 4 hours.
      const COOLDOWN_HOURS = 4;
      const { data: convo } = await supabase
        .from("whatsapp_bot_conversations")
        .select("last_bot_reply_at")
        .eq("restaurant_id", restaurant.id)
        .eq("phone", senderPhone)
        .maybeSingle();

      if (convo?.last_bot_reply_at) {
        const last = new Date(convo.last_bot_reply_at).getTime();
        if (Date.now() - last < COOLDOWN_HOURS * 60 * 60 * 1000) {
          return new Response(JSON.stringify({ success: true, skipped: "cooldown" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const menuUrl = `https://menufly.com.br/${restaurant.slug}`;
      const greeting = (restaurant.bot_greeting_message && restaurant.bot_greeting_message.trim().length > 0)
        ? restaurant.bot_greeting_message
        : `Olá! 👋 Bem-vindo à ${restaurant.name}! Confira nosso cardápio completo:`;

      const replyMsg = `${greeting}

🍽️ ${menuUrl}

Caso queira falar com um atendente, digite: *Falar com Atendente* 😊`;

      await sendText(instance, remoteJid, replyMsg, true);

      // Upsert cooldown record
      await supabase
        .from("whatsapp_bot_conversations")
        .upsert(
          { restaurant_id: restaurant.id, phone: senderPhone, last_bot_reply_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "restaurant_id,phone" },
        );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("WhatsApp Bot Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
