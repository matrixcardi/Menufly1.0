import { useEffect, useState } from "react";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { RefreshCw, Printer, Package, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { ManualOrderDrawer } from "@/components/admin/ManualOrderDrawer";
import { KanbanBoard } from "@/components/admin/KanbanBoard";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { printOrder } from "@/components/orders/OrderReceipt";
import { useLiveOrders } from "@/hooks/useLiveOrders";

export default function AdminOrdersPanel() {
  const { cashRegisterOpen } = useOutletContext<{ cashRegisterOpen: boolean }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("todos");
  const [showManualOrder, setShowManualOrder] = useState(false);

  const {
    orders,
    sortedOrders,
    activeOrders,
    loading,
    restaurantId,
    manualOrderRestaurantId,
    restaurantName,
    restaurants,
    selectedRestaurant,
    selectedRestaurantIds,
    selectedOrder,
    setSelectedOrder,
    openOrder,
    addonNamesCache,
    addonPricesCache,
    driversByRestaurant,
    fiscalConfig,
    fiscalInvoices,
    handleInvoiceUpdate,
    autoPrint,
    setAutoPrint,
    selectedOrders,
    toggleSelection,
    selectTodayOrders,
    clearSelection,
    handleBatchPrint,
    changeStatus,
    cancelOrder,
    formatCurrency,
  } = useLiveOrders(cashRegisterOpen);

  // Check for pedido_manual query param to open modal automatically
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("pedido_manual") === "true") {
      setShowManualOrder(true);
      navigate("/admin/pedidos/painel", { replace: true });
    }
  }, [location.search, navigate]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Painel ao Vivo</h1>
          <p className="text-sm text-muted-foreground">{orders.length} pedidos recebidos hoje</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={selectedOrders.length === 0}
                    onClick={() => { console.log("[NFE BATCH] orders:", selectedOrders.length, selectedOrders); alert("Emissão em lote em desenvolvimento"); }}
                    className="gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4" />
                    {selectedOrders.length === 0 ? "Emitir NFe" : `Emitir ${selectedOrders.length} ${selectedOrders.length === 1 ? "nota" : "notas"}`}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {selectedOrders.length === 0 ? (
                  <div className="text-sm">
                    <p className="font-semibold mb-2">📋 Como emitir nota fiscal:</p>
                    <p className="mb-1">1. Vá para a aba 'Entregue'</p>
                    <p className="mb-1">2. Selecione os pedidos desejados</p>
                    <p className="mb-2">3. Clique aqui para emitir as notas</p>
                    <p className="text-muted-foreground text-xs">Você também pode emitir uma nota individual clicando em um pedido específico.</p>
                  </div>
                ) : (
                  <p className="text-sm">Emitir nota fiscal para os {selectedOrders.length} pedidos selecionados</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground hidden sm:inline">Auto-imprimir</span>
            <Switch checked={autoPrint} onCheckedChange={(checked) => { setAutoPrint(checked); localStorage.setItem("autoPrintOrders", String(checked)); toast({ title: checked ? "🖨️ Impressão automática ativada" : "Impressão automática desativada" }); }} />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {manualOrderRestaurantId && <ManualOrderDrawer open={showManualOrder} onOpenChange={setShowManualOrder} restaurantId={manualOrderRestaurantId} />}

      {/* Cash register closed warning */}
      {!cashRegisterOpen && activeOrders.some(o => o.status === "pending") && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-3">
          <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Caixa fechado</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Abra o caixa para poder aceitar os pedidos pendentes.</p>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {sortedOrders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">Nenhum pedido ativo</p>
            <p className="text-sm">Novos pedidos aparecerão aqui automaticamente</p>
          </div>
        </div>
      ) : (
        <KanbanBoard
          orders={sortedOrders}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOrderClick={(order) => openOrder(order)}
          onChangeStatus={changeStatus}
          formatCurrency={formatCurrency}
          addonNamesCache={addonNamesCache}
          addonPricesCache={addonPricesCache}
          drivers={driversByRestaurant[selectedRestaurant?.id || ""] || []}
          restaurantName={restaurantName}
          deliveryTimeMin={selectedRestaurant?.default_delivery_time_min}
          selectedOrders={selectedOrders}
          onToggleSelection={toggleSelection}
          onSelectTodayOrders={selectTodayOrders}
          onClearSelection={clearSelection}
          onBatchPrint={handleBatchPrint}
          fiscalConfig={fiscalConfig}
          fiscalInvoices={fiscalInvoices}
          restaurantId={restaurantId}
          onInvoiceUpdate={handleInvoiceUpdate}
        />
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <OrderDetailDialog
              order={selectedOrder}
              onChangeStatus={(status, driverId, driverName) => changeStatus(selectedOrder.id, status, driverId, driverName)}
              onCancelOrder={(reason) => cancelOrder(selectedOrder.id, reason)}
              onPrint={() => printOrder(selectedOrder, restaurantName, addonNamesCache, addonPricesCache)}
              formatCurrency={formatCurrency}
              addonNamesCache={addonNamesCache}
              addonPricesCache={addonPricesCache}
              drivers={driversByRestaurant[selectedOrder.restaurant_id] || []}
              restaurantName={restaurants.find(r => r.id === selectedOrder.restaurant_id)?.name}
              showRestaurantTag={selectedRestaurantIds.length > 1}
              deliveryTimeMin={restaurants.find(r => r.id === selectedOrder.restaurant_id)?.default_delivery_time_min}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
