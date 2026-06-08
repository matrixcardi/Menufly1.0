import { Tables } from "@/integrations/supabase/types";
import { maskCpfCnpj } from "@/utils/cpfCnpj";

type Order = Tables<"orders">;

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
};

interface OrderReceiptProps {
  order: Order;
  restaurantName?: string;
}

export function OrderReceipt({ order, restaurantName }: OrderReceiptProps) {
  const items = order.items as Array<{
    name: string;
    quantity: number;
    price: number;
    addons?: Record<string, string[]> | Array<{ name: string; price: number }>;
    addonNames?: Record<string, string>;
    notes?: string;
  }>;

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const now = new Date();
  const createdAt = new Date(order.created_at || "");

  return (
    <div
      style={{
        width: "80mm",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "16px",
        lineHeight: "1.5",
        color: "#000",
        background: "#fff",
        padding: "4mm",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "20px", fontWeight: "bold" }}>
          {restaurantName || "Restaurante"}
        </div>
        <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />
        <div style={{ fontSize: "22px", fontWeight: "bold" }}>
          PEDIDO #{order.daily_number ?? order.order_number}
        </div>
        <div style={{ fontSize: "14px" }}>
          {createdAt.toLocaleDateString("pt-BR")} às{" "}
          {createdAt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            marginTop: "4px",
            padding: "2px 8px",
            border: "1px solid #000",
            display: "inline-block",
          }}
        >
          {order.delivery_type === "delivery" ? "🛵 ENTREGA" : "🏪 RETIRADA"}
        </div>
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

      {/* Customer */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold" }}>CLIENTE:</div>
        <div>{order.customer_name}</div>
        <div>📞 {order.customer_phone}</div>
        {(order as any).cpf_cnpj_nota && (
          <div>📄 CPF NA NOTA: {maskCpfCnpj((order as any).cpf_cnpj_nota)}</div>
        )}
        {order.delivery_type === "delivery" && order.customer_address && (
          <div>📍 {order.customer_address}</div>
        )}
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

      {/* Items */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>ITENS:</div>
        {items.map((item, index) => (
          <div key={index} style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
            {item.addons && (() => {
              const qty = item.quantity;
              if (Array.isArray(item.addons)) {
                // Legacy format: Array of objects
                return item.addons.map((addon: any, i: number) => (
                  <div key={i} style={{ paddingLeft: "12px", fontSize: "14px", color: "#444", display: "flex", justifyContent: "space-between" }}>
                    <span>+ {qty > 1 ? `${qty}x ` : ""}{addon.name}</span>
                    {addon.price > 0 && <span>{formatCurrency(addon.price * qty)}</span>}
                  </div>
                ));
              }
              // Check if it's the new quantity format (object with numbers) or old ID format (array of strings)
              const firstGroup = Object.values(item.addons)[0];
              if (firstGroup && typeof firstGroup === 'object' && !Array.isArray(firstGroup)) {
                // New quantity format: { "uuid1": 2, "uuid2": 1 }
                const allAddons = Object.entries(item.addons).flatMap(([_, addonQtyMap]) =>
                  Object.entries(addonQtyMap).map(([addonId, qty]) => ({ addonId, qty }))
                ).filter(({ qty }) => qty > 0);

                return allAddons.map(({ addonId, qty }) => {
                  const name = item.addonNames?.[addonId] || addonId;
                  const totalQty = qty * item.quantity;
                  const qtyPrefix = totalQty > 1 ? `${totalQty}x ` : "";
                  return (
                    <div key={addonId} style={{ paddingLeft: "12px", fontSize: "14px", color: "#444" }}>
                      + {qtyPrefix}{name}
                    </div>
                  );
                });
              } else {
                // Old ID format: { "group1": ["uuid1", "uuid2"] }
                const allIds = Object.values(item.addons).flat();
                return allIds.map((id, i) => {
                  const name = item.addonNames?.[id] || id;
                  return (
                    <div key={i} style={{ paddingLeft: "12px", fontSize: "14px", color: "#444" }}>
                      + {qty > 1 ? `${qty}x ` : ""}{name}
                    </div>
                  );
                });
              }
            })()}
            {item.notes && (
              <div style={{ paddingLeft: "12px", fontSize: "14px", fontWeight: "bold", color: "#000", marginTop: "2px" }}>
                📝 OBS: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && (
        <>
          <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontWeight: "bold" }}>📝 OBSERVAÇÕES:</div>
            <div>{order.notes}</div>
          </div>
        </>
      )}

      <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

      {/* Totals */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span>
          <span>{formatCurrency(Number(order.subtotal))}</span>
        </div>
        {Number(order.discount) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Desconto</span>
            <span>-{formatCurrency(Number(order.discount))}</span>
          </div>
        )}
        {Number(order.delivery_fee) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Taxa entrega</span>
            <span>{formatCurrency(Number(order.delivery_fee))}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "20px",
            marginTop: "4px",
          }}
        >
          <span>TOTAL</span>
          <span>{formatCurrency(Number(order.total))}</span>
        </div>
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

      {/* Payment */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold" }}>
          💳 {paymentMethodLabels[order.payment_method] || order.payment_method}
        </div>
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

      {/* Footer */}
      <div
        style={{ textAlign: "center", fontSize: "12px", color: "#666" }}
      >
        Impresso em {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        <br />
        Powered by MenuFly
      </div>
    </div>
  );
}

export function printOrder(order: Order, restaurantName?: string, addonNamesCache?: Record<string, string>, addonPricesCache?: Record<string, number>) {
  const printWindow = window.open("", "_blank", "width=350,height=600");
  if (!printWindow) return;

  const items = order.items as Array<{
    name: string;
    quantity: number;
    price: number;
    addons?: Record<string, string[]> | Array<{ name: string; price: number }>;
    addonNames?: Record<string, string>;
    notes?: string;
  }>;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const createdAt = new Date(order.created_at || "");
  const now = new Date();

  const payLabels: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    card: "Cartão",
  };

  const itemsHtml = items
    .map((item) => {
      let addonsHtml = "";
      if (item.addons) {
        const qty = item.quantity;
        const qtyPrefix = qty > 1 ? `${qty}x ` : "";
        if (Array.isArray(item.addons)) {
          // Legacy format: Array of objects
          addonsHtml = item.addons
            .map((a: any) => `<div style="padding-left:12px;font-size:14px;color:#444;display:flex;justify-content:space-between"><span>+ ${qtyPrefix}${a.name}</span>${a.price > 0 ? `<span>${fmt(a.price * qty)}</span>` : ""}</div>`)
            .join("");
        } else {
          // Check if it's the new quantity format (object with numbers) or old ID format (array of strings)
          const firstGroup = Object.values(item.addons)[0];
          if (firstGroup && typeof firstGroup === 'object' && !Array.isArray(firstGroup)) {
            // New quantity format: { "uuid1": 2, "uuid2": 1 }
            const allAddons = Object.entries(item.addons).flatMap(([_, addonQtyMap]) =>
              Object.entries(addonQtyMap).map(([addonId, qty]) => ({ addonId, qty }))
            ).filter(({ qty }) => qty > 0);

            addonsHtml = allAddons
              .map(({ addonId, qty }) => {
                const name = item.addonNames?.[addonId] || addonNamesCache?.[addonId] || addonId;
                const price = addonPricesCache?.[addonId];
                const totalQty = qty * item.quantity;
                const totalQtyPrefix = totalQty > 1 ? `${totalQty}x ` : "";
                const priceStr = price != null && price > 0 ? ` ${fmt(price * totalQty)}` : "";
                return `<div style="padding-left:12px;font-size:14px;color:#444;display:flex;justify-content:space-between"><span>+ ${totalQtyPrefix}${name}</span>${priceStr ? `<span>${priceStr.trim()}</span>` : ""}</div>`;
              })
              .join("");
          } else {
            // Old ID format: { "group1": ["uuid1", "uuid2"] }
            const allIds = Object.values(item.addons).flat();
            addonsHtml = allIds
              .map((id) => {
                const name = item.addonNames?.[id] || addonNamesCache?.[id] || id;
                const price = addonPricesCache?.[id];
                const priceStr = price != null && price > 0 ? ` ${fmt(price * qty)}` : "";
                return `<div style="padding-left:12px;font-size:14px;color:#444;display:flex;justify-content:space-between"><span>+ ${qtyPrefix}${name}</span>${priceStr ? `<span>${priceStr.trim()}</span>` : ""}</div>`;
              })
              .join("");
          }
        }
      }
      const notesHtml = item.notes
        ? `<div style="padding-left:12px;font-size:14px;font-weight:bold;color:#000;margin-top:2px">📝 OBS: ${item.notes}</div>`
        : "";
      return `<div style="margin-bottom:4px"><div style="display:flex;justify-content:space-between"><span>${item.quantity}x ${item.name}</span><span>${fmt(item.price * item.quantity)}</span></div>${addonsHtml}${notesHtml}</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido #${order.daily_number ?? order.order_number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.5; color: #000; width: 80mm; margin: 0 auto; padding: 4mm; }
  .sep { border-bottom: 1px dashed #000; margin: 6px 0; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .flex { display: flex; justify-content: space-between; }
</style></head><body>
<div class="center"><div style="font-size:20px" class="bold">${restaurantName || "Restaurante"}</div></div>
<div class="sep"></div>
<div class="center"><div style="font-size:22px" class="bold">PEDIDO #${order.daily_number ?? order.order_number}</div>
<div style="font-size:14px">${createdAt.toLocaleDateString("pt-BR")} às ${createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
<div class="bold" style="font-size:16px;margin-top:4px;padding:2px 8px;border:1px solid #000;display:inline-block">${order.delivery_type === "delivery" ? "🛵 ENTREGA" : "🏪 RETIRADA"}</div></div>
<div class="sep"></div>
<div><div class="bold">CLIENTE:</div><div>${order.customer_name}</div><div>📞 ${order.customer_phone}</div>${(order as any).cpf_cnpj_nota ? `<div>📄 CPF NA NOTA: ${maskCpfCnpj((order as any).cpf_cnpj_nota)}</div>` : ""}${order.delivery_type === "delivery" && order.customer_address ? `<div>📍 ${order.customer_address}</div>` : ""}</div>
<div class="sep"></div>
<div><div class="bold" style="margin-bottom:4px">ITENS:</div>${itemsHtml}</div>
${order.notes ? `<div class="sep"></div><div><div class="bold">📝 OBSERVAÇÕES:</div><div>${order.notes}</div></div>` : ""}
<div class="sep"></div>
<div>
<div class="flex"><span>Subtotal</span><span>${fmt(Number(order.subtotal))}</span></div>
${Number(order.discount) > 0 ? `<div class="flex"><span>Desconto</span><span>-${fmt(Number(order.discount))}</span></div>` : ""}
${Number(order.delivery_fee) > 0 ? `<div class="flex"><span>Taxa entrega</span><span>${fmt(Number(order.delivery_fee))}</span></div>` : ""}
<div class="flex bold" style="font-size:20px;margin-top:4px"><span>TOTAL</span><span>${fmt(Number(order.total))}</span></div>
</div>
<div class="sep"></div>
<div class="center bold">💳 ${payLabels[order.payment_method] || order.payment_method}</div>
<div class="sep"></div>
<div class="center" style="font-size:12px;color:#666">Impresso em ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}<br/>Powered by MenuFly</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printBatchOrders(
  orders: Order[],
  restaurantName?: string,
  addonNamesCache?: Record<string, string>,
  addonPricesCache?: Record<string, number>
) {
  const printWindow = window.open("", "_blank", "width=350,height=600");
  if (!printWindow) return;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const now = new Date();

  const payLabels: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    card: "Cartão",
  };

  // Generate HTML for each order with page break
  const ordersHtml = orders.map((order) => {
    const items = order.items as Array<{
      name: string;
      quantity: number;
      price: number;
      addons?: Record<string, string[]> | Record<string, Record<string, number>> | Array<{ name: string; price: number }>;
      addonNames?: Record<string, string>;
      notes?: string;
    }>;

    const createdAt = new Date(order.created_at || "");

    const itemsHtml = items
      .map((item) => {
        let addonsHtml = "";
        if (item.addons) {
          const qty = item.quantity;
          const qtyPrefix = qty > 1 ? `${qty}x ` : "";
          if (Array.isArray(item.addons)) {
            // Legacy format: Array of objects
            addonsHtml = item.addons
              .map((a: any) => `<div style="padding-left:12px;font-size:14px;color:#444;display:flex;justify-content:space-between"><span>+ ${qtyPrefix}${a.name}</span>${a.price > 0 ? `<span>${fmt(a.price * qty)}</span>` : ""}</div>`)
              .join("");
          } else {
            // Check if it's the new quantity format (object with numbers) or old ID format (array of strings)
            const firstGroup = Object.values(item.addons)[0];
            if (firstGroup && typeof firstGroup === 'object' && !Array.isArray(firstGroup)) {
              // New quantity format: { "uuid1": 2, "uuid2": 1 }
              const allAddons = Object.entries(item.addons).flatMap(([_, addonQtyMap]) =>
                Object.entries(addonQtyMap).map(([addonId, qty]) => ({ addonId, qty }))
              ).filter(({ qty }) => qty > 0);

              addonsHtml = allAddons
                .map(({ addonId, qty }) => {
                  const name = item.addonNames?.[addonId] || addonNamesCache?.[addonId] || addonId;
                  const price = addonPricesCache?.[addonId];
                  const totalQty = qty * item.quantity;
                  const totalQtyPrefix = totalQty > 1 ? `${totalQty}x ` : "";
                  const priceStr = price != null && price > 0 ? ` ${fmt(price * totalQty)}` : "";
                  return `<div style="padding-left:12px;font-size:14px;color:#444;display:flex;justify-content:space-between"><span>+ ${totalQtyPrefix}${name}</span>${priceStr ? `<span>${priceStr.trim()}</span>` : ""}</div>`;
                })
                .join("");
            } else {
              // Old ID format: { "group1": ["uuid1", "uuid2"] }
              const allIds = Object.values(item.addons).flat();
              addonsHtml = allIds
                .map((id) => {
                  const name = item.addonNames?.[id] || addonNamesCache?.[id] || id;
                  const price = addonPricesCache?.[id];
                  const priceStr = price != null && price > 0 ? ` ${fmt(price * qty)}` : "";
                  return `<div style="padding-left:12px;font-size:14px;color:#444;display:flex;justify-content:space-between"><span>+ ${qtyPrefix}${name}</span>${priceStr ? `<span>${priceStr.trim()}</span>` : ""}</div>`;
                })
                .join("");
            }
          }
        }
        const notesHtml = item.notes
          ? `<div style="padding-left:12px;font-size:14px;font-weight:bold;color:#000;margin-top:2px">📝 OBS: ${item.notes}</div>`
          : "";
        return `<div style="margin-bottom:4px"><div style="display:flex;justify-content:space-between"><span>${item.quantity}x ${item.name}</span><span>${fmt(item.price * item.quantity)}</span></div>${addonsHtml}${notesHtml}</div>`;
      })
      .join("");

    const orderHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido #${order.daily_number ?? order.order_number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.5; color: #000; width: 80mm; margin: 0 auto; padding: 4mm; }
  .sep { border-bottom: 1px dashed #000; margin: 6px 0; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .flex { display: flex; justify-content: space-between; }
</style></head><body>
<div class="center"><div style="font-size:20px" class="bold">${restaurantName || "Restaurante"}</div></div>
<div class="sep"></div>
<div class="center"><div style="font-size:22px" class="bold">PEDIDO #${order.daily_number ?? order.order_number}</div>
<div style="font-size:14px">${createdAt.toLocaleDateString("pt-BR")} às ${createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
<div class="bold" style="font-size:16px;margin-top:4px;padding:2px 8px;border:1px solid #000;display:inline-block">${order.delivery_type === "delivery" ? "🛵 ENTREGA" : "🏪 RETIRADA"}</div></div>
<div class="sep"></div>
<div><div class="bold">CLIENTE:</div><div>${order.customer_name}</div><div>📞 ${order.customer_phone}</div>${(order as any).cpf_cnpj_nota ? `<div>📄 CPF NA NOTA: ${maskCpfCnpj((order as any).cpf_cnpj_nota)}</div>` : ""}${order.delivery_type === "delivery" && order.customer_address ? `<div>📍 ${order.customer_address}</div>` : ""}</div>
<div class="sep"></div>
<div><div class="bold" style="margin-bottom:4px">ITENS:</div>${itemsHtml}</div>
${order.notes ? `<div class="sep"></div><div><div class="bold">📝 OBSERVAÇÕES:</div><div>${order.notes}</div></div>` : ""}
<div class="sep"></div>
<div>
<div class="flex"><span>Subtotal</span><span>${fmt(Number(order.subtotal))}</span></div>
${Number(order.discount) > 0 ? `<div class="flex"><span>Desconto</span><span>-${fmt(Number(order.discount))}</span></div>` : ""}
${Number(order.delivery_fee) > 0 ? `<div class="flex"><span>Taxa entrega</span><span>${fmt(Number(order.delivery_fee))}</span></div>` : ""}
<div class="flex bold" style="font-size:20px;margin-top:4px"><span>TOTAL</span><span>${fmt(Number(order.total))}</span></div>
</div>
<div class="sep"></div>
<div class="center bold">💳 ${payLabels[order.payment_method] || order.payment_method}</div>
<div class="sep"></div>
<div class="center" style="font-size:12px;color:#666">Impresso em ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}<br/>Powered by MenuFly</div>
</body></html>`;

    return orderHtml;
  }).join('<div style="page-break-after: always;"></div>');

  printWindow.document.write(ordersHtml);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 100);
}
