import { Tables } from "@/integrations/supabase/types";
import { KanbanColumn } from "./KanbanColumn";
import { OrderStatus, KANBAN_COLUMNS, ORDER_STATUS_LABELS } from "@/types/order";
import { Clock, ChefHat, Package, HandPlatter, Truck, CheckCircle2, LayoutDashboard, Printer, CheckSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Order = Tables<"orders">;

interface KanbanBoardProps {
  orders: Order[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOrderClick: (order: Order) => void;
  onChangeStatus: (orderId: string, newStatus: string) => void;
  formatCurrency: (value: number) => string;
  addonNamesCache: Record<string, string>;
  addonPricesCache: Record<string, number>;
  drivers: any[];
  restaurantName?: string;
  deliveryTimeMin?: number | null;
  selectedOrders?: string[];
  onToggleSelection?: (orderId: string) => void;
  onSelectTodayOrders?: () => void;
  onClearSelection?: () => void;
  onBatchPrint?: () => void;
  fiscalConfig?: {
    is_configured: boolean;
    is_active: boolean;
    provider: string;
    environment: string;
  } | null;
  fiscalInvoices?: Record<string, any>;
  restaurantId?: string;
  onInvoiceUpdate?: (orderId: string, invoice: any) => void;
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
  activeTab,
  onTabChange,
  onOrderClick,
  onChangeStatus,
  formatCurrency,
  addonNamesCache,
  addonPricesCache,
  drivers,
  restaurantName,
  deliveryTimeMin,
  selectedOrders,
  onToggleSelection,
  onSelectTodayOrders,
  onClearSelection,
  onBatchPrint,
  fiscalConfig,
  fiscalInvoices,
  restaurantId,
  onInvoiceUpdate,
}: KanbanBoardProps) {
  // Group orders by status
  const ordersByStatus = KANBAN_COLUMNS.reduce((acc, status) => {
    acc[status] = orders.filter((order) => order.status === status);
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border overflow-x-auto no-scrollbar">
        <button
          onClick={() => onTabChange("todos")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap border",
            activeTab === "todos"
              ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 font-semibold"
              : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-sm">Todos</span>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full border",
            activeTab === "todos"
              ? "bg-orange-500 text-white border-orange-600"
              : "bg-primary/10 text-primary border-primary/20"
          )}>
            {orders.length}
          </span>
        </button>

        {KANBAN_COLUMNS.map((status) => {
          const count = ordersByStatus[status]?.length || 0;
          const Icon = statusIcons[status];
          const isActive = activeTab === status;

          return (
            <button
              key={status}
              onClick={() => onTabChange(status)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap border",
                isActive
                  ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 font-semibold"
                  : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{ORDER_STATUS_LABELS[status]}</span>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full border",
                isActive
                  ? "bg-orange-500 text-white border-orange-600"
                  : "bg-primary/10 text-primary border-primary/20"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action bar for delivered tab */}
      {activeTab === "delivered" && (
        <>
          <div className="mb-4 px-3 py-2 bg-muted/50 border border-border rounded-lg flex items-center gap-2 sm:gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckSquare className="w-4 h-4" />
              <span>{selectedOrders && selectedOrders.length > 0 ? `${selectedOrders.length} selecionado(s)` : "Nenhum selecionado"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectTodayOrders}
              className="h-7"
            >
              Selecionar todos
            </Button>
            {selectedOrders && selectedOrders.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-7"
                >
                  Limpar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onBatchPrint}
                  className="gap-2 h-7"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir {selectedOrders.length}
                </Button>
              </>
            )}
          </div>
          {/* Empty state hint */}
          {(!selectedOrders || selectedOrders.length === 0) && (
            <div className="mb-3 text-xs text-muted-foreground text-center">
              💡 Marque a caixa de seleção nos pedidos para imprimir ou emitir notas em lote
            </div>
          )}
        </>
      )}

      {/* Kanban columns or single column */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className={cn(
          "h-full",
          activeTab === "todos" ? "flex gap-4 min-w-max" : "w-full"
        )}>
          {activeTab === "todos" ? (
            KANBAN_COLUMNS.map((status) => (
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
                fiscalConfig={fiscalConfig}
                fiscalInvoices={fiscalInvoices}
                restaurantId={restaurantId}
                onInvoiceUpdate={onInvoiceUpdate}
              />
            ))
          ) : (
            <div className="w-full h-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                {(ordersByStatus[activeTab as OrderStatus] || []).map((order) => (
                  <div key={order.id} className="w-full">
                    <KanbanColumn
                      status={activeTab as OrderStatus}
                      orders={[order]}
                      onOrderClick={onOrderClick}
                      onChangeStatus={onChangeStatus}
                      formatCurrency={formatCurrency}
                      addonNamesCache={addonNamesCache}
                      addonPricesCache={addonPricesCache}
                      drivers={drivers}
                      restaurantName={restaurantName}
                      deliveryTimeMin={deliveryTimeMin}
                      isSingleCard={true}
                      selectedOrders={selectedOrders}
                      onToggleSelection={onToggleSelection}
                      showCheckbox={activeTab === "delivered"}
                      fiscalConfig={fiscalConfig}
                      fiscalInvoices={fiscalInvoices}
                      restaurantId={restaurantId}
                      onInvoiceUpdate={onInvoiceUpdate}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
