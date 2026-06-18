import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useLocation, useNavigate, Link } from "react-router-dom";
import { Plus, Search, LayoutGrid, Package, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ManualOrderDrawer } from "@/components/admin/ManualOrderDrawer";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { printOrder } from "@/components/orders/OrderReceipt";
import { stageConfig, paymentMethodLabels } from "@/lib/order-display";
import { useLiveOrders } from "@/hooks/useLiveOrders";

// Status disponíveis para filtro (ordem operacional)
const STATUS_FILTER_OPTIONS = [
  "pending",
  "preparing",
  "ready",
  "pickup_ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "rejected",
] as const;

function formatTime(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function buildItemsSummary(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((item: any) => `${item.quantity ?? 1}x ${item.name ?? item.productName ?? "Item"}`)
    .join(", ");
}

export default function AdminOrders() {
  const { cashRegisterOpen } = useOutletContext<{ cashRegisterOpen: boolean }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [showManualOrder, setShowManualOrder] = useState(false);

  // Filtros (client-side: a fonte é só os pedidos de hoje, poucas dezenas)
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [paymentFilter, setPaymentFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const {
    orders,
    sortedOrders,
    loading,
    manualOrderRestaurantId,
    restaurantName,
    restaurants,
    selectedRestaurantIds,
    selectedOrder,
    setSelectedOrder,
    openOrder,
    addonNamesCache,
    addonPricesCache,
    driversByRestaurant,
    changeStatus,
    cancelOrder,
    formatCurrency,
  } = useLiveOrders(cashRegisterOpen);

  // Deep-link: ?pedido_manual=true abre o drawer de pedido manual
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("pedido_manual") === "true") {
      setShowManualOrder(true);
      navigate("/admin/pedidos", { replace: true });
    }
  }, [location.search, navigate]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedOrders.filter((o) => {
      if (statusFilter !== "todos" && o.status !== statusFilter) return false;
      if (typeFilter !== "todos" && o.delivery_type !== typeFilter) return false;
      if (paymentFilter !== "todos" && o.payment_method !== paymentFilter) return false;
      if (term) {
        const number = String(o.daily_number ?? o.order_number ?? "");
        const haystack = `${o.customer_name ?? ""} ${o.customer_phone ?? ""} ${number}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sortedOrders, statusFilter, typeFilter, paymentFilter, search]);

  const showRestaurantColumn = selectedRestaurantIds.length > 1;

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">{orders.length} pedidos recebidos hoje</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link to="/admin/pedidos/painel">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Painel ao Vivo</span>
            </Link>
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowManualOrder(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Pedido Manual</span>
          </Button>
        </div>
      </div>

      {manualOrderRestaurantId && <ManualOrderDrawer open={showManualOrder} onOpenChange={setShowManualOrder} restaurantId={manualOrderRestaurantId} />}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, telefone ou nº"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{stageConfig[s]?.label ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="delivery">Entrega</SelectItem>
                <SelectItem value="pickup">Retirada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as formas</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Hora</TableHead>
                  <TableHead className="w-[70px]">Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  {showRestaurantColumn && <TableHead>Loja</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead className="max-w-[240px]">Itens</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => {
                    const cfg = stageConfig[order.status] || stageConfig.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => openOrder(order)}
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap">{formatTime(order.created_at)}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">#{order.daily_number ?? order.order_number}</TableCell>
                        <TableCell>
                          <p className="font-medium">{order.customer_name}</p>
                          {order.customer_phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />{order.customer_phone}
                            </span>
                          )}
                        </TableCell>
                        {showRestaurantColumn && (
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {restaurants.find(r => r.id === order.restaurant_id)?.name ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap text-sm">
                          {order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground" title={buildItemsSummary(order.items)}>
                          {buildItemsSummary(order.items)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{paymentMethodLabels[order.payment_method] || order.payment_method}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(Number(order.total))}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {cfg.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={showRestaurantColumn ? 9 : 8} className="text-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">
                        {orders.length === 0 ? "Nenhum pedido hoje" : "Nenhum pedido encontrado com os filtros selecionados"}
                      </p>
                      <p className="text-sm">Novos pedidos aparecem aqui automaticamente</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
