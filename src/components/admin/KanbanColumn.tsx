import { Tables } from "@/integrations/supabase/types";
import { KanbanOrderCard } from "./KanbanOrderCard";
import { OrderStatus, ORDER_STATUS_LABELS } from "@/types/order";
import { Clock, ChefHat, Package, HandPlatter, Truck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Order = Tables<"orders">;

interface KanbanColumnProps {
  status: OrderStatus;
  orders: Order[];
  onOrderClick: (order: Order) => void;
  onChangeStatus: (orderId: string, newStatus: string) => void;
  formatCurrency: (value: number) => string;
  addonNamesCache: Record<string, string>;
  addonPricesCache: Record<string, number>;
  drivers: any[];
  restaurantName?: string;
  deliveryTimeMin?: number | null;
  isSingleCard?: boolean;
}

const statusIcons: Record<OrderStatus, React.ElementType> = {
  pending: Clock,
  preparing: ChefHat,
  ready: Package,
  pickup_ready: HandPlatter,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  rejected: Clock,
  cancelled: Clock,
};

const statusColors: Record<OrderStatus, { bg: string; border: string; text: string }> = {
  pending: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
  preparing: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
  ready: { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300" },
  pickup_ready: { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300" },
  out_for_delivery: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
  delivered: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300" },
  rejected: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" },
  cancelled: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" },
};

export function KanbanColumn({
  status,
  orders,
  onOrderClick,
  onChangeStatus,
  formatCurrency,
  addonNamesCache,
  addonPricesCache,
  drivers,
  restaurantName,
  deliveryTimeMin,
  isSingleCard,
}: KanbanColumnProps) {
  const colors = statusColors[status];
  const Icon = statusIcons[status];

  return (
    <div className={cn(
      "flex flex-col h-full",
      !isSingleCard && "flex-shrink-0 w-80"
    )}>
      {/* Column Header */}
      {!isSingleCard && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2",
          colors.bg,
          colors.border
        )}>
          <Icon className={cn("w-4 h-4", colors.text)} />
          <h3 className={cn("font-semibold text-sm", colors.text)}>
            {ORDER_STATUS_LABELS[status]}
          </h3>
          <span className={cn(
            "ml-auto text-xs font-bold px-2 py-0.5 rounded-full border",
            colors.bg,
            colors.text,
            colors.border
          )}>
            {orders.length}
          </span>
        </div>
      )}

      {/* Column Body */}
      <div className={cn(
        "flex-1 overflow-y-auto px-2 py-3 space-y-3 bg-muted/20",
        !isSingleCard ? "rounded-b-lg border border-border border-t-0" : "rounded-lg border border-border"
      )}>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Icon className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-xs">Nenhum pedido</p>
          </div>
        ) : (
          orders.map((order) => (
            <KanbanOrderCard
              key={order.id}
              order={order}
              onClick={() => onOrderClick(order)}
              onChangeStatus={onChangeStatus}
              formatCurrency={formatCurrency}
              addonNamesCache={addonNamesCache}
              addonPricesCache={addonPricesCache}
              drivers={drivers}
              restaurantName={restaurantName}
              deliveryTimeMin={deliveryTimeMin}
            />
          ))
        )}
      </div>
    </div>
  );
}
