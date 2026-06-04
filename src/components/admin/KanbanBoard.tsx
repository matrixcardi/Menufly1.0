import { Tables } from "@/integrations/supabase/types";
import { KanbanColumn } from "./KanbanColumn";
import { OrderStatus, KANBAN_COLUMNS, ORDER_STATUS_LABELS } from "@/types/order";
import { Clock, ChefHat, Package, HandPlatter, Truck, CheckCircle2 } from "lucide-react";

type Order = Tables<"orders">;

interface KanbanBoardProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
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
  rejected: Clock,
  cancelled: Clock,
};

export function KanbanBoard({
  orders,
  onOrderClick,
  onChangeStatus,
  formatCurrency,
  addonNamesCache,
  addonPricesCache,
  drivers,
  restaurantName,
  deliveryTimeMin,
}: KanbanBoardProps) {
  // Group orders by status
  const ordersByStatus = KANBAN_COLUMNS.reduce((acc, status) => {
    acc[status] = orders.filter((order) => order.status === status);
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header with stats */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border overflow-x-auto">
        {KANBAN_COLUMNS.map((status) => {
          const count = ordersByStatus[status]?.length || 0;
          const Icon = statusIcons[status];
          return (
            <div key={status} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 whitespace-nowrap">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{ORDER_STATUS_LABELS[status]}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full min-w-max">
          {KANBAN_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              orders={ordersByStatus[status] || []}
              onOrderClick={onOrderClick}
              onChangeStatus={onChangeStatus}
              formatCurrency={formatCurrency}
              addonNamesCache={addonNamesCache}
              addonPricesCache={addonPricesCache}
              drivers={drivers}
              restaurantName={restaurantName}
              deliveryTimeMin={deliveryTimeMin}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
