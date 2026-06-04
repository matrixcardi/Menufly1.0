import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { printKitchenTicket, printCloseComanda } from "@/components/orders/SalaoReceipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Armchair, ShoppingCart, Search, Plus, Minus, Trash2,
  Utensils, Loader2, Settings, Edit, Users, Clock, DollarSign,
  CreditCard, Smartphone, Receipt, ChefHat, CheckCircle2, X, Printer,
  MapPin, UserRound, Timer, Banknote, SlidersHorizontal, Calendar,
  Download, Eye, Bell, Flame, AlertCircle, Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string;
}

interface Category { id: string; name: string; }

interface Table {
  id: string;
  name: string;
  number: number;
  capacity: number;
  status: "free" | "occupied" | "bill_requested" | "reserved";
  current_order_id: string | null;
  notes?: string;
  opened_at?: string | null;
  people_count?: number | null;
  created_at: string;
}

interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  observation: string;
}

interface ActiveOrder {
  id: string;
  order_number: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  people_count: number | null;
  table_number: number | null;
  created_at: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  observation: string;
}

interface Reservation {
  id: string;
  table_id: string;
  customer_name: string;
  customer_phone?: string;
  reservation_date: string;
  reservation_time: string;
  number_of_people: number;
  status: string;
}

type PaymentType = "cash" | "card" | "pix" | "mixed";
type SalaoTab = "mesas" | "em_preparo" | "fechadas";
type KitchenStatus = "pending" | "preparing" | "ready" | "delivered";

interface KitchenOrder {
  id: string;
  order_number: string;
  table_id: string | null;
  table_number: number | null;
  customer_name: string;
  items: OrderItem[];
  total: number;
  people_count: number | null;
  kitchen_status: KitchenStatus;
  sent_to_kitchen_at: string;
  marked_ready_at: string | null;
  created_at: string;
}

interface ClosedOrder {
  id: string;
  order_number: string;
  table_number: number | null;
  customer_name: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  people_count: number | null;
  closed_at: string;
  created_at: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminSalao() {
  const { selectedRestaurantId, selectedRestaurantIds, selectedRestaurant } = useRestaurantContext();
  const { toast } = useToast();
  const { confirm, ConfirmDialogNode } = useConfirm();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds?.[0] : selectedRestaurantId;

  // Data
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SalaoTab>("mesas");
  
  // Kitchen orders data
  const [kitchenOrders, setKitchenOrders] = useState<KitchenOrder[]>([]);
  const [kitchenFilter, setKitchenFilter] = useState<KitchenStatus | "all">("all");
  const [loadingKitchen, setLoadingKitchen] = useState(false);
  
  // Closed orders data
  const [closedOrders, setClosedOrders] = useState<ClosedOrder[]>([]);
  const [closedOrdersFilter, setClosedOrdersFilter] = useState<"today" | "yesterday" | "week" | "custom">("today");
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [selectedClosedOrder, setSelectedClosedOrder] = useState<ClosedOrder | null>(null);

  // UI state
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingToKitchen, setSendingToKitchen] = useState(false);

  // Modals
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCloseComandaModal, setShowCloseComandaModal] = useState(false);
  const [showOpenTableModal, setShowOpenTableModal] = useState(false);
  const [pendingOpenTable, setPendingOpenTable] = useState<Table | null>(null);
  const [showCancelTableConfirm, setShowCancelTableConfirm] = useState(false);
  // Filter
  const [tableFilter, setTableFilter] = useState<"all" | "free" | "occupied" | "bill_requested" | "reserved">("all");

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!ctxRestaurantId) { setLoading(false); return; }
    try {
      const [tablesRes, catsRes, prodsRes, resvsRes] = await Promise.all([
        supabase.from("pdv_tables" as any).select("*").eq("restaurant_id", ctxRestaurantId).order("number"),
        supabase.from("categories").select("id, name").eq("restaurant_id", ctxRestaurantId).order("name"),
        supabase.from("products").select("id, name, price, image_url, category_id")
          .eq("restaurant_id", ctxRestaurantId).eq("is_active", true).order("name"),
        supabase.from("table_reservations" as any).select("*")
          .eq("restaurant_id", ctxRestaurantId)
          .gte("reservation_date", new Date().toISOString().split("T")[0])
          .order("reservation_date").order("reservation_time"),
      ]);
      if (tablesRes.data) setTables(tablesRes.data as Table[]);
      if (catsRes.data) setCategories(catsRes.data);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (resvsRes.data) setReservations(resvsRes.data as Reservation[]);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [ctxRestaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch Kitchen Orders ───────────────────────────────────────────────────────

  const fetchKitchenOrders = useCallback(async () => {
    if (!ctxRestaurantId) return;
    setLoadingKitchen(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", ctxRestaurantId)
        .not("sent_to_kitchen_at", "is", null)
        .is("closed_at", null)
        .in("kitchen_status", ["pending", "preparing", "ready"])
        .order("sent_to_kitchen_at", { ascending: true });
      
      if (error) throw error;
      setKitchenOrders(data as KitchenOrder[] || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar pedidos em preparo", variant: "destructive" });
    } finally {
      setLoadingKitchen(false);
    }
  }, [ctxRestaurantId, toast]);

  // ── Fetch Closed Orders ───────────────────────────────────────────────────────

  const fetchClosedOrders = useCallback(async () => {
    if (!ctxRestaurantId) return;
    setLoadingClosed(true);
    try {
      let startDate: Date;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (closedOrdersFilter) {
        case "today":
          startDate = today;
          break;
        case "yesterday":
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 1);
          break;
        case "week":
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "custom":
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30); // Default to last 30 days
          break;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", ctxRestaurantId)
        .not("closed_at", "is", null)
        .gte("closed_at", startDate.toISOString())
        .order("closed_at", { ascending: false });
      
      if (error) throw error;
      setClosedOrders(data as ClosedOrder[] || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar comandas fechadas", variant: "destructive" });
    } finally {
      setLoadingClosed(false);
    }
  }, [ctxRestaurantId, closedOrdersFilter, toast]);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === "em_preparo") fetchKitchenOrders();
    if (activeTab === "fechadas") fetchClosedOrders();
  }, [activeTab, fetchKitchenOrders, fetchClosedOrders]);

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!ctxRestaurantId) return;
    const channel = supabase.channel(`salao-tables-${ctxRestaurantId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "pdv_tables",
        filter: `restaurant_id=eq.${ctxRestaurantId}`,
      }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setTables(prev => prev.map(t => t.id === (payload.new as Table).id ? payload.new as Table : t));
          // Refresh selected table data
          setSelectedTable(prev => prev?.id === (payload.new as Table).id ? payload.new as Table : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ctxRestaurantId]);

  // Realtime for kitchen orders
  useEffect(() => {
    if (!ctxRestaurantId || activeTab !== "em_preparo") return;
    const channel = supabase.channel(`salao-kitchen-${ctxRestaurantId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `restaurant_id=eq.${ctxRestaurantId}`,
      }, (payload) => {
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          fetchKitchenOrders();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ctxRestaurantId, activeTab, fetchKitchenOrders]);

  // ── Table selection ───────────────────────────────────────────────────────

  const handleTableClick = async (table: Table) => {
    if (table.status === "free" || table.status === "reserved") {
      // Prompt for people count before opening
      setPendingOpenTable(table);
      setShowOpenTableModal(true);
      return;
    }
    setSelectedTable(table);
    setCart([]);
    if (table.current_order_id) {
      await loadActiveOrder(table.current_order_id);
    } else {
      setActiveOrder(null);
    }
  };

  const loadActiveOrder = async (orderId: string) => {
    const { data } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (!data) return;
    const items: OrderItem[] = Array.isArray(data.items) ? data.items : [];
    setActiveOrder({
      id: data.id,
      order_number: data.order_number,
      items,
      subtotal: Number(data.subtotal),
      total: Number(data.total),
      people_count: (data as any).people_count ?? null,
      table_number: (data as any).table_number ?? null,
      created_at: data.created_at,
    });
  };

  const handleOpenTable = async (peopleCount: number) => {
    if (!pendingOpenTable || !ctxRestaurantId) return;
    const table = pendingOpenTable;
    // Mark table as occupied and set opened_at / people_count
    const { error } = await supabase.from("pdv_tables" as any)
      .update({ status: "occupied", opened_at: new Date().toISOString(), people_count: peopleCount })
      .eq("id", table.id);
    if (error) {
      toast({ title: "Erro ao abrir mesa", description: error.message, variant: "destructive" });
      return;
    }
    const updatedTable = { ...table, status: "occupied" as const, opened_at: new Date().toISOString(), people_count: peopleCount };
    setTables(prev => prev.map(t => t.id === table.id ? updatedTable : t));
    setSelectedTable(updatedTable);
    setActiveOrder(null);
    setCart([]);
    setPendingOpenTable(null);
    setShowOpenTableModal(false);
  };

  // ── Cart ──────────────────────────────────────────────────────────────────

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, observation: "" }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.product.id !== productId));

  const cartSubtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  // ── Send to kitchen (new round) ───────────────────────────────────────────

  const handleSendToKitchen = async () => {
    if (!selectedTable || cart.length === 0 || !ctxRestaurantId) return;
    setSendingToKitchen(true);
    try {
      const newItems: OrderItem[] = cart.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        observation: i.observation,
      }));

      if (activeOrder) {
        // ACCUMULATE: append new items to existing order
        const merged = [...activeOrder.items];
        newItems.forEach(ni => {
          const idx = merged.findIndex(mi => mi.product_id === ni.product_id && mi.observation === ni.observation);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + ni.quantity };
          } else {
            merged.push(ni);
          }
        });
        const newSubtotal = merged.reduce((s, i) => s + i.price * i.quantity, 0);
        const { error } = await supabase.from("orders")
          .update({ 
            items: merged as any, 
            subtotal: newSubtotal, 
            total: newSubtotal,
            sent_to_kitchen_at: new Date().toISOString(),
            kitchen_status: "pending"
          })
          .eq("id", activeOrder.id);
        if (error) throw error;
        setActiveOrder({ ...activeOrder, items: merged, subtotal: newSubtotal, total: newSubtotal });
        // Print only the NEW items
        printKitchenTicket({
          tableNumber: selectedTable.number,
          tableName: selectedTable.name,
          peopleCount: selectedTable.people_count ?? activeOrder.people_count ?? null,
          items: newItems,
          round: "adicional",
          restaurantName: selectedRestaurant?.name,
        });
        toast({ title: "✅ Enviado para a cozinha", description: `${newItems.length} item(ns) adicionado(s) à comanda` });
      } else {
        // FIRST ORDER for this table
        const orderNumber = `SAL-${Date.now().toString().slice(-8)}`;
        const subtotal = newItems.reduce((s, i) => s + i.price * i.quantity, 0);
        const { data: orderData, error: orderError } = await supabase.from("orders")
          .insert({
            restaurant_id: ctxRestaurantId,
            order_number: orderNumber,
            customer_name: `Mesa ${selectedTable.number}`,
            customer_phone: "00000000000",
            delivery_type: "table",
            payment_method: "cash",
            payment_status: "pending",
            status: "preparing",
            origin: "pdv_salao",
            table_id: selectedTable.id,
            table_number: selectedTable.number,
            people_count: selectedTable.people_count ?? null,
            items: newItems as any,
            subtotal,
            discount: 0,
            delivery_fee: 0,
            total: subtotal,
            sent_to_kitchen_at: new Date().toISOString(),
            kitchen_status: "pending",
          })
          .select("id, order_number, subtotal, total, created_at")
          .single();
        if (orderError) throw orderError;
        // Link order to table
        await supabase.from("pdv_tables" as any)
          .update({ status: "occupied", current_order_id: orderData.id })
          .eq("id", selectedTable.id);
        const newActiveOrder: ActiveOrder = {
          id: orderData.id,
          order_number: orderData.order_number,
          items: newItems,
          subtotal: orderData.subtotal,
          total: orderData.total,
          people_count: selectedTable.people_count ?? null,
          table_number: selectedTable.number,
          created_at: orderData.created_at,
        };
        setActiveOrder(newActiveOrder);
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: "occupied", current_order_id: orderData.id } : t));
        setSelectedTable(prev => prev ? { ...prev, status: "occupied", current_order_id: orderData.id } : prev);
        printKitchenTicket({
          tableNumber: selectedTable.number,
          tableName: selectedTable.name,
          peopleCount: selectedTable.people_count ?? null,
          items: newItems,
          round: "primeira",
          restaurantName: selectedRestaurant?.name,
        });
        toast({ title: "✅ Comanda aberta", description: `Pedido ${orderNumber} enviado à cozinha` });
      }
      setCart([]);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao enviar para cozinha", description: e?.message, variant: "destructive" });
    } finally {
      setSendingToKitchen(false);
    }
  };

  // ── Close comanda (finalize & free table) ─────────────────────────────────

  const handleCloseComanda = async (paymentMethod: PaymentType, discount: number) => {
    if (!selectedTable || !activeOrder) return;
    const finalTotal = Math.max(0, activeOrder.subtotal - discount);
    const { error } = await supabase.from("orders")
      .update({ 
        status: "delivered", 
        payment_method: paymentMethod, 
        payment_status: "paid", 
        discount, 
        total: finalTotal,
        closed_at: new Date().toISOString(),
        kitchen_status: "delivered"
      })
      .eq("id", activeOrder.id);
    if (error) { toast({ title: "Erro ao fechar comanda", description: error.message, variant: "destructive" }); return; }
    await supabase.from("pdv_tables" as any)
      .update({ status: "free", current_order_id: null, opened_at: null, people_count: null })
      .eq("id", selectedTable.id);
    printCloseComanda({
      tableNumber: selectedTable.number,
      tableName: selectedTable.name,
      items: activeOrder.items,
      subtotal: activeOrder.subtotal,
      discount,
      total: finalTotal,
      paymentMethod,
      peopleCount: activeOrder.people_count ?? null,
      restaurantName: selectedRestaurant?.name,
    });
    setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: "free", current_order_id: null } : t));
    setSelectedTable(null);
    setActiveOrder(null);
    setCart([]);
    setShowCloseComandaModal(false);
    toast({ title: "🎉 Comanda fechada!", description: `Mesa ${selectedTable.number} liberada` });
  };

  // ── Save/Delete table ─────────────────────────────────────────────────────

  const handleSaveTable = async (data: { name: string; number: number; capacity: number; status: string; notes?: string }) => {
    try {
      if (editingTable) {
        const { error } = await supabase.from("pdv_tables" as any).update(data).eq("id", editingTable.id);
        if (error) throw error;
        toast({ title: "Mesa atualizada" });
      } else {
        const { error } = await supabase.from("pdv_tables" as any)
          .insert({ ...data, restaurant_id: ctxRestaurantId, status: "free" });
        if (error) throw error;
        toast({ title: "Mesa criada" });
      }
      setShowTableModal(false);
      setEditingTable(null);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro ao salvar mesa", description: e?.message, variant: "destructive" });
    }
  };

  const handleDeleteTable = async () => {
    if (!editingTable) return;
    if (editingTable.current_order_id) {
      toast({ title: "Mesa com pedido ativo", description: "Feche a comanda antes de excluir.", variant: "destructive" });
      return;
    }
    const ok = await confirm({
      type: "danger",
      title: `Excluir "${editingTable.name}"?`,
      description: `A mesa número ${editingTable.number} será removida permanentemente do seu salão.`,
      impact: "Todos os dados desta mesa serão excluídos. Pedidos anteriores vinculados a ela não serão afetados.",
      footer: "Esta ação não pode ser desfeita.",
      confirmText: "Sim, excluir mesa",
      cancelText: "Voltar",
    });
    if (!ok) return;
    const { error } = await supabase.from("pdv_tables" as any).delete().eq("id", editingTable.id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mesa excluída" });
    setShowTableModal(false);
    setEditingTable(null);
    fetchData();
  };

  const handleCancelTable = async () => {
    if (!selectedTable) return;
    const itemCount = activeOrder?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
    const total = activeOrder?.total ?? 0;
    const impactText = itemCount > 0
      ? `⚠️ O pedido em aberto será descartado: ${itemCount} ${itemCount === 1 ? "item" : "itens"} · R$ ${total.toFixed(2)}`
      : "A mesa será marcada como disponível imediatamente.";
    const ok = await confirm({
      type: "warning",
      title: `Cancelar atendimento da ${selectedTable.name}?`,
      description: `Você está prestes a liberar a mesa ${selectedTable.number} sem cobrar.`,
      impact: impactText,
      footer: "Esta ação não pode ser desfeita.",
      confirmText: "Sim, cancelar mesa",
      cancelText: "Voltar",
    });
    if (!ok) return;
    await supabase.from("pdv_tables" as any)
      .update({ status: "free", current_order_id: null, opened_at: null, people_count: null })
      .eq("id", selectedTable.id);
    setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: "free", current_order_id: null } : t));
    setSelectedTable(null);
    setActiveOrder(null);
    setCart([]);
    toast({ title: "Mesa liberada sem cobrança" });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getReservationForTable = (tableId: string) => {
    const today = new Date().toISOString().split("T")[0];
    return reservations.find(r => r.table_id === tableId && r.reservation_date === today && r.status !== "cancelled");
  };

  const filteredProducts = products.filter(p =>
    (selectedCategory === "all" || p.category_id === selectedCategory) &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tableStatusColor = (status: string) => ({
    free: "bg-green-500",
    occupied: "bg-orange-500",
    bill_requested: "bg-red-500",
    reserved: "bg-blue-400",
  }[status] ?? "bg-gray-400");

  const tableStatusLabel = (status: string) => ({
    free: "✅ Livre",
    occupied: "🍽️ Em atendimento",
    bill_requested: "💵 Conta pedida",
    reserved: "🔵 Reservada",
  }[status] ?? status);

  const tableStatusBadgeClass = (status: string) => ({
    free: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    occupied: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    bill_requested: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    reserved: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  }[status] ?? "bg-muted text-muted-foreground");

  const tableCardBorderClass = (status: string, isSelected: boolean) => {
    if (isSelected) return "ring-2 ring-primary shadow-lg border-primary/30";
    return ({
      free: "border-green-100 dark:border-green-900/30 hover:border-green-300",
      occupied: "border-orange-200 dark:border-orange-900/40 hover:border-orange-400",
      bill_requested: "border-red-300 dark:border-red-900 hover:border-red-400",
      reserved: "border-blue-200 dark:border-blue-900/40 hover:border-blue-300",
    }[status] ?? "border-border");
  };

  // Sort: bill_requested first, then occupied, then reserved, then free
  const statusOrder: Record<string, number> = { bill_requested: 0, occupied: 1, reserved: 2, free: 3 };

  const sortedAndFilteredTables = tables
    .map(t => {
      const reservation = getReservationForTable(t.id);
      const displayStatus = reservation && t.status === "free" ? "reserved" : t.status;
      return { ...t, displayStatus, reservation };
    })
    .filter(t => tableFilter === "all" || t.displayStatus === tableFilter)
    .sort((a, b) => (statusOrder[a.displayStatus] ?? 4) - (statusOrder[b.displayStatus] ?? 4));

  const tableOpenedDuration = (openedAt: string | null | undefined) => {
    if (!openedAt) return null;
    const diffMs = Date.now() - new Date(openedAt).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  };

  // ── Kitchen Orders Helpers ────────────────────────────────────────────────────

  const getKitchenTimeColor = (sentAt: string) => {
    const diffMin = Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000);
    if (diffMin < 10) return "text-green-600 dark:text-green-400";
    if (diffMin < 20) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getKitchenTimeLabel = (sentAt: string) => {
    const diffMin = Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000);
    if (diffMin < 1) return "agora mesmo";
    if (diffMin < 60) return `Enviado há ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `Enviado há ${h}h${m}min` : `Enviado há ${h}h`;
  };

  const kitchenStatusLabel = (status: KitchenStatus) => ({
    pending: { label: "⏱️ Aguardando", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    preparing: { label: "🔥 Preparando", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    ready: { label: "✅ Pronto", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    delivered: { label: "🍽️ Entregue", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300" },
  }[status]);

  const handleMarkAsReady = async (orderId: string) => {
    const { error } = await supabase.from("orders")
      .update({ 
        kitchen_status: "ready",
        marked_ready_at: new Date().toISOString()
      })
      .eq("id", orderId);
    if (error) {
      toast({ title: "Erro ao marcar como pronto", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Pedido marcado como pronto" });
    fetchKitchenOrders();
  };

  // ── Closed Orders Helpers ─────────────────────────────────────────────────────

  const paymentMethodLabel = (method: string) => ({
    cash: { label: "💵 Dinheiro", icon: Banknote },
    card: { label: "💳 Cartão", icon: CreditCard },
    pix: { label: "💵 Pix", icon: Smartphone },
    mixed: { label: "💵 Misto", icon: Receipt },
  }[method] || { label: method, icon: Receipt });

  const getClosedOrderSummary = () => {
    const totalOrders = closedOrders.length;
    const totalPeople = closedOrders.reduce((sum, o) => sum + (o.people_count || 0), 0);
    const totalRevenue = closedOrders.reduce((sum, o) => sum + o.total, 0);
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Calculate average duration
    const durations = closedOrders
      .filter(o => o.created_at && o.closed_at)
      .map(o => (new Date(o.closed_at).getTime() - new Date(o.created_at).getTime()) / 60000);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    
    return { totalOrders, totalPeople, totalRevenue, avgTicket, avgDuration };
  };

  const filteredKitchenOrders = kitchenFilter === "all" 
    ? kitchenOrders 
    : kitchenOrders.filter(o => o.kitchen_status === kitchenFilter);

  // ── Export to CSV ───────────────────────────────────────────────────────────

  const exportToCSV = () => {
    if (closedOrders.length === 0) {
      toast({ title: "Nenhuma comanda para exportar", variant: "destructive" });
      return;
    }

    const headers = ["Número", "Mesa", "Cliente", "Pessoas", "Data", "Itens", "Subtotal", "Desconto", "Total", "Pagamento"];
    const rows = closedOrders.map(order => {
      const itemsStr = order.items.map(i => `${i.quantity}x ${i.name}`).join("; ");
      return [
        order.order_number,
        order.table_number || "",
        order.customer_name,
        order.people_count || "",
        new Date(order.closed_at).toLocaleString('pt-BR'),
        itemsStr,
        order.subtotal.toFixed(2),
        order.discount.toFixed(2),
        order.total.toFixed(2),
        order.payment_method,
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `comandas_fechadas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "✅ Exportado com sucesso" });
  };

  if (loading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Top Bar */}
      <div className="h-14 bg-white dark:bg-gray-800 border-b border-border flex items-center px-4 flex-shrink-0 gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = "/admin"} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex-1" />
        <h1 className="text-lg font-bold text-primary">{selectedRestaurant?.name || "Salão"}</h1>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setShowManageModal(true)}>
          <SlidersHorizontal className="w-4 h-4 mr-1" />
          Configurar Mesas
        </Button>
        {activeTab === "mesas" && (
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => { setEditingTable(null); setShowTableModal(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            + Abrir Mesa
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-border px-4 flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("mesas")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "mesas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Armchair className="w-4 h-4" />
            Mesas
            <span className="bg-muted px-2 py-0.5 rounded-full text-xs">({tables.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("em_preparo")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "em_preparo"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChefHat className="w-4 h-4" />
            Em Preparo
            <span className="bg-muted px-2 py-0.5 rounded-full text-xs">({kitchenOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("fechadas")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "fechadas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Fechadas
            <span className="bg-muted px-2 py-0.5 rounded-full text-xs">({closedOrders.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "mesas" && (
          <div className="flex h-full">
            {/* LEFT — Tables grid */}
            <div className="w-[38%] bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto border-r border-border flex flex-col gap-3">

          {/* Header + counters */}
          <div className="flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Armchair className="w-4 h-4" />
              Mesas
              <span className="text-xs font-normal text-muted-foreground">({tables.length})</span>
            </h2>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 flex-wrap flex-shrink-0">
            {([
              ["all", "Todas", ""],
              ["free", "Livres", "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"],
              ["occupied", "Ocupadas", "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"],
              ["bill_requested", "Conta pedida", "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"],
              ["reserved", "Reservadas", "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"],
            ] as const).map(([val, label, colorClass]) => {
              const count = val === "all" ? tables.length
                : tables.filter(t => {
                    const r = getReservationForTable(t.id);
                    const ds = r && t.status === "free" ? "reserved" : t.status;
                    return ds === val;
                  }).length;
              return (
                <button
                  key={val}
                  onClick={() => setTableFilter(val)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all
                    ${tableFilter === val
                      ? (val === "all" ? "bg-primary text-primary-foreground border-primary" : `${colorClass} border-current`)
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 bg-white dark:bg-gray-800"
                    }`}
                >
                  {label} {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-2 gap-3">
            {sortedAndFilteredTables.map(({ displayStatus, reservation, ...table }) => {
              const isSelected = selectedTable?.id === table.id;
              const duration = tableOpenedDuration(table.opened_at);
              const tableTotal = table.status === "occupied" && activeOrder?.id === table.current_order_id
                ? activeOrder.total : null;

              // Decide secondary label: is "name" different from "Mesa N"?
              const isNameDistinct = table.name.trim().toLowerCase() !== `mesa ${table.number}`;
              // Detect if it looks like a location (Varanda, Terraço, etc.) or a customer name
              const locationKeywords = ["varanda", "terraço", "terraco", "jardim", "deck", "salão", "salao", "vip", "area", "área", "ext"];
              const isLocation = isNameDistinct && locationKeywords.some(k => table.name.toLowerCase().includes(k));

              return (
                <Card
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`cursor-pointer transition-all relative group border ${tableCardBorderClass(displayStatus, isSelected)}`}
                >
                  <CardContent className="p-3">
                    {/* Edit pencil */}
                    <button
                      title="Editar mesa"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      onClick={e => { e.stopPropagation(); setEditingTable(table); setShowTableModal(true); }}
                    >
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </button>

                    {/* Row 1: status dot + mesa number */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        title={tableStatusLabel(displayStatus)}
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tableStatusColor(displayStatus)} ${displayStatus === "bill_requested" ? "animate-pulse" : ""}`}
                      />
                      <span className="font-bold text-sm">Mesa {table.number}</span>
                    </div>

                    {/* Row 2: secondary identifier */}
                    {isNameDistinct && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                        {isLocation
                          ? <MapPin className="w-3 h-3 flex-shrink-0" />
                          : <UserRound className="w-3 h-3 flex-shrink-0" />}
                        <span className="truncate">{table.name}</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="h-px bg-border mb-2" />

                    {/* Occupancy details */}
                    {displayStatus === "occupied" || displayStatus === "bill_requested" ? (
                      <div className="space-y-1">
                        {(table.people_count ?? null) !== null && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="w-3 h-3 flex-shrink-0" />
                            <span>{table.people_count} {table.people_count === 1 ? "pessoa" : "pessoas"}</span>
                          </div>
                        )}
                        {duration && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Timer className="w-3 h-3 flex-shrink-0" />
                            <span>Aberta há {duration}</span>
                          </div>
                        )}
                        {tableTotal !== null && (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <Banknote className="w-3 h-3 flex-shrink-0" />
                            <span>R$ {tableTotal.toFixed(2)}</span>
                          </div>
                        )}
                        {/* Status badge */}
                        <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tableStatusBadgeClass(displayStatus)}`}>
                          {tableStatusLabel(displayStatus)}
                        </div>
                      </div>
                    ) : displayStatus === "reserved" && reservation ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <UserRound className="w-3 h-3" />
                          <span className="truncate">{reservation.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{reservation.number_of_people} {reservation.number_of_people === 1 ? "pessoa" : "pessoas"}</span>
                        </div>
                        <div className={`mt-1.5 inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${tableStatusBadgeClass("reserved")}`}>
                          🔵 Reservada
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3 h-3 flex-shrink-0" />
                          <span>Até {table.capacity} {table.capacity === 1 ? "pessoa" : "pessoas"}</span>
                        </div>
                        <div className={`mt-1.5 inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${tableStatusBadgeClass("free")}`}>
                          ✅ Livre
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {sortedAndFilteredTables.length === 0 && tables.length > 0 && (
              <div className="col-span-2 text-center text-muted-foreground py-8">
                <p className="text-sm">Nenhuma mesa neste filtro</p>
                <button onClick={() => setTableFilter("all")} className="text-xs text-primary underline mt-1">Ver todas</button>
              </div>
            )}

            {tables.length === 0 && (
              <div className="col-span-2 text-center text-muted-foreground py-12">
                <Armchair className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma mesa cadastrada</p>
                <Button size="sm" className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => { setEditingTable(null); setShowTableModal(true); }}>
                  + Abrir Mesa
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — PDV panel */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="min-w-0">
              {selectedTable ? (
                <>
                  <h2 className="font-bold text-base flex items-center gap-2 truncate">
                    <Armchair className="w-4 h-4 text-primary flex-shrink-0" />
                    Mesa {selectedTable.number}
                    {selectedTable.name.trim().toLowerCase() !== `mesa ${selectedTable.number}` && (
                      <span className="text-muted-foreground font-normal text-sm truncate">· {selectedTable.name}</span>
                    )}
                  </h2>
                  {selectedTable.status === "occupied" || selectedTable.status === "bill_requested" ? (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {selectedTable.people_count && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {selectedTable.people_count} {selectedTable.people_count === 1 ? "pessoa" : "pessoas"}
                        </span>
                      )}
                      {tableOpenedDuration(selectedTable.opened_at) && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          Aberta há {tableOpenedDuration(selectedTable.opened_at)}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tableStatusBadgeClass(selectedTable.status)}`}>
                        {tableStatusLabel(selectedTable.status)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Selecione itens para adicionar ao pedido</p>
                  )}
                </>
              ) : (
                <h2 className="font-bold text-base text-muted-foreground flex items-center gap-2">
                  <Armchair className="w-4 h-4" />
                  Selecione uma mesa
                </h2>
              )}
            </div>

            {(selectedTable?.status === "occupied" || selectedTable?.status === "bill_requested") && activeOrder && (
              <div className="flex gap-2 flex-shrink-0 ml-3">
                <Button size="sm" variant="outline"
                  title="Solicitar a conta para o cliente"
                  onClick={() => supabase.from("pdv_tables" as any).update({ status: "bill_requested" }).eq("id", selectedTable.id)
                    .then(({ error }) => {
                      if (!error) {
                        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: "bill_requested" } : t));
                        setSelectedTable(prev => prev ? { ...prev, status: "bill_requested" } : prev);
                        toast({ title: "💵 Conta solicitada" });
                      }
                    })}>
                  <Receipt className="w-4 h-4 mr-1" />
                  Solicitar Conta
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  title="Finalizar o atendimento e liberar a mesa"
                  onClick={() => setShowCloseComandaModal(true)}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Finalizar Mesa
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
                  title="Cancelar e liberar a mesa sem cobrar"
                  onClick={handleCancelTable}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Comanda summary (items already sent to kitchen) */}
          {activeOrder && activeOrder.items.length > 0 && (
            <div className="px-4 py-3 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5" />
                  📋 Comanda atual
                </p>
                <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                  {activeOrder.items.reduce((s, i) => s + i.quantity, 0)} itens · R$ {activeOrder.total.toFixed(2)}
                </span>
              </div>
              <div className="space-y-0.5">
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-orange-800 dark:text-orange-200">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-orange-600 dark:text-orange-400 w-5 text-right flex-shrink-0">[{item.quantity}x]</span>
                      <span>{item.name}</span>
                    </span>
                    <span className="text-orange-600 dark:text-orange-400 flex-shrink-0 ml-2">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search + categories */}
          {selectedTable && (
            <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Buscar produtos..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button size="sm" variant={selectedCategory === "all" ? "default" : "outline"}
                  onClick={() => setSelectedCategory("all")} className="whitespace-nowrap h-8">Todos</Button>
                {categories.map(c => (
                  <Button key={c.id} size="sm"
                    variant={selectedCategory === c.id ? "default" : "outline"}
                    onClick={() => setSelectedCategory(c.id)} className="whitespace-nowrap h-8">{c.name}</Button>
                ))}
              </div>
            </div>
          )}

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedTable ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Armchair className="w-14 h-14 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Clique em uma mesa para começar</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(product => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => addToCart(product)}>
                    <CardContent className="p-3">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center aspect-square overflow-hidden">
                        {product.image_url
                          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          : <Utensils className="text-muted-foreground w-7 h-7" />}
                      </div>
                      <p className="font-medium text-xs line-clamp-2 mb-0.5">{product.name}</p>
                      <p className="text-primary font-bold text-xs">R$ {product.price.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Cart footer */}
          {selectedTable && (
            <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-gray-50 dark:bg-gray-900 space-y-3">
              {/* Cart items */}
              {cart.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-sm flex-1 truncate">{item.product.name}</span>
                      <span className="text-xs text-muted-foreground">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Subtotal + send button */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm min-w-0">
                  {cart.length > 0 ? (
                    <>
                      <span className="text-muted-foreground">Novos itens: </span>
                      <span className="font-bold">R$ {cartSubtotal.toFixed(2)}</span>
                      {activeOrder && (
                        <span className="text-muted-foreground text-xs block">
                          total comanda: R$ {(activeOrder.total + cartSubtotal).toFixed(2)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {activeOrder
                        ? `Comanda: R$ ${activeOrder.total.toFixed(2)}`
                        : "Adicione itens ao pedido"}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {cart.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setCart([])} title="Limpar seleção">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5"
                    onClick={handleSendToKitchen}
                    disabled={cart.length === 0 || sendingToKitchen}
                  >
                    {sendingToKitchen
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                      : <><ChefHat className="w-4 h-4 mr-1.5" />Enviar para Cozinha</>}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
        )}

        {/* EM PREPARO TAB */}
        {activeTab === "em_preparo" && (
          <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  Pedidos em Preparo
                </h2>
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {([
                  ["all", "Todas", kitchenOrders.length],
                  ["pending", "⏱️ Aguardando", kitchenOrders.filter(o => o.kitchen_status === "pending").length],
                  ["preparing", "🔥 Preparando", kitchenOrders.filter(o => o.kitchen_status === "preparing").length],
                  ["ready", "✅ Pronto", kitchenOrders.filter(o => o.kitchen_status === "ready").length],
                ] as const).map(([val, label, count]) => (
                  <button
                    key={val}
                    onClick={() => setKitchenFilter(val as any)}
                    className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                      kitchenFilter === val
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/50 bg-white dark:bg-gray-800"
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>

              {/* Orders grid */}
              {loadingKitchen ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredKitchenOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum pedido em preparo</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredKitchenOrders.map(order => {
                    const statusInfo = kitchenStatusLabel(order.kitchen_status);
                    const timeColor = getKitchenTimeColor(order.sent_to_kitchen_at);
                    const timeLabel = getKitchenTimeLabel(order.sent_to_kitchen_at);
                    
                    return (
                      <Card key={order.id} className="border hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-sm">Mesa {order.table_number || "?"}</span>
                                <span className="text-xs text-muted-foreground">• {order.customer_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">#{order.order_number}</div>
                            </div>
                            <span className={`text-xs font-medium ${timeColor}`}>{timeLabel}</span>
                          </div>

                          {/* Divider */}
                          <div className="h-px bg-border mb-3" />

                          {/* Items */}
                          <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>{item.quantity}x {item.name}</span>
                              </div>
                            ))}
                          </div>

                          {/* Divider */}
                          <div className="h-px bg-border mb-3" />

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            <div className="flex gap-2">
                              {order.kitchen_status !== "ready" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => handleMarkAsReady(order.id)}
                                >
                                  Marcar Pronto
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setActiveTab("mesas");
                                  const table = tables.find(t => t.id === order.table_id);
                                  if (table) handleTableClick(table);
                                }}
                              >
                                Ver Mesa
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FECHADAS TAB */}
        {activeTab === "fechadas" && (
          <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto flex">
            <div className="flex-1 max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Comandas Fechadas
                </h2>
                <Button size="sm" variant="outline" onClick={exportToCSV} disabled={closedOrders.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {([
                  ["today", "Hoje"],
                  ["yesterday", "Ontem"],
                  ["week", "Esta semana"],
                  ["custom", "Personalizado"],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setClosedOrdersFilter(val)}
                    className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                      closedOrdersFilter === val
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/50 bg-white dark:bg-gray-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Summary */}
              {closedOrders.length > 0 && !loadingClosed && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    📊 Resumo do Período
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Comandas</div>
                      <div className="font-bold text-lg">{getClosedOrderSummary().totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Pessoas</div>
                      <div className="font-bold text-lg">{getClosedOrderSummary().totalPeople}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Faturamento</div>
                      <div className="font-bold text-lg text-primary">R$ {getClosedOrderSummary().totalRevenue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ticket Médio</div>
                      <div className="font-bold text-lg">R$ {getClosedOrderSummary().avgTicket.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              {loadingClosed ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : closedOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma comanda fechada neste período</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Hora</th>
                        <th className="px-4 py-3 text-left font-medium">Mesa</th>
                        <th className="px-4 py-3 text-left font-medium">Cliente</th>
                        <th className="px-4 py-3 text-left font-medium">Pessoas</th>
                        <th className="px-4 py-3 text-left font-medium">Itens</th>
                        <th className="px-4 py-3 text-left font-medium">Total</th>
                        <th className="px-4 py-3 text-left font-medium">Pagto</th>
                        <th className="px-4 py-3 text-center font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedOrders.map(order => {
                        const paymentInfo = paymentMethodLabel(order.payment_method);
                        const time = new Date(order.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                        
                        return (
                          <tr key={order.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedClosedOrder(order)}>
                            <td className="px-4 py-3">{time}</td>
                            <td className="px-4 py-3 font-medium">Mesa {order.table_number || "?"}</td>
                            <td className="px-4 py-3">{order.customer_name}</td>
                            <td className="px-4 py-3">{order.people_count || "-"}</td>
                            <td className="px-4 py-3">{itemCount}</td>
                            <td className="px-4 py-3 font-semibold">R$ {order.total.toFixed(2)}</td>
                            <td className="px-4 py-3 flex items-center gap-1">
                              <paymentInfo.icon className="w-4 h-4" />
                              {paymentInfo.label}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sidebar for closed order details */}
            {selectedClosedOrder && (
              <div className="w-96 bg-white dark:bg-gray-800 border-l border-border p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Detalhes da Comanda</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedClosedOrder(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Order info */}
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">#{selectedClosedOrder.order_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedClosedOrder.closed_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Mesa:</span>
                      <span className="font-medium">Mesa {selectedClosedOrder.table_number || "?"}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium">{selectedClosedOrder.customer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pessoas:</span>
                      <span className="font-medium">{selectedClosedOrder.people_count || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Itens</h4>
                  <div className="space-y-2">
                    {selectedClosedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>R$ {selectedClosedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedClosedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Desconto:</span>
                      <span>-R$ {selectedClosedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">R$ {selectedClosedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment info */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    {(() => {
                      const paymentInfo = paymentMethodLabel(selectedClosedOrder.payment_method);
                      return <><paymentInfo.icon className="w-4 h-4" /> {paymentInfo.label}</>;
                    })()}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button size="sm" variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>{/* end tab content */}

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* Confirm dialogs (replaces window.confirm) */}
      {ConfirmDialogNode}

      {/* Open table modal */}
      <OpenTableModal
        open={showOpenTableModal}
        table={pendingOpenTable}
        onConfirm={handleOpenTable}
        onCancel={() => { setShowOpenTableModal(false); setPendingOpenTable(null); }}
      />

      {/* Close comanda modal */}
      {showCloseComandaModal && activeOrder && selectedTable && (
        <CloseComandaModal
          open={showCloseComandaModal}
          order={activeOrder}
          table={selectedTable}
          onClose={handleCloseComanda}
          onCancel={() => setShowCloseComandaModal(false)}
        />
      )}

      {/* Create/edit table modal */}
      <Dialog open={showTableModal} onOpenChange={setShowTableModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Editar Mesa" : "Nova Mesa"}</DialogTitle>
          </DialogHeader>
          <TableForm
            table={editingTable}
            onSave={handleSaveTable}
            onDelete={editingTable ? handleDeleteTable : undefined}
            onCancel={() => { setShowTableModal(false); setEditingTable(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Manage modal (reservations + settings) */}
      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerenciar Mesas e Reservas</DialogTitle></DialogHeader>
          <ManageModal
            tables={tables}
            reservations={reservations}
            restaurantId={ctxRestaurantId}
            onRefresh={fetchData}
            onEditTable={table => { setEditingTable(table); setShowManageModal(false); setShowTableModal(true); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── OpenTableModal ──────────────────────────────────────────────────────────

function OpenTableModal({ open, table, onConfirm, onCancel }: {
  open: boolean; table: Table | null;
  onConfirm: (people: number) => void; onCancel: () => void;
}) {
  const [people, setPeople] = useState(table?.capacity ?? 2);
  useEffect(() => { if (table) setPeople(table.people_count ?? table.capacity ?? 2); }, [table]);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir {table?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Número de pessoas</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setPeople(p => Math.max(1, p - 1))}><Minus className="w-4 h-4" /></Button>
              <span className="text-2xl font-bold w-10 text-center">{people}</span>
              <Button variant="outline" size="icon" onClick={() => setPeople(p => p + 1)}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => onConfirm(people)}>
            Abrir Mesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CloseComandaModal ────────────────────────────────────────────────────────

function CloseComandaModal({ open, order, table, onClose, onCancel }: {
  open: boolean; order: ActiveOrder; table: Table;
  onClose: (method: PaymentType, discount: number) => void;
  onCancel: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentType>("cash");
  const [discount, setDiscount] = useState("0");
  const [splits, setSplits] = useState(1);
  const discountVal = parseFloat(discount) || 0;
  const finalTotal = Math.max(0, order.subtotal - discountVal);
  const perPerson = splits > 1 ? finalTotal / splits : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Mesa — {table.name}</DialogTitle>
        </DialogHeader>
        {/* Items summary */}
        <div className="rounded-lg border border-border p-3 space-y-1 max-h-48 overflow-y-auto">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.name}</span>
              <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {/* Discount */}
          <div className="flex items-center gap-3">
            <Label className="w-24 flex-shrink-0">Desconto (R$)</Label>
            <Input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} className="w-28" />
          </div>
          {/* Totals */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>R$ {order.subtotal.toFixed(2)}</span></div>
            {discountVal > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-R$ {discountVal.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">R$ {finalTotal.toFixed(2)}</span></div>
          </div>
          {/* Split */}
          {(order.people_count ?? 1) > 1 && (
            <div className="flex items-center gap-3">
              <Label className="w-24 flex-shrink-0">Dividir em</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSplits(s => Math.max(1, s - 1))}><Minus className="w-3 h-3" /></Button>
                <span className="font-bold w-8 text-center">{splits}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSplits(s => s + 1)}><Plus className="w-3 h-3" /></Button>
                <span className="text-sm text-muted-foreground">partes</span>
              </div>
              {perPerson && <span className="text-sm font-semibold text-primary">= R$ {perPerson.toFixed(2)}/pessoa</span>}
            </div>
          )}
          {/* Payment method */}
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {([["cash","Dinheiro",<DollarSign className="w-4 h-4"/>],["card","Cartão",<CreditCard className="w-4 h-4"/>],
                ["pix","PIX",<Smartphone className="w-4 h-4"/>],["mixed","Misto",<Receipt className="w-4 h-4"/>]] as const).map(([val, label, icon]) => (
                <button key={val} type="button"
                  onClick={() => setPaymentMethod(val as PaymentType)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all
                    ${paymentMethod === val ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground/40"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={() => onClose(paymentMethod, discountVal)}>
            <Printer className="w-4 h-4" />
            Confirmar e Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── TableForm ────────────────────────────────────────────────────────────────

function TableForm({ table, onSave, onDelete, onCancel }: {
  table: Table | null;
  onSave: (data: any) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(table?.name || "");
  const [number, setNumber] = useState(table?.number || 1);
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [status, setStatus] = useState(table?.status || "free");
  const [notes, setNotes] = useState(table?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), number: Number(number), capacity: Number(capacity), status, notes }); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome/Identificação *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mesa 1, Varanda A..." required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número *</Label>
          <Input type="number" value={number} onChange={e => setNumber(parseInt(e.target.value))} required />
        </div>
        <div className="space-y-2">
          <Label>Capacidade *</Label>
          <Input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value))} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Livre</SelectItem>
            <SelectItem value="reserved">Reservada</SelectItem>
            <SelectItem value="occupied">Ocupada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mesa para cadeirante, etc." rows={2} />
      </div>
      <DialogFooter>
        {onDelete && <Button type="button" variant="destructive" onClick={onDelete}>Excluir</Button>}
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
          {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Salvando...</> : "Salvar Mesa"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── ManageModal (reservations + table settings) ──────────────────────────────

function ManageModal({ tables, reservations, restaurantId, onRefresh, onEditTable }: {
  tables: Table[]; reservations: Reservation[];
  restaurantId: string | undefined;
  onRefresh: () => void;
  onEditTable: (t: Table) => void;
}) {
  const [tab, setTab] = useState<"reservations" | "settings">("reservations");
  const [showNewRes, setShowNewRes] = useState(false);
  const { toast } = useToast();

  const handleCreateReservation = async (data: any) => {
    if (!restaurantId) return;
    const { error } = await supabase.from("table_reservations" as any)
      .insert({ restaurant_id: restaurantId, ...data, status: "confirmed" });
    if (error) { toast({ title: "Erro ao criar reserva", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reserva criada" });
    setShowNewRes(false);
    onRefresh();
  };

  const handleCancelReservation = async (id: string) => {
    const { error } = await supabase.from("table_reservations" as any).update({ status: "cancelled" }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reserva cancelada" });
    onRefresh();
  };

  return (
    <Tabs value={tab} onValueChange={v => setTab(v as any)} className="mt-2">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="reservations">Reservas</TabsTrigger>
        <TabsTrigger value="settings">Mesas</TabsTrigger>
      </TabsList>
      <TabsContent value="reservations" className="mt-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Reservas do Dia</h3>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowNewRes(true)}>
            <Plus className="w-4 h-4 mr-1" />Nova Reserva
          </Button>
        </div>
        {showNewRes && (
          <ReservationForm tables={tables} onSave={handleCreateReservation} onCancel={() => setShowNewRes(false)} />
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {reservations.filter(r => r.status !== "cancelled").map(r => {
            const t = tables.find(t => t.id === r.table_id);
            return (
              <div key={r.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{r.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t?.name} · {r.reservation_date} às {r.reservation_time} · {r.number_of_people} pessoas
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleCancelReservation(r.id)}>Cancelar</Button>
              </div>
            );
          })}
          {reservations.filter(r => r.status !== "cancelled").length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma reserva para hoje</p>
          )}
        </div>
      </TabsContent>
      <TabsContent value="settings" className="mt-4 space-y-2 max-h-80 overflow-y-auto">
        {tables.map(t => (
          <div key={t.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                t.status === "free" ? "bg-green-500" : t.status === "occupied" ? "bg-red-500" : "bg-amber-400"
              }`} />
              <div>
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">Mesa {t.number} · {t.capacity} lugares</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onEditTable(t)}>
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {tables.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma mesa cadastrada</p>}
      </TabsContent>
    </Tabs>
  );
}

// ─── ReservationForm ──────────────────────────────────────────────────────────

function ReservationForm({ tables, onSave, onCancel }: {
  tables: Table[]; onSave: (data: any) => void; onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableId, setTableId] = useState("");
  const [reservationDate, setReservationDate] = useState(new Date().toISOString().split("T")[0]);
  const [reservationTime, setReservationTime] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [notes, setNotes] = useState("");

  const formatPhone = (v: string) => {
    const c = v.replace(/\D/g, "");
    if (c.length <= 2) return c.length ? `(${c}` : "";
    if (c.length <= 7) return `(${c.slice(0, 2)}) ${c.slice(2)}`;
    return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7, 11)}`;
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ customer_name: customerName, customer_phone: customerPhone, table_id: tableId, reservation_date: reservationDate, reservation_time: reservationTime, number_of_people: numberOfPeople, notes }); }}
      className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome do cliente *</Label>
          <Input value={customerName} onChange={e => setCustomerName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone</Label>
          <Input value={customerPhone} onChange={e => setCustomerPhone(formatPhone(e.target.value))} placeholder="(DD) 9 9999-9999" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Mesa *</Label>
          <Select value={tableId} onValueChange={setTableId} required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{tables.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pessoas *</Label>
          <Input type="number" value={numberOfPeople} onChange={e => setNumberOfPeople(parseInt(e.target.value))} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data *</Label>
          <Input type="date" value={reservationDate} onChange={e => setReservationDate(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Horário *</Label>
          <Input type="time" value={reservationTime} onChange={e => setReservationTime(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Confirmar</Button>
      </div>
    </form>
  );
}
