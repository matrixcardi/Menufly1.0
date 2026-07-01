// Emite uma NFC-e real via Spedy para um pedido do MenuFly.
// Substitui a simulação anterior (setTimeout + número fake) do EmitirNFeButton.
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient, requireRestaurantAccess } from "../_shared/spedy-auth.ts";
import { spedyRequest, SpedyApiError } from "../_shared/spedy-client.ts";

interface OrderItemAddon {
  [addonGroupId: string]: string | string[];
}

interface OrderItem {
  productId?: string;
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  addons?: OrderItemAddon;
  addonNames?: Record<string, string>;
  addonsTotal?: number;
  notes?: string | null;
}

// A Spedy exige um `status` inicial só para saber o que já foi processado —
// mapeamos o InvoiceStatus deles para o enum interno de fiscal_invoices.
function mapSpedyStatus(status: string | undefined): "processing" | "authorized" | "cancelled" | "error" {
  switch (status) {
    case "authorized":
      return "authorized";
    case "canceled":
    case "disabled":
    case "removed":
      return "cancelled";
    case "rejected":
    case "denied":
      return "error";
    default:
      return "processing"; // created, enqueued, received, inContingent
  }
}

function cleanDoc(doc: string): string {
  return doc.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { order_id } = await req.json();
    if (!order_id) return jsonResponse(400, { error: "order_id é obrigatório" });

    const supabase = createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, restaurant_id, order_number, daily_number, customer_name, customer_phone, cpf_cnpj_nota, payment_method, subtotal, discount, delivery_fee, total, items")
      .eq("id", order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse(404, { error: "Pedido não encontrado." });

    const access = await requireRestaurantAccess(supabase, req, order.restaurant_id);
    if (!access.ok) return jsonResponse(access.status, { error: access.error });

    const { data: config } = await supabase
      .from("fiscal_config")
      .select("environment, regime_tributario, default_ncm, default_cfop, is_active, is_configured")
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();
    const { data: secrets } = await supabase
      .from("fiscal_secrets")
      .select("spedy_api_key")
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();

    if (!config || !config.is_configured || !secrets) {
      return jsonResponse(400, { error: "Módulo fiscal não configurado para este restaurante." });
    }
    if (!config.is_active) {
      return jsonResponse(400, { error: "Emissão fiscal está desativada para este restaurante." });
    }
    // Defesa em profundidade: a UI já trava isso no wizard, mas o backend não
    // confia só nela — v1 só sabe montar tributação de Simples Nacional.
    if (config.regime_tributario !== "simples_nacional") {
      return jsonResponse(400, { error: "Regime tributário ainda não suportado para emissão automática." });
    }

    // Reserva a linha antes de chamar a Spedy — o índice único parcial em
    // fiscal_invoices(order_id) barra duas emissões simultâneas para o mesmo pedido.
    const { data: invoice, error: insertError } = await supabase
      .from("fiscal_invoices")
      .insert({ restaurant_id: order.restaurant_id, order_id: order.id, provider: "spedy", status: "processing" })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse(409, { error: "Já existe uma nota fiscal em processamento ou emitida para este pedido." });
      }
      throw insertError;
    }

    const items = (order.items ?? []) as OrderItem[];
    const invoiceItems = items.map((item) => {
      const unitAmount = Number(item.price) + Number(item.addonsTotal ?? 0);
      const addonLabels = item.addonNames ? Object.values(item.addonNames).filter(Boolean) : [];
      const description = addonLabels.length > 0 ? `${item.name} (+ ${addonLabels.join(", ")})` : item.name;
      // productId/product_id: histórico do checkout já variou de nome de campo;
      // como fallback usamos um código sintético estável a partir do nome.
      const code = item.productId || item.product_id || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);

      return {
        code,
        description,
        ncm: config.default_ncm,
        cfop: Number(config.default_cfop),
        unit: "UN",
        quantity: item.quantity,
        unitAmount,
        totalAmount: Number((unitAmount * item.quantity).toFixed(2)),
        unitTax: "UN",
        quantityTax: item.quantity,
        unitTaxAmount: unitAmount,
        makeupTotal: true,
        taxes: {
          icms: { origin: 0, csosn: 400 },
          pis: { cst: 7 },
          cofins: { cst: 7 },
        },
      };
    });

    const productAmount = invoiceItems.reduce((sum, i) => sum + i.totalAmount, 0);

    const paymentMethodMap: Record<string, string> = {
      pix: "pix",
      cash: "money",
      card: "creditCard", // schema atual não distingue crédito/débito
      pix_delivery: "pix",
    };

    const receiver = order.cpf_cnpj_nota
      ? { name: order.customer_name, federalTaxNumber: cleanDoc(order.cpf_cnpj_nota) }
      : undefined;

    const payload = {
      integrationId: order.id,
      isFinalCustomer: true,
      operationType: "outgoing",
      destination: "internal",
      presenceType: "delivery",
      operationNature: "Venda de Mercadoria",
      sendEmailToCustomer: false,
      receiver,
      items: invoiceItems,
      payments: [
        { method: paymentMethodMap[order.payment_method] ?? "other", amount: Number(order.total) },
      ],
      total: {
        invoiceAmount: Number(order.total),
        productAmount: Number(productAmount.toFixed(2)),
        freightAmount: Number(order.delivery_fee ?? 0),
        discountAmount: Number(order.discount ?? 0),
      },
    };

    try {
      const result = await spedyRequest<{ id: string; status?: string }>("/consumer-invoices", {
        apiKey: secrets.spedy_api_key,
        environment: config.environment,
        method: "POST",
        body: payload,
      });

      await supabase
        .from("fiscal_invoices")
        .update({ provider_id: result.id, status: mapSpedyStatus(result.status), updated_at: new Date().toISOString() })
        .eq("id", invoice.id);

      return jsonResponse(200, { success: true, invoice_id: invoice.id, provider_id: result.id, status: mapSpedyStatus(result.status) });
    } catch (err) {
      const message = err instanceof SpedyApiError ? err.message : (err instanceof Error ? err.message : "Erro desconhecido");
      await supabase
        .from("fiscal_invoices")
        .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
        .eq("id", invoice.id);
      return jsonResponse(400, { error: message });
    }
  } catch (err) {
    console.error("[spedy-issue-invoice] error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return jsonResponse(500, { error: message });
  }
});
