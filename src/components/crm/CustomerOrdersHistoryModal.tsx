import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingBag,
  DollarSign,
  Clock,
  ChevronRight,
  UtensilsCrossed,
  X,
} from "lucide-react";

interface OrderHistory {
  id: string;
  order_number: string;
  created_at: string;
  items: any[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  delivery_type: string;
  payment_method: string;
  status: string;
  notes: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  lastOrder: string;
  firstOrder: string;
  totalOrders: number;
  totalSpent: number;
  daysInactive: number;
  favoriteProduct: string | null;
}

interface CustomerOrdersHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  restaurantId: string | null;
  selectedRestaurantIds: string[];
}

type StatusFilter = "all" | "delivered" | "canceled" | "other";

export default function CustomerOrdersHistoryModal({
  open,
  onOpenChange,
  customer,
  restaurantId,
  selectedRestaurantIds,
}: CustomerOrdersHistoryModalProps) {
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!open || !customer) return;

    async function fetchAllOrders() {
      setLoading(true);
      const cleanPhone = customer.phone.replace(/\D/g, "");
      const restIds = restaurantId ? [restaurantId] : selectedRestaurantIds;

      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_number, created_at, items, subtotal, discount, delivery_fee, total, delivery_type, payment_method, status, notes")
          .in("restaurant_id", restIds)
          .or(`customer_phone.eq.${cleanPhone},customer_phone.eq.${customer.phone}`)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setOrders((data || []) as OrderHistory[]);
      } catch (err) {
        console.error("Error fetching all orders:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllOrders();
  }, [open, customer, restaurantId, selectedRestaurantIds]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    if (statusFilter === "delivered") return orders.filter(o => o.status === "delivered");
    if (statusFilter === "canceled") return orders.filter(o => o.status === "canceled");
    return orders.filter(o => o.status !== "delivered" && o.status !== "canceled");
  }, [orders, statusFilter]);

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Pronto",
    delivering: "Em entrega",
    delivered: "Entregue",
    canceled: "Cancelado",
  };

  const paymentLabels: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    card: "Cartão",
  };

  const filterButtons: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "delivered", label: "Entregues" },
    { value: "canceled", label: "Cancelados" },
    { value: "other", label: "Outros" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Histórico Completo de Pedidos
          </SheetTitle>
        </SheetHeader>

        {customer && (
          <div className="space-y-4">
            {/* Customer Summary */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{customer.name}</h3>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{customer.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total de Pedidos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    R$ {customer.totalSpent.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    R$ {customer.totalOrders > 0 ? (customer.totalSpent / customer.totalOrders).toFixed(2) : "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                  <span className="ml-1.5 text-xs opacity-70">
                    ({filter.value === "all" ? orders.length :
                      filter.value === "delivered" ? orders.filter(o => o.status === "delivered").length :
                      filter.value === "canceled" ? orders.filter(o => o.status === "canceled").length :
                      orders.filter(o => o.status !== "delivered" && o.status !== "canceled").length
                    })
                  </span>
                </Button>
              ))}
            </div>

            {/* Orders List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum pedido encontrado com este filtro</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-400px)]">
                <div className="space-y-3 pr-3">
                  {filteredOrders.map((order) => {
                    const items = Array.isArray(order.items) ? order.items : [];

                    return (
                      <div key={order.id} className="p-4 rounded-lg border bg-card space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-semibold text-muted-foreground">
                              #{order.order_number}
                            </span>
                            <Badge
                              variant={order.status === "delivered" ? "default" : order.status === "canceled" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {statusLabels[order.status] || order.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-1">
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground truncate max-w-[250px]">
                                {item.quantity}x {item.name}
                                {item.addonNames && Object.keys(item.addonNames).length > 0 && (
                                  <span className="text-muted-foreground/60 ml-1">
                                    (+{Object.values(item.addonNames).flat().join(", ")})
                                  </span>
                                )}
                              </span>
                              <span className="font-medium shrink-0 ml-2">
                                R$ {((item.price + (item.addonsTotal || 0)) * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.notes && (
                          <p className="text-xs text-muted-foreground italic">Obs: {order.notes}</p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}</span>
                            <span>•</span>
                            <span>{paymentLabels[order.payment_method] || order.payment_method}</span>
                          </div>
                          <div className="flex items-center gap-1 font-semibold text-primary">
                            <DollarSign className="w-4 h-4" />
                            R$ {Number(order.total).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
