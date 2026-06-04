// ─── SalaoReceipt.ts ─────────────────────────────────────────────────────────
// Funções de impressão para o módulo de Salão/Mesas do MenuFly
// Usa window.open + window.print(), mesmo padrão de OrderReceipt.tsx

interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  observation: string;
}

interface KitchenTicketParams {
  tableNumber: number;
  tableName: string;
  peopleCount: number | null;
  items: OrderItem[];
  round: string; // "primeira" | "adicional"
  restaurantName?: string;
}

interface CloseComandaParams {
  tableNumber: number;
  tableName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  peopleCount: number | null;
  restaurantName?: string;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const today = () => new Date().toLocaleDateString("pt-BR");

const payLabels: Record<string, string> = {
  cash: "Dinheiro",
  card: "Cartão",
  pix: "PIX",
  mixed: "Pagamento Misto",
};

// ── Kitchen Ticket ────────────────────────────────────────────────────────────

export function printKitchenTicket(params: KitchenTicketParams) {
  const { tableNumber, tableName, peopleCount, items, round, restaurantName } = params;
  const win = window.open("", "_blank", "width=350,height=500");
  if (!win) return;

  const itemsHtml = items.map(item => {
    const obsHtml = item.observation
      ? `<div style="padding-left:12px;font-weight:bold;color:#000;font-size:15px">📝 OBS: ${item.observation}</div>`
      : "";
    return `
      <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dotted #ccc">
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:bold">
          <span>${item.quantity}x ${item.name}</span>
        </div>
        ${obsHtml}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Comanda Mesa ${tableNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.5; color: #000; width: 80mm; margin: 0 auto; padding: 4mm; }
  .sep { border-bottom: 2px dashed #000; margin: 8px 0; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
</style></head><body>
<div class="center">
  <div style="font-size:18px" class="bold">${restaurantName || "Restaurante"}</div>
  <div class="sep"></div>
  <div style="font-size:28px;font-weight:900;letter-spacing:2px">🍽️ SALÃO</div>
  <div style="font-size:22px;font-weight:bold;margin-top:4px;padding:4px 12px;border:2px solid #000;display:inline-block">
    MESA ${tableNumber}
  </div>
  <div style="font-size:16px;margin-top:4px">${tableName}</div>
  ${peopleCount ? `<div style="font-size:14px">👥 ${peopleCount} pessoas</div>` : ""}
  <div style="font-size:14px">🕐 ${now()} · ${today()}</div>
</div>
<div class="sep"></div>
<div style="font-size:14px;text-align:center;font-weight:bold;margin-bottom:4px">
  ${round === "primeira" ? "▶ NOVA COMANDA" : "➕ ITENS ADICIONAIS"}
</div>
<div class="sep"></div>
<div style="font-size:17px">${itemsHtml}</div>
<div class="sep"></div>
<div class="center" style="font-size:12px;color:#555">
  Powered by MenuFly
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

  win.document.write(html);
  win.document.close();
}

// ── Close Comanda (final receipt) ─────────────────────────────────────────────

export function printCloseComanda(params: CloseComandaParams) {
  const { tableNumber, tableName, items, subtotal, discount, total, paymentMethod, peopleCount, restaurantName } = params;
  const win = window.open("", "_blank", "width=350,height=700");
  if (!win) return;

  const itemsHtml = items.map(item =>
    `<div style="display:flex;justify-content:space-between;font-size:15px;margin-bottom:3px">
      <span>${item.quantity}x ${item.name}</span>
      <span>${fmt(item.price * item.quantity)}</span>
    </div>`
  ).join("");

  const perPerson = peopleCount && peopleCount > 1 ? total / peopleCount : null;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Comanda Fechada — Mesa ${tableNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.5; color: #000; width: 80mm; margin: 0 auto; padding: 4mm; }
  .sep { border-bottom: 1px dashed #000; margin: 6px 0; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .flex { display: flex; justify-content: space-between; }
</style></head><body>
<div class="center">
  <div style="font-size:18px" class="bold">${restaurantName || "Restaurante"}</div>
  <div class="sep"></div>
  <div style="font-size:20px" class="bold">FECHAMENTO DE COMANDA</div>
  <div style="font-size:18px;padding:2px 8px;border:1px solid #000;display:inline-block;margin-top:4px">
    Mesa ${tableNumber} — ${tableName}
  </div>
  ${peopleCount ? `<div style="font-size:14px;margin-top:2px">👥 ${peopleCount} pessoas</div>` : ""}
  <div style="font-size:13px;color:#555">${today()} às ${now()}</div>
</div>
<div class="sep"></div>
<div class="bold" style="margin-bottom:4px">ITENS CONSUMIDOS:</div>
${itemsHtml}
<div class="sep"></div>
<div class="flex"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
${discount > 0 ? `<div class="flex" style="color:#16a34a"><span>Desconto</span><span>-${fmt(discount)}</span></div>` : ""}
<div class="sep"></div>
<div class="flex bold" style="font-size:22px"><span>TOTAL</span><span>${fmt(total)}</span></div>
${perPerson ? `<div style="font-size:14px;text-align:center;margin-top:4px">÷ ${peopleCount} pessoas = ${fmt(perPerson)} / pessoa</div>` : ""}
<div class="sep"></div>
<div class="center bold">💳 ${payLabels[paymentMethod] || paymentMethod}</div>
<div class="sep"></div>
<div class="center" style="font-size:12px;color:#555">
  Obrigado pela visita!<br/>Powered by MenuFly
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

  win.document.write(html);
  win.document.close();
}
