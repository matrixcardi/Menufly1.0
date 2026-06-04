import { Tables } from "@/integrations/supabase/types";
import { OrderStatus, ORDER_STATUS_TRANSITIONS, ORDER_STATUS_LABELS, DELIVERY_STATUS_TRANSITIONS, PICKUP_STATUS_TRANSITIONS } from "@/types/order";
import { Clock, ChefHat, Package, HandPlatter, Truck, CheckCircle2, XCircle, Check, Phone, MapPin, CreditCard, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderCountdown } from "@/components/admin/OrderCountdown";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Order = Tables<"orders">;

interface KanbanOrderCardProps {
  order: Order;
  onClick: () => void;
  onChangeStatus: (orderId: string, newStatus: string) => void;
  formatCurrency: (value: number) => string;
  addonNamesCache: Record<string, string>;
  addonPricesCache: Record<string, number>;
  drivers: any[];
  restaurantName?: string;
  deliveryTimeMin?: number | null;
}

const statusIcons: Record<OrderStatus, React.ElementType> = {
  pending: Clock,
  preparing: ChefHat,
  ready: Package,
  pickup_ready: HandPlatter,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

const statusColors: Record<OrderStatus, { bg: string; border: string; text: string }> = {
  pending: { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300" },
  preparing: { bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-300 dark:border-orange-700", text: "text-orange-700 dark:text-orange-300" },
  ready: { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-300 dark:border-purple-700", text: "text-purple-700 dark:text-purple-300" },
  pickup_ready: { bg: "bg-indigo-100 dark:bg-indigo-900/30", border: "border-indigo-300 dark:border-indigo-700", text: "text-indigo-700 dark:text-indigo-300" },
  out_for_delivery: { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-300 dark:border-blue-700", text: "text-blue-700 dark:text-blue-300" },
  delivered: { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300" },
  rejected: { bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-300 dark:border-red-700", text: "text-red-700 dark:text-red-300" },
  cancelled: { bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-300 dark:border-red-700", text: "text-red-700 dark:text-red-300" },
};

const paymentMethodLabels: Record<string, string> = { pix: "PIX", cash: "Dinheiro", card: "Cartão" };

export function KanbanOrderCard({
  order,
  onClick,
  onChangeStatus,
  formatCurrency,
  addonNamesCache,
  addonPricesCache,
  drivers,
  restaurantName,
  deliveryTimeMin,
}: KanbanOrderCardProps) {
  const status = order.status as OrderStatus;
  const colors = statusColors[status];
  const Icon = statusIcons[status];
  const items = order.items as Array<{ quantity: number }>;
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const createdAt = new Date(order.created_at || "");
  const deliveryType = order.delivery_type as "delivery" | "pickup" | "table";
  const isTableOrder = deliveryType === "table" || (order as any).origin === "pdv_salao";
  
  const isNew = status === "pending";
  const isScheduled = order.scheduled_at != null;
  const scheduledDate = isScheduled ? new Date(order.scheduled_at) : null;
  
  // Get transitions based on delivery type
  const transitions = deliveryType === "delivery" 
    ? DELIVERY_STATUS_TRANSITIONS[status] || []
    : PICKUP_STATUS_TRANSITIONS[status] || [];

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
    <button
      onClick={onClick}
      className={`w-full rounded-lg border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md text-left relative ${
        isNew
          ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-300/50 dark:ring-amber-600/30"
          : colors.border
      }`}
    >
      {/* Status bar */}
      <div className={`h-1 ${colors.bg.replace("bg-", "bg-").replace("/30", "")} ${isNew ? "animate-pulse" : ""}`} />
      
      {isNew && (
        <span className="absolute top-2 right-2 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        </span>
      )}

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">#{order.daily_number ?? order.order_number}</span>
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
              <Icon className="w-3 h-3" />
              {ORDER_STATUS_LABELS[status]}
            </div>
            {/* Delivery Type Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              deliveryType === "delivery" 
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" 
                : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
            }`}>
              {deliveryType === "delivery" ? "🚚 Delivery" : "🏪 Retirada"}
            </span>
          </div>
          <span className={`text-[10px] ${isNew ? "mr-4" : ""} text-muted-foreground`}>
            {createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Customer info */}
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm truncate">{order.customer_name}</p>
          {order.delivery_type === "delivery" && (
            <OrderCountdown createdAt={order.created_at} acceptedAt={order.accepted_at} deliveryTimeMin={deliveryTimeMin} status={order.status} compact />
          )}
        </div>

        {/* Scheduled badge */}
        {isScheduled && scheduledDate && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400">
              <Calendar className="w-3 h-3" />
              {formatScheduledDate(scheduledDate)}
            </span>
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span>{order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            {paymentMethodLabels[order.payment_method] || order.payment_method}
          </span>
          <span>•</span>
          <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR })}
          </span>
          <span className="font-bold text-base">{formatCurrency(Number(order.total))}</span>
        </div>

        {/* Quick actions */}
        {transitions.length > 0 && status !== "delivered" && (
          <div className="flex gap-2 mt-3 pt-2 border-t border-border">
            {status === "pending" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus(order.id, "rejected");
                  }}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Recusar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus(order.id, "preparing");
                  }}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Aceitar
                </Button>
              </>
            )}
            {status === "preparing" && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeStatus(order.id, "ready");
                }}
              >
                <Package className="w-3 h-3 mr-1" />
                Pronto
              </Button>
            )}
            {status === "ready" && (
              <>
                {deliveryType === "delivery" ? (
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeStatus(order.id, "out_for_delivery");
                    }}
                  >
                    <Truck className="w-3 h-3 mr-1" />
                    Enviar para Entrega
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeStatus(order.id, "pickup_ready");
                    }}
                  >
                    <HandPlatter className="w-3 h-3 mr-1" />
                    Aguardando Cliente
                  </Button>
                )}
              </>
            )}
            {status === "pickup_ready" && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeStatus(order.id, "delivered");
                }}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Cliente Retirou
              </Button>
            )}
            {status === "out_for_delivery" && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeStatus(order.id, "delivered");
                }}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Pedido Entregue
              </Button>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
