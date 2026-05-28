import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ChevronRight, Clock, QrCode, XCircle, Ban, X } from "lucide-react";
import { useOrderHistory, updateOrderPaymentStatus, removeOrderFromHistory } from "@/hooks/useOrderHistory";
import { PixPaymentDrawer } from "@/components/checkout/PixPaymentDrawer";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "Pedido Feito",
  confirmed: "Aceito",
  preparing: "Preparando",
  ready: "Pronto",
  pickup_ready: "Pronto para retirada",
  out_for_delivery: "A caminho",
  delivered: "Entregue",
  rejected: "Recusado",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-blue-500",
  preparing: "bg-orange-500",
  ready: "bg-emerald-500",
  pickup_ready: "bg-emerald-500",
  out_for_delivery: "bg-blue-600",
  delivered: "bg-slate-400",
  rejected: "bg-red-500",
  cancelled: "bg-red-500",
};

export function OrdersTab() {
  const { orders, refreshOrders } = useOrderHistory();
  const navigate = useNavigate();
  const [dbStatuses, setDbStatuses] = useState<Record<string, string>>({});
  const [pixOrder, setPixOrder] = useState<{
    dbOrderId: string;
    orderNumber: string;
    restaurantId: string;
    restaurantSlug?: string;
    total: number;
    customerName: string;
    deliveryMethod: "pickup" | "delivery";
  } | null>(null);
  const [showPixDrawer, setShowPixDrawer] = useState(false);

  // Fetch real statuses from DB and sync payment statuses
  const syncStatuses = useCallback(async () => {
    const stored = localStorage.getItem("burger_orders_history");
    const localOrders = stored ? JSON.parse(stored) : [];
    if (localOrders.length === 0 && orders.length === 0) return;
    const allOrders = localOrders.length > 0 ? localOrders : orders;
    const orderIds = allOrders.map((o: any) => o.orderId);
    const { data } = await supabase
      .from("orders")
      .select("order_number, status, payment_status, cancellation_reason")
      .in("order_number", orderIds);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((o: any) => { map[o.order_number] = o.status; });
      setDbStatuses(map);

      // Sync payment_status back to localStorage
      let changed = false;
      const statusMap = new Map(data.map((d: any) => [d.order_number, d.payment_status]));
      const updatedOrders = allOrders.map((o: any) => {
        const dbPayment = statusMap.get(o.orderId);
        if (dbPayment && dbPayment !== o.paymentStatus) {
          changed = true;
          return { ...o, paymentStatus: dbPayment };
        }
        return o;
      });
      if (changed) {
        localStorage.setItem("burger_orders_history", JSON.stringify(updatedOrders));
        refreshOrders();
      }
    }
  }, [orders]);

  useEffect(() => {
    refreshOrders();
  }, []);

  useEffect(() => {
    syncStatuses();
  }, [syncStatuses]);

  // Poll for status updates every 5 seconds as fallback
  useEffect(() => {
    if (orders.length === 0) return;
    const interval = setInterval(syncStatuses, 5000);
    return () => clearInterval(interval);
  }, [syncStatuses]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (orders.length === 0) return;
    const orderIds = orders.map(o => o.orderId);
    const channel = supabase
      .channel(`customer-orders-status-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as { order_number: string; status: string };
          if (orderIds.includes(updated.order_number)) {
            setDbStatuses(prev => ({ ...prev, [updated.order_number]: updated.status }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orders.length]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleOrderClick = (order: typeof orders[0]) => {
    // If order is awaiting payment, open PIX drawer
    if (order.paymentStatus === "awaiting_payment" && order.dbOrderId && order.restaurantId) {
      setPixOrder({
        dbOrderId: order.dbOrderId,
        orderNumber: order.orderId,
        restaurantId: order.restaurantId,
        restaurantSlug: order.restaurantSlug,
        total: order.total,
        customerName: order.customerName,
        deliveryMethod: order.deliveryMethod,
      });
      setShowPixDrawer(true);
      return;
    }

    const params = new URLSearchParams({
      pedido: order.orderId,
      nome: order.customerName,
      entrega: order.deliveryMethod,
      total: order.total.toString(),
    });
    navigate(`/pedido?${params.toString()}`);
  };

  const handlePixDone = () => {
    if (pixOrder) {
      updateOrderPaymentStatus(pixOrder.orderNumber, "paid");
    }
    setShowPixDrawer(false);
    setPixOrder(null);
    refreshOrders();
  };

  const handleCancelOrder = async (e: React.MouseEvent, order: typeof orders[0]) => {
    e.stopPropagation();
    if (!order.dbOrderId) return;

    const confirmed = window.confirm("Tem certeza que deseja cancelar este pedido?");
    if (!confirmed) return;

    const { data, error } = await supabase.rpc("cancel_order_by_customer", {
      p_order_id: order.dbOrderId,
    });

    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || "Erro ao cancelar pedido");
      return;
    }

    removeOrderFromHistory(order.orderId);
    refreshOrders();
    syncStatuses();
    toast.success("Pedido cancelado com sucesso");
  };

  // Filter out cancelled and rejected orders
  const visibleOrders = orders.filter((order) => {
    const realStatus = dbStatuses[order.orderId] || order.status;
    return realStatus !== "cancelled" && realStatus !== "rejected";
  });

  if (visibleOrders.length === 0) {
    return (
      <div className="px-4 py-12 pb-24 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center">
          Nenhum pedido realizado ainda.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-4 pb-24 space-y-3">
        <h2 className="text-lg font-bold">Meus Pedidos</h2>
        
        {visibleOrders.map((order) => {
          const isAwaitingPayment = order.paymentStatus === "awaiting_payment";
          const realStatus = dbStatuses[order.orderId] || order.status;
          const isRejectedOrCancelled = realStatus === "rejected" || realStatus === "cancelled";

          return (
            <button
              key={order.orderId}
              onClick={() => handleOrderClick(order)}
              className={`w-full bg-card border rounded-lg p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left ${
                isRejectedOrCancelled ? "border-red-300 opacity-70" : "border-border"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                isRejectedOrCancelled ? "bg-red-500/10" : isAwaitingPayment ? "bg-amber-500/10" : "bg-primary/10"
              }`}>
                {isRejectedOrCancelled ? (
                  realStatus === "rejected" ? <Ban className="w-6 h-6 text-red-500" /> : <XCircle className="w-6 h-6 text-red-500" />
                ) : isAwaitingPayment ? (
                  <QrCode className="w-6 h-6 text-amber-600" />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-primary" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">Pedido #{order.orderId}</span>
                  {isAwaitingPayment ? (
                    <span className="px-2 py-0.5 rounded-full text-xs text-white bg-amber-500 animate-pulse">
                      Aguardando Pagamento
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusColors[realStatus] || "bg-slate-400"}`}>
                      {statusLabels[realStatus] || realStatus}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatDistanceToNow(new Date(order.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1">
                  {formatCurrency(order.total)}
                </p>
                {isAwaitingPayment && (
                  <p className="text-xs text-amber-600 font-medium mt-1">
                    Toque para pagar via PIX
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {(isAwaitingPayment || realStatus === "pending") && (
                  <button
                    onClick={(e) => handleCancelOrder(e, order)}
                    className="p-1.5 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors"
                    title="Cancelar pedido"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                )}
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>

      {pixOrder && (
        <PixPaymentDrawer
          open={showPixDrawer}
          onOpenChange={(open) => {
            setShowPixDrawer(open);
            if (!open) {
              setPixOrder(null);
            }
          }}
          orderId={pixOrder.dbOrderId}
          orderNumber={pixOrder.orderNumber}
          restaurantId={pixOrder.restaurantId}
          restaurantSlug={pixOrder.restaurantSlug}
          total={pixOrder.total}
          customerName={pixOrder.customerName}
          deliveryMethod={pixOrder.deliveryMethod}
        />
      )}
    </>
  );
}
