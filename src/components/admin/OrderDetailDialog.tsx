import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OrderCountdown } from "@/components/admin/OrderCountdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { maskCpfCnpj } from "@/utils/cpfCnpj";
import {
  Phone,
  MapPin,
  CreditCard,
  Check,
  XCircle,
  CheckCircle2,
  Bike,
  MessageCircle,
  DollarSign,
  Calendar,
  Printer,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { stageConfig, stageOrder, paymentMethodLabels, Driver } from "@/lib/order-display";

type Order = Tables<"orders">;

export interface OrderDetailDialogProps {
  order: Order;
  onChangeStatus: (status: string, driverId?: string, driverName?: string) => void;
  onCancelOrder: (reason: string) => void;
  onPrint: () => void;
  formatCurrency: (v: number) => string;
  addonNamesCache?: Record<string, string>;
  addonPricesCache?: Record<string, number>;
  drivers?: Driver[];
  restaurantName?: string;
  showRestaurantTag?: boolean;
  deliveryTimeMin?: number | null;
}

export function OrderDetailDialog({ order, onChangeStatus, onCancelOrder, onPrint, formatCurrency, addonNamesCache = {}, addonPricesCache = {}, drivers = [], restaurantName, showRestaurantTag, deliveryTimeMin }: OrderDetailDialogProps) {
  const { toast } = useToast();
  const cfg = stageConfig[order.status] || stageConfig.pending;
  const StageIcon = cfg.icon;
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>((order as any).driver_id || "");

  useEffect(() => {
    setSelectedDriverId((order as any).driver_id || "");
  }, [order.id, (order as any).driver_id]);

  const items = order.items as Array<{
    name: string; quantity: number; price: number; notes?: string;
    addons?: Record<string, string[]> | Array<{ groupName: string; items: Array<{ name: string; price: number; quantity?: number }> }>;
    addonNames?: Record<string, string>;
  }>;
  const createdAt = new Date(order.created_at || "");
  const isScheduled = order.scheduled_at != null;
  const scheduledDate = isScheduled ? new Date(order.scheduled_at) : null;

  const formatScheduledDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const dateStr = isToday ? "hoje" : isTomorrow ? "amanhã" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    return `Agendado para ${dateStr} ${timeStr}`;
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg">Pedido #{order.daily_number ?? order.order_number}</DialogTitle>
          <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
            <StageIcon className="w-3.5 h-3.5" />
            {cfg.label}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {createdAt.toLocaleDateString("pt-BR")} às {createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {" · "}{order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
        </p>
        {isScheduled && scheduledDate && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 w-fit">
            <Calendar className="w-3 h-3" />
            {formatScheduledDate(scheduledDate)}
          </span>
        )}
        {showRestaurantTag && restaurantName && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground w-fit">
            🏪 {restaurantName}
          </span>
        )}
        {order.delivery_type === "delivery" && (
          <div className="mt-1">
            <OrderCountdown createdAt={order.created_at} acceptedAt={order.accepted_at} deliveryTimeMin={deliveryTimeMin} status={order.status} />
          </div>
        )}
      </DialogHeader>

      {/* Customer */}
      <div className="space-y-2 p-3 rounded-lg bg-muted/40">
        <p className="font-semibold text-sm">{order.customer_name}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="w-4 h-4 flex-shrink-0" />
          <a href={`tel:${order.customer_phone}`} className="hover:underline">{order.customer_phone}</a>
        </div>
        {(order as any).cpf_cnpj_nota && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span>CPF na nota: {maskCpfCnpj((order as any).cpf_cnpj_nota)}</span>
          </div>
        )}
        {order.delivery_type === "delivery" && order.customer_address && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{order.customer_address}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Itens do pedido</p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="text-sm">
              <div className="flex justify-between font-medium">
                <span>{item.quantity}x {item.name}</span>
                <span className="text-muted-foreground ml-2 flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
              </div>
              {/* Addons - handle all formats with retrocompatibility */}
              {item.addons && (() => {
                // New format with quantity: Record<groupId, Record<addonItemId, quantity>>
                if (!Array.isArray(item.addons)) {
                  // Check if it's the new quantity format (object with numbers) or old ID format (array of strings)
                  const firstGroup = Object.values(item.addons)[0];
                  if (firstGroup && typeof firstGroup === 'object' && !Array.isArray(firstGroup)) {
                    // New quantity format: { "uuid1": 2, "uuid2": 1 }
                    const allAddons = Object.entries(item.addons).flatMap(([_, addonQtyMap]) =>
                      Object.entries(addonQtyMap).map(([addonId, qty]) => ({ addonId, qty }))
                    ).filter(({ qty }) => qty > 0);

                    if (allAddons.length === 0) return null;
                    return (
                      <div className="ml-4 mt-0.5">
                        {allAddons.map(({ addonId, qty }) => {
                          const addonName = item.addonNames?.[addonId] || addonNamesCache[addonId] || addonId;
                          const addonPrice = addonPricesCache[addonId];
                          const totalQty = qty * item.quantity;
                          const qtyPrefix = totalQty > 1 ? `${totalQty}x ` : "";
                          return (
                            <div key={addonId} className="flex justify-between text-xs text-muted-foreground">
                              <span>+ {qtyPrefix}{addonName}</span>
                              {addonPrice != null && addonPrice > 0 && <span>{formatCurrency(addonPrice * totalQty)}</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else {
                    // Old ID format: { "group1": ["uuid1", "uuid2"] }
                    const allAddonIds = Object.values(item.addons).flat();
                    if (allAddonIds.length === 0) return null;
                    return (
                      <div className="ml-4 mt-0.5">
                        {allAddonIds.map((addonId, aIdx) => {
                          const addonName = item.addonNames?.[addonId] || addonNamesCache[addonId] || addonId;
                          const addonPrice = addonPricesCache[addonId];
                          const qty = item.quantity;
                          const qtyPrefix = qty > 1 ? `${qty}x ` : "";
                          return (
                            <div key={aIdx} className="flex justify-between text-xs text-muted-foreground">
                              <span>+ {qtyPrefix}{addonName}</span>
                              {addonPrice != null && addonPrice > 0 && <span>{formatCurrency(addonPrice * qty)}</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                }
                // Legacy format: Array<{ groupName, items }>
                return item.addons.map((group: any, gIdx: number) => (
                  <div key={gIdx} className="ml-4 mt-0.5">
                    {group.items?.map((addon: any, aIdx: number) => {
                      const addonQty = addon.quantity || 1;
                      const totalQty = addonQty * item.quantity;
                      const qtyPrefix = totalQty > 1 ? `${totalQty}x ` : "";
                      return (
                        <div key={aIdx} className="flex justify-between text-xs text-muted-foreground">
                          <span>+ {qtyPrefix}{addon.name}</span>
                          {addon.price > 0 && <span>{formatCurrency(addon.price * item.quantity * addonQty)}</span>}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
              {item.notes && <p className="ml-4 mt-0.5 text-xs text-amber-600 dark:text-amber-400">📝 {item.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">📝 {order.notes}</p>
        </div>
      )}

      {/* Totals */}
      <div className="pt-2 border-t border-border space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span><span>{formatCurrency(Number(order.subtotal))}</span>
        </div>
        {Number(order.delivery_fee) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa de entrega</span><span>{formatCurrency(Number(order.delivery_fee))}</span>
          </div>
        )}
        {Number(order.discount) > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
            <span>-{formatCurrency(Number(order.discount))}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-1">
          <span>Total</span>
          <span>{formatCurrency(Number(order.total))}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
          <CreditCard className="w-3.5 h-3.5" />
          {paymentMethodLabels[order.payment_method] || order.payment_method}
        </div>
      </div>

      {/* Status selector */}
      {order.status !== "rejected" && (order as any).status !== "cancelled" ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {order.status === "pending" ? "Ações" : "Alterar status"}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onPrint}>
                <Printer className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { console.log("[NFE] Emitir pedido:", order.id); alert("Emissão NFe em desenvolvimento"); }}>
                <FileText className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Pending: show only Accept / Reject */}
          {order.status === "pending" ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30 gap-2 text-sm font-semibold"
                onClick={() => setShowRejectConfirm(true)}
              >
                <XCircle className="w-5 h-5" />
                Recusar
              </Button>
              <Button
                className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm font-semibold"
                onClick={() => onChangeStatus("preparing")}
              >
                <CheckCircle2 className="w-5 h-5" />
                Aceitar
              </Button>
            </div>
          ) : (
            /* Non-pending: show full stage grid */
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {stageOrder.filter(s => s !== "pending").map((stageId) => {
                  const sc = stageConfig[stageId];
                  const Icon = sc.icon;
                  const isActive = order.status === stageId;
                  return (
                    <button
                      key={stageId}
                      onClick={() => {
                        if (isActive) return;
                        onChangeStatus(stageId, selectedDriverId || undefined, drivers.find(d => d.id === selectedDriverId)?.name);
                      }}
                      className={`
                        relative flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-[10px] font-medium transition-all duration-150 border
                        ${isActive
                          ? `${sc.bg} ${sc.text} ${sc.border} shadow-sm`
                          : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60"
                        }
                      `}
                    >
                      {isActive && <Check className="absolute top-1 right-1 w-3 h-3" />}
                      <Icon className="w-4 h-4" />
                      <span className="leading-tight text-center">{sc.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Driver selector - always visible for delivery orders */}
              {order.delivery_type === "delivery" && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Entregador</Label>
                  </div>
                  <Select
                    value={selectedDriverId || "none"}
                    onValueChange={(val) => {
                      if (val === "none") {
                        setSelectedDriverId("");
                        onChangeStatus(order.status, undefined, undefined);
                      } else {
                        setSelectedDriverId(val);
                        const driver = drivers.find(d => d.id === val);
                        if (driver) {
                          onChangeStatus(order.status, val, driver.name);
                        }
                      }
                    }}
                    disabled={drivers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={drivers.length === 0 ? "Nenhum entregador ativo" : "Selecione o entregador"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Sem entregador</span>
                      </SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2">
                            <span>{d.name}</span>
                            {d.fixed_fee > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({d.fixed_fee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {drivers.length === 0 && (
                    <p className="text-xs text-muted-foreground">Cadastre ou ative entregadores na aba Entregadores.</p>
                  )}

                  {/* Lá Vem Entregas — manual request / status */}
                  {(order as any).lavem_delivery_id ? (
                    <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                        <Bike className="w-4 h-4" /> Lá Vem Entregas
                        <span className="ml-auto text-xs uppercase">{(order as any).lavem_status || "solicitado"}</span>
                      </div>
                      {(order as any).lavem_driver_name && (
                        <p className="text-xs">Entregador: <span className="font-medium">{(order as any).lavem_driver_name}</span> {(order as any).lavem_driver_phone && `· ${(order as any).lavem_driver_phone}`}</p>
                      )}
                      {(order as any).lavem_tracking_url && (
                        <a href={(order as any).lavem_tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 dark:text-amber-300 underline">Acompanhar entrega</a>
                      )}
                    </div>
                  ) : (
                    !selectedDriverId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30"
                        onClick={async () => {
                          const { data, error } = await supabase.functions.invoke("lavem-dispatch", { body: { order_id: order.id } });
                          if (error || data?.error) {
                            toast({ title: "Erro ao solicitar Lá Vem", description: data?.error || error?.message, variant: "destructive" });
                          } else {
                            toast({ title: "🛵 Entregador solicitado", description: "Aguardando atribuição do Lá Vem Entregas." });
                          }
                        }}
                      >
                        <Bike className="w-4 h-4" /> Solicitar Lá Vem Entregas
                      </Button>
                    )
                  )}

                  {/* Show assigned driver info + WhatsApp button */}
                  {selectedDriverId && (() => {
                    const assignedDriver = drivers.find(d => d.id === selectedDriverId);
                    if (!assignedDriver) return null;
                    return (
                      <div className="space-y-2 pt-1">
                        {assignedDriver.fixed_fee > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Taxa:</span>
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              {assignedDriver.fixed_fee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/30"
                          onClick={() => {
                            const items = order.items as Array<{ name: string; quantity: number }>;
                            const itemsList = items.map(i => `${i.quantity}x ${i.name}`).join("\n");
                            // Parse o endereço estruturado salvo no formato:
                            //   "rua, número[ - complemento], bairro[ (Ref: ...)]"
                            // O link do Maps recebe SOMENTE "rua, número, bairro" (o que
                            // corresponde às coordenadas localizadas). Complemento e
                            // ponto de referência vão apenas no texto da mensagem.
                            const raw = (order.customer_address || "").trim();
                            const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
                            const street = parts[0] || "";
                            // 2ª parte pode ser "número" ou "número - complemento"
                            const numberRaw = parts[1] || "";
                            const dashIdx = numberRaw.indexOf(" - ");
                            const number = dashIdx >= 0 ? numberRaw.slice(0, dashIdx).trim() : numberRaw;
                            const complement = dashIdx >= 0 ? numberRaw.slice(dashIdx + 3).trim() : "";
                            // 3ª parte: bairro, possivelmente com " (Ref: ...)"
                            const neighborhoodRaw = parts[2] || "";
                            const refMatch = neighborhoodRaw.match(/\s*\(Ref:\s*([^)]+)\)\s*$/i);
                            const neighborhood = neighborhoodRaw.replace(/\s*\(Ref:[^)]*\)\s*/i, "").trim();
                            const reference = refMatch ? refMatch[1].trim() : "";

                            const mapsAddressParts = [street, number, neighborhood].filter(Boolean);
                            const mapsAddress = mapsAddressParts.join(", ");
                            const mapsLink = mapsAddress
                              ? `\n\n📍 *Localização (Maps):*\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsAddress)}`
                              : "";

                            // Telefone do cliente formatado para WhatsApp wa.me
                            const customerDigits = (order.customer_phone || "").replace(/\D/g, "");
                            const customerLocal = customerDigits.startsWith("55") && customerDigits.length > 11
                              ? customerDigits.slice(2)
                              : customerDigits;

                            // Endereço legível no corpo da mensagem
                            let addressLine = mapsAddress;
                            if (complement) addressLine += ` — ${complement}`;
                            const refLine = reference ? `\n📌 *Ponto de referência:* ${reference}` : "";

                            const msg = `🛵 *NOVO PEDIDO #${order.daily_number ?? order.order_number}*\n\n` +
                              `👤 *Cliente:* ${order.customer_name}\n` +
                              `📱 *Tel:* ${customerLocal || order.customer_phone}\n` +
                              `📍 *Endereço:* ${addressLine || order.customer_address}` +
                              refLine +
                              `\n\n📋 *Itens:*\n${itemsList}\n` +
                              `\n💰 *Total:* ${Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` +
                              `\n💳 *Pagamento:* ${paymentMethodLabels[order.payment_method] || order.payment_method}` +
                              mapsLink;

                            // Telefone do entregador: normalizar (remove "55" duplicado, valida 10-11 dígitos)
                            const driverDigits = assignedDriver.phone.replace(/\D/g, "");
                            const driverLocal = driverDigits.startsWith("55") && driverDigits.length > 11
                              ? driverDigits.slice(2)
                              : driverDigits;
                            if (driverLocal.length < 10 || driverLocal.length > 11) {
                              toast({
                                title: "Telefone do entregador inválido",
                                description: "Edite o cadastro do entregador e use DDD + número (ex: 51999999999).",
                                variant: "destructive",
                              });
                              return;
                            }
                            const fullPhone = `55${driverLocal}`;
                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                          }}
                        >
                          <MessageCircle className="w-4 h-4" />
                          Enviar pedido via WhatsApp
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Cancel button - show for all accepted (non-pending, non-delivered) orders */}
          {order.status !== "pending" && order.status !== "delivered" && (
            <Button
              variant="outline"
              className="w-full mt-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30 gap-2"
              onClick={() => setShowCancelConfirm(true)}
            >
              <XCircle className="w-4 h-4" />
              Cancelar pedido
            </Button>
          )}
        </div>
      ) : (order as any).status === "cancelled" ? (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-700 dark:text-red-400">Pedido Cancelado</p>
          {(order as any).cancellation_reason && (
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">Motivo: {(order as any).cancellation_reason}</p>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-700 dark:text-red-400">Pedido Recusado</p>
          <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">Este pedido foi recusado pelo estabelecimento.</p>
        </div>
      )}

      {/* Reject confirmation dialog */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar pedido #{order.daily_number ?? order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja recusar este pedido de <strong>{order.customer_name}</strong> no valor de <strong>{formatCurrency(Number(order.total))}</strong>?
              Esta ação não pode ser desfeita e o pedido será marcado como recusado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                onChangeStatus("rejected");
                setShowRejectConfirm(false);
              }}
            >
              Confirmar recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={(open) => { setShowCancelConfirm(open); if (!open) setCancelReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido #{order.daily_number ?? order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <span className="block">
                  Tem certeza que deseja cancelar o pedido de <strong>{order.customer_name}</strong> no valor de <strong>{formatCurrency(Number(order.total))}</strong>?
                </span>
                <div>
                  <Label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">Motivo do cancelamento (opcional)</Label>
                  <textarea
                    id="cancel-reason"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={3}
                    placeholder="Ex: cliente desistiu, item indisponível..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason("")}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                onCancelOrder(cancelReason);
                setShowCancelConfirm(false);
                setCancelReason("");
              }}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
