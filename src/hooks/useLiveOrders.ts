import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { printOrder, printBatchOrders } from "@/components/orders/OrderReceipt";
import { playNewOrderSound, NotificationSoundType, setKeepAliveCallback } from "@/lib/notification-sound";
import { formatCurrency, Driver } from "@/lib/order-display";

type Order = Tables<"orders">;

interface FiscalConfig {
  is_configured: boolean;
  is_active: boolean;
  provider: string;
  environment: string;
}

/**
 * Orquestração compartilhada dos pedidos de hoje (Kanban "Painel ao Vivo" e
 * listagem "Pedidos"). Encapsula fetch dos pedidos do dia, realtime + polling,
 * som/auto-impressão de novos pedidos, entregadores, configuração fiscal/NFe,
 * caches de addon e as mutações de status (changeStatus/cancelOrder).
 */
export function useLiveOrders(cashRegisterOpen: boolean) {
  const { selectedRestaurantIds, selectedRestaurant, restaurants } = useRestaurantContext();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationSound, setNotificationSound] = useState<NotificationSoundType>("medium");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrintOrders") === "true");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [addonNamesCache, setAddonNamesCache] = useState<Record<string, string>>({});
  const [addonPricesCache, setAddonPricesCache] = useState<Record<string, number>>({});
  const [driversByRestaurant, setDriversByRestaurant] = useState<Record<string, Driver[]>>({});
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Fiscal state
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);
  const [fiscalInvoices, setFiscalInvoices] = useState<Record<string, any>>({});

  // Derived values
  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);
  const manualOrderRestaurantId = restaurantId || restaurants[0]?.id || null;
  const restaurantName = selectedRestaurant?.name || restaurants[0]?.name || "";

  // Filter only orders awaiting online payment (all statuses stay visible until daily reset at 23:59)
  const activeOrders = orders.filter(o => o.payment_status !== "awaiting_payment");
  const sortedOrders = [...activeOrders].sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime());

  // Resolve addon names and prices from DB
  const resolveAddonNames = async (order: Order) => {
    const items = order.items as Array<{ addons?: Record<string, string[]> | any[]; addonNames?: Record<string, string> }>;
    const allAddonIds: string[] = [];
    items.forEach((item) => {
      if (item.addons && !Array.isArray(item.addons)) {
        const ids = Object.values(item.addons).flat();
        allAddonIds.push(...ids);
      }
    });
    const needFetch = [...new Set(allAddonIds)].filter((id) => addonPricesCache[id] == null);
    if (needFetch.length === 0) return;
    const { data } = await supabase.from("addon_items").select("id, name, price").in("id", needFetch);
    if (data) {
      const nameCache: Record<string, string> = {};
      const priceCache: Record<string, number> = {};
      data.forEach((item) => { nameCache[item.id] = item.name; priceCache[item.id] = item.price; });
      setAddonNamesCache((prev) => ({ ...prev, ...nameCache }));
      setAddonPricesCache((prev) => ({ ...prev, ...priceCache }));
    }
  };

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    resolveAddonNames(order);
  };

  // Selection handlers for batch printing (delivered tab only)
  const toggleSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const selectTodayOrders = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = sortedOrders
      .filter(o => o.status === "delivered" && new Date(o.created_at || "") >= today)
      .map(o => o.id);
    setSelectedOrders(todayOrders);
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  const handleBatchPrint = () => {
    const selectedOrdersData = sortedOrders.filter(o => selectedOrders.includes(o.id));
    if (selectedOrdersData.length === 0) return;
    printBatchOrders(selectedOrdersData, restaurantName, addonNamesCache, addonPricesCache);
  };

  // Set notification sound from selected restaurant
  useEffect(() => {
    if (selectedRestaurant?.notification_sound) {
      setNotificationSound(selectedRestaurant.notification_sound as NotificationSoundType);
    }
  }, [selectedRestaurant]);

  // Load fiscal config
  useEffect(() => {
    const loadFiscalConfig = async () => {
      if (!restaurantId) return;

      const { data } = await supabase
        .from("fiscal_config")
        .select("is_configured, is_active, provider, environment")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (data) {
        setFiscalConfig(data);
      }
    };

    loadFiscalConfig();
  }, [restaurantId]);

  // Load fiscal invoices
  const loadFiscalInvoices = async (orderIds: string[]) => {
    if (!orderIds.length || !restaurantId) return;

    const { data } = await supabase
      .from("fiscal_invoices")
      .select("*")
      .in("order_id", orderIds)
      .eq("restaurant_id", restaurantId);

    if (data) {
      const map: Record<string, any> = {};
      data.forEach((inv) => {
        map[inv.order_id] = inv;
      });
      setFiscalInvoices(map);
    }
  };

  // Handle invoice update
  const handleInvoiceUpdate = (orderId: string, invoice: any) => {
    setFiscalInvoices((prev) => ({ ...prev, [orderId]: invoice }));
  };

  // Fetch active drivers for currently visible restaurants and group by restaurant
  useEffect(() => {
    if (selectedRestaurantIds.length === 0) {
      setDriversByRestaurant({});
      return;
    }

    supabase
      .from("drivers")
      .select("*")
      .in("restaurant_id", selectedRestaurantIds)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const grouped: Record<string, Driver[]> = {};
        ((data as Driver[]) || []).forEach((driver) => {
          if (!grouped[driver.restaurant_id]) grouped[driver.restaurant_id] = [];
          grouped[driver.restaurant_id].push(driver);
        });
        setDriversByRestaurant(grouped);
      });
  }, [selectedRestaurantIds.join(",")]);

  useEffect(() => {
    if (selectedRestaurantIds.length === 0) return;

    setKeepAliveCallback(() => {});

    const getTodayStart = () => {
      const spFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
      return new Date(`${spFormatter.format(new Date())}T00:00:00-03:00`).toISOString();
    };

    async function fetchOrders() {
      const todayStart = getTodayStart();
      let query = supabase.from("orders").select("*").eq("is_archived", false).neq("payment_status", "awaiting_payment").gte("created_at", todayStart).order("created_at", { ascending: false });
      if (selectedRestaurantIds.length === 1) {
        query = query.eq("restaurant_id", selectedRestaurantIds[0]);
      } else {
        query = query.in("restaurant_id", selectedRestaurantIds);
      }
      const { data, error } = await query;
      if (error) { toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" }); return; }
      setOrders(data || []);
      setLoading(false);

      // Load fiscal invoices after orders are loaded
      if (data && data.length > 0) {
        const orderIds = data.map(o => o.id);
        loadFiscalInvoices(orderIds);
      }
    }
    fetchOrders();

    const handleRealtimePayload = (payload: any) => {
      if (payload.eventType === "INSERT") {
        const newOrder = payload.new as Order;
        if (newOrder.payment_status === "awaiting_payment") return;

        // Use functional update to ensure we have the latest state
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;

          // Logic for notification
          if (newOrder.status === "pending" && newOrder.payment_status !== "awaiting_payment") {
            const restName = restaurants.find(r => r.id === newOrder.restaurant_id)?.name || "";
            toast({ title: "🔔 Novo pedido!", description: `${restName ? restName + " - " : ""}Pedido #${newOrder.daily_number ?? newOrder.order_number}`, duration: 10000 });
            playNewOrderSound(notificationSound, `Pedido #${newOrder.daily_number ?? newOrder.order_number} - ${newOrder.customer_name}`);
            if (localStorage.getItem("autoPrintOrders") === "true") setTimeout(() => printOrder(newOrder, restName), 500);
          }

          return [newOrder, ...prev];
        });
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Order;

        setOrders((prev) => {
          const oldOrder = prev.find((o) => o.id === updated.id);

          if (updated.is_archived) {
            return prev.filter((o) => o.id !== updated.id);
          }

          if (oldOrder?.payment_status === "awaiting_payment" && updated.payment_status === "paid") {
            const restName = restaurants.find(r => r.id === updated.restaurant_id)?.name || "";
            toast({ title: "🔔 Novo pedido pago!", description: `${restName ? restName + " - " : ""}Pedido #${updated.daily_number ?? updated.order_number}`, duration: 10000 });
            playNewOrderSound(notificationSound, `Pedido #${updated.daily_number ?? updated.order_number} - ${updated.customer_name}`);
            if (localStorage.getItem("autoPrintOrders") === "true") setTimeout(() => printOrder(updated, restName), 500);
          }

          return prev.map((o) => o.id === updated.id ? updated : o);
        });
      } else if (payload.eventType === "DELETE") {
        setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
      }
    };

    // Subscribe to each restaurant
    const channels = selectedRestaurantIds.map((rid, idx) =>
      supabase.channel(`orders-realtime-${rid}-${idx}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, handleRealtimePayload)
        .subscribe()
    );

    const pollInterval = setInterval(async () => {
      const todayStart = getTodayStart();
      let query = supabase.from("orders").select("*").eq("is_archived", false).neq("payment_status", "awaiting_payment").gte("created_at", todayStart).order("created_at", { ascending: false });
      if (selectedRestaurantIds.length === 1) {
        query = query.eq("restaurant_id", selectedRestaurantIds[0]);
      } else {
        query = query.in("restaurant_id", selectedRestaurantIds);
      }
      const { data } = await query;
      if (data) {
        setOrders((prev) => {
          const prevIds = new Set(prev.map((o) => o.id));
          const newOrders = data.filter((o) => !prevIds.has(o.id) && o.status === "pending");
          if (newOrders.length > 0) {
            newOrders.forEach((n) => {
              toast({ title: "🔔 Novo pedido!", description: `Pedido #${n.daily_number ?? n.order_number}`, duration: 10000 });
              if (localStorage.getItem("autoPrintOrders") === "true") setTimeout(() => printOrder(n, restaurantName), 500);
            });
            playNewOrderSound(notificationSound, `${newOrders.length} novo(s) pedido(s) recebido(s)`);
          }
          return data;
        });
      }
    }, 15000);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollInterval);
      setKeepAliveCallback(null);
    };
  }, [selectedRestaurantIds.join(","), notificationSound, toast, restaurants]);

  const changeStatus = async (orderId: string, newStatus: string, driverId?: string, driverName?: string) => {
    // Block accepting orders if cash register is not open
    const order = orders.find(o => o.id === orderId);
    if (order?.status === "pending" && newStatus !== "rejected" && !cashRegisterOpen) {
      toast({
        title: "⚠️ Caixa fechado",
        description: "Abra o caixa antes de aceitar pedidos.",
        variant: "destructive",
      });
      return;
    }

    const updateData: any = { status: newStatus };
    // Mark accepted_at only when transitioning from pending (acceptance moment)
    if (order?.status === "pending" && newStatus !== "rejected") {
      updateData.accepted_at = new Date().toISOString();
    }
    if (driverId) {
      updateData.driver_id = driverId;
      updateData.driver_name = driverName || null;
    } else if (driverId === undefined && driverName === undefined) {
      // Explicitly clear driver when "none" is selected
      updateData.driver_id = null;
      updateData.driver_name = null;
    }
    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
    if (error) toast({ title: "Erro ao atualizar pedido", description: error.message, variant: "destructive" });
    setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: newStatus, driver_id: driverId ?? null, driver_name: driverName ?? null } as any : prev);

    const orderRestaurantId = order?.restaurant_id ?? selectedOrder?.restaurant_id ?? null;

    if (orderRestaurantId && !error) {
      // Auto-refund when rejecting a paid online order
      if (newStatus === "rejected" && order && order.payment_status === "paid" && ["pix", "card"].includes(order.payment_method)) {
        supabase.functions.invoke("refund-payment", {
          body: { order_id: orderId, restaurant_id: orderRestaurantId },
        }).then(({ data, error: fnError }) => {
          if (fnError) {
            console.error("Refund function error:", fnError);
            toast({ title: "⚠️ Erro no estorno", description: "Não foi possível estornar automaticamente. Verifique manualmente no Mercado Pago.", variant: "destructive" });
            return;
          }
          if (data?.success && !data?.skipped) {
            toast({ title: "💰 Estorno realizado", description: "O pagamento foi estornado automaticamente." });
          } else if (data?.error) {
            toast({ title: "⚠️ Erro no estorno", description: data.error, variant: "destructive" });
          }
        }).catch(err => {
          console.error("Refund error:", err);
          toast({ title: "⚠️ Erro no estorno", description: "Falha ao processar estorno. Verifique manualmente.", variant: "destructive" });
        });
      }

      supabase.functions.invoke("whatsapp-bot", {
        body: {
          action: "send_status_update",
          restaurant_id: orderRestaurantId,
          order_id: orderId,
          new_status: newStatus,
        },
      }).catch(err => console.log("Bot notification error (non-critical):", err));

      // Lá Vem Entregas — auto-dispatch when order becomes "ready" and integration is in auto mode
      if (newStatus === "ready" && order?.delivery_type === "delivery" && !(order as any).lavem_delivery_id && !driverId) {
        const { data: integ } = await supabase
          .from("lavem_integrations")
          .select("is_active, dispatch_mode")
          .eq("restaurant_id", orderRestaurantId)
          .maybeSingle();
        if (integ?.is_active && integ.dispatch_mode === "auto") {
          supabase.functions.invoke("lavem-dispatch", { body: { order_id: orderId } })
            .then(({ data, error: fnErr }) => {
              if (fnErr || data?.error) {
                toast({ title: "⚠️ Lá Vem Entregas", description: data?.error || fnErr?.message || "Falha ao solicitar entregador", variant: "destructive" });
              } else {
                toast({ title: "🛵 Entregador Lá Vem solicitado", description: "Aguardando atribuição..." });
              }
            })
            .catch(err => console.error("lavem-dispatch error:", err));
        }
      }
    }
  };

  const cancelOrder = async (orderId: string, reason: string) => {
    const order = orders.find(o => o.id === orderId);
    const updateData: any = { status: "cancelled", cancellation_reason: reason || null };
    const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
    if (error) {
      toast({ title: "Erro ao cancelar pedido", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: "cancelled", cancellation_reason: reason } as any : prev);
    toast({ title: "Pedido cancelado", description: "O pedido foi cancelado com sucesso." });

    const orderRestaurantId = order?.restaurant_id ?? selectedOrder?.restaurant_id ?? null;

    if (orderRestaurantId) {
      // Auto-refund when cancelling a paid online order
      if (order && order.payment_status === "paid" && ["pix", "card"].includes(order.payment_method)) {
        supabase.functions.invoke("refund-payment", {
          body: { order_id: orderId, restaurant_id: orderRestaurantId },
        }).then(({ data, error: fnError }) => {
          if (fnError) {
            console.error("Refund function error:", fnError);
            toast({ title: "⚠️ Erro no estorno", description: "Não foi possível estornar automaticamente. Verifique manualmente no Mercado Pago.", variant: "destructive" });
            return;
          }
          if (data?.success && !data?.skipped) {
            toast({ title: "💰 Estorno realizado", description: "O pagamento foi estornado automaticamente." });
          } else if (data?.error) {
            toast({ title: "⚠️ Erro no estorno", description: data.error, variant: "destructive" });
          }
        }).catch(err => {
          console.error("Refund error:", err);
          toast({ title: "⚠️ Erro no estorno", description: "Falha ao processar estorno. Verifique manualmente.", variant: "destructive" });
        });
      }

      supabase.functions.invoke("whatsapp-bot", {
        body: {
          action: "send_status_update",
          restaurant_id: orderRestaurantId,
          order_id: orderId,
          new_status: "cancelled",
        },
      }).catch(err => console.log("Bot notification error (non-critical):", err));
    }
  };

  return {
    // data
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
    // detail dialog
    selectedOrder,
    setSelectedOrder,
    openOrder,
    // caches
    addonNamesCache,
    addonPricesCache,
    resolveAddonNames,
    // drivers
    driversByRestaurant,
    // fiscal
    fiscalConfig,
    fiscalInvoices,
    handleInvoiceUpdate,
    // notifications / print
    autoPrint,
    setAutoPrint,
    notificationSound,
    // selection (batch print / NFe)
    selectedOrders,
    toggleSelection,
    selectTodayOrders,
    clearSelection,
    handleBatchPrint,
    // mutations
    changeStatus,
    cancelOrder,
    // utils
    formatCurrency,
  };
}
