import { useEffect, useState } from "react";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderCountdown } from "@/components/admin/OrderCountdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { maskCpfCnpj } from "@/utils/cpfCnpj";
import {
  Clock,
  ChefHat,
  Truck,
  CheckCircle2,
  Phone,
  MapPin,
  CreditCard,
  ChevronDown,
  Package,
  RefreshCw,
  Plus,
  Printer,
  HandPlatter,
  Check,
  XCircle,
  Bike,
  MessageCircle,
  DollarSign,
  ExternalLink,
  Calendar,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ManualOrderDrawer } from "@/components/admin/ManualOrderDrawer";
import { KanbanBoard } from "@/components/admin/KanbanBoard";
import { printOrder, printBatchOrders } from "@/components/orders/OrderReceipt";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { playNewOrderSound, NotificationSoundType, setKeepAliveCallback } from "@/lib/notification-sound";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import EmitirNFeButton from "@/components/admin/fiscal/EmitirNFeButton";
import NFeStatusBadge from "@/components/admin/fiscal/NFeStatusBadge";

type Order = Tables<"orders">;

interface Driver {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  fixed_fee: number;
  per_ride_fee: number;
  fee_mode: string;
  is_active: boolean;
}

interface StageConfig {
  label: string;
  nextLabel: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
}

const stageConfig: Record<string, StageConfig> = {
  pending: { label: "Novo", nextLabel: "Preparar", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700", icon: Clock },
  preparing: { label: "Preparando", nextLabel: "Pronto", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700", icon: ChefHat },
  ready: { label: "Pronto", nextLabel: "Enviar", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700", icon: Package },
  pickup_ready: { label: "Aguardando Retirada", nextLabel: "Retirado", bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-300 dark:border-indigo-700", icon: HandPlatter },
  out_for_delivery: { label: "A Caminho", nextLabel: "Entregue", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700", icon: Truck },
  delivered: { label: "Entregue", nextLabel: "", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Recusado", nextLabel: "", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700", icon: XCircle },
  cancelled: { label: "Cancelado", nextLabel: "", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700", icon: XCircle },
};

const stageOrder = ["pending", "preparing", "ready", "pickup_ready", "out_for_delivery", "delivered"];

const paymentMethodLabels: Record<string, string> = { pix: "PIX", cash: "Dinheiro", card: "Cartão" };

export default function AdminOrders() {
  const { cashRegisterOpen } = useOutletContext<{ cashRegisterOpen: boolean }>();
  const { selectedRestaurantIds, selectedRestaurant, restaurants } = useRestaurantContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationSound, setNotificationSound] = useState<NotificationSoundType>("medium");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrintOrders") === "true");
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<string>("todos");
  const [addonNamesCache, setAddonNamesCache] = useState<Record<string, string>>({});
  const [addonPricesCache, setAddonPricesCache] = useState<Record<string, number>>({});
  const [driversByRestaurant, setDriversByRestaurant] = useState<Record<string, Driver[]>>({});
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const { toast } = useToast();

  // Fiscal state
  const [fiscalConfig, setFiscalConfig] = useState<{
    is_configured: boolean;
    is_active: boolean;
    provider: string;
    environment: string;
  } | null>(null);
  const [fiscalInvoices, setFiscalInvoices] = useState<Record<string, any>>({});

  // Derived values
  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);
  const manualOrderRestaurantId = restaurantId || restaurants[0]?.id || null;
  const restaurantName = selectedRestaurant?.name || restaurants[0]?.name || "";

  // Check for pedido_manual query param to open modal automatically
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("pedido_manual") === "true") {
      setShowManualOrder(true);
      // Clean up the query param
      navigate("/admin/pedidos", { replace: true });
    }
  }, [location.search, setShowManualOrder, navigate]);

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

  // Filter only orders awaiting online payment (all statuses stay visible until daily reset at 23:59)
  const activeOrders = orders.filter(o => o.payment_status !== "awaiting_payment");
  const sortedOrders = [...activeOrders].sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime());

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
        console.log("[FISCAL] Config carregada:", data);
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
      console.log("[FISCAL] Invoices encontradas:", map);
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
      console.log('🟢 REALTIME EVENT RECEIVED:', payload);
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
    const idsString = selectedRestaurantIds.join(",");
    const channels = selectedRestaurantIds.map((rid, idx) =>
      supabase.channel(`orders-realtime-${rid}-${idx}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, handleRealtimePayload)
        .subscribe((status, err) => {
          console.log(`📡 REALTIME STATUS [${rid}]:`, status);
          if (err) console.error(`❌ REALTIME ERROR [${rid}]:`, err);
        })
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

  const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
          <h1 className="text-xl sm:text-2xl font-bold">Pedidos</h1>
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
          onOrderClick={(order) => { setSelectedOrder(order); resolveAddonNames(order); }}
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

/* ─── Order Detail Dialog ─── */

interface OrderDetailDialogProps {
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

function OrderDetailDialog({ order, onChangeStatus, onCancelOrder, onPrint, formatCurrency, addonNamesCache = {}, addonPricesCache = {}, drivers = [], restaurantName, showRestaurantTag, deliveryTimeMin }: OrderDetailDialogProps) {
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