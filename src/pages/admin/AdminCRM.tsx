import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  Clock,
  Filter,
  UserX,
  AlertTriangle,
  MessageCircle,
  Send,
  Copy,
  Check,
  CheckSquare,
  Square,
  TrendingUp,
  Crown,
  CalendarDays,
  ArrowUpDown,
  Star,
  UtensilsCrossed,
  DollarSign,
  Heart,
  Phone,
  ShoppingBag,
  X,
  Download,
  Upload,
  UserPlus,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import BulkWhatsappSender from "@/components/crm/BulkWhatsappSender";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { ScrollArea } from "@/components/ui/scroll-area";

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

type FilterOption =
  | "all"
  | "first_purchase"
  | "last_week"
  | "last_15"
  | "last_30"
  | "last_60"
  | "last_90"
  | "inactive";

type SortOption = "recent" | "loyal" | "top_revenue";

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

export default function AdminCRM() {
  const { selectedRestaurantIds, selectedRestaurant, restaurants } = useRestaurantContext();
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailProductImage, setDetailProductImage] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<OrderHistory[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  // CSV Export
  const handleExportCsv = () => {
    if (customers.length === 0) {
      toast({ title: "Nenhum cliente para exportar", variant: "destructive" });
      return;
    }
    const header = "Nome,Telefone,Total Pedidos,Total Gasto,Último Pedido,Produto Favorito\n";
    const rows = customers.map((c) =>
      `"${c.name}","${c.phone}",${c.totalOrders},${c.totalSpent.toFixed(2)},"${format(new Date(c.lastOrder), "dd/MM/yyyy", { locale: ptBR })}","${c.favoriteProduct || ""}"`
    ).join("\n");
    const csv = header + rows;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "✅ CSV exportado com sucesso!" });
  };

  // CSV Import
  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;
    setImportingCsv(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      
      // Detect header
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("nome") || firstLine.includes("name") || firstLine.includes("telefone") || firstLine.includes("phone");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const parsed: { name: string; phone: string }[] = [];
      for (const line of dataLines) {
        // Handle CSV with quotes
        const match = line.match(/(?:"([^"]*)")|([^,;]+)/g);
        if (!match || match.length < 2) continue;
        const cleanField = (f: string) => f.replace(/^["']|["']$/g, "").trim();
        const name = cleanField(match[0]);
        const phone = cleanField(match[1]).replace(/\D/g, "");
        if (name.length >= 2 && phone.length >= 10 && phone.length <= 11) {
          parsed.push({ name, phone });
        }
      }

      if (parsed.length === 0) {
        toast({ title: "Nenhum cliente válido encontrado no CSV", description: "Formato esperado: Nome, Telefone", variant: "destructive" });
        setImportingCsv(false);
        return;
      }

      // Batch upsert via RPC or direct insert
      let imported = 0;
      for (const c of parsed) {
        const { error } = await supabase
          .from("customers")
          .upsert(
            { restaurant_id: restaurantId, name: c.name, phone: c.phone },
            { onConflict: "restaurant_id,phone" }
          );
        if (!error) imported++;
      }

      toast({ title: `✅ ${imported} clientes importados!`, description: `${parsed.length - imported} duplicados ou erros` });
      
      // Refresh customers
      window.location.reload();
    } catch (err) {
      console.error("Import error:", err);
      toast({ title: "Erro ao importar CSV", variant: "destructive" });
    } finally {
      setImportingCsv(false);
      e.target.value = "";
    }
  };
  const restaurantName = selectedRestaurant?.name || restaurants[0]?.name || "";

  const handleAddCustomer = async () => {
    if (!restaurantId) {
      toast({ title: "Selecione um restaurante", variant: "destructive" });
      return;
    }
    const trimmedName = newCustomerName.trim();
    const cleanPhone = newCustomerPhone.replace(/\D/g, "");
    if (trimmedName.length < 2) {
      toast({ title: "Nome deve ter pelo menos 2 caracteres", variant: "destructive" });
      return;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      toast({ title: "Telefone inválido (10 ou 11 dígitos)", variant: "destructive" });
      return;
    }
    setSavingCustomer(true);
    try {
      const { error } = await supabase
        .from("customers")
        .upsert(
          { restaurant_id: restaurantId, name: trimmedName, phone: cleanPhone },
          { onConflict: "restaurant_id,phone" }
        );
      if (error) throw error;
      toast({ title: "✅ Cliente cadastrado com sucesso!" });
      setNewCustomerOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      // Refresh
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, total_orders, total_spent, last_order_at, created_at, favorite_product")
        .eq("restaurant_id", restaurantId)
        .order("last_order_at", { ascending: false, nullsFirst: false });
      if (data) {
        setCustomers(data.map((c: any) => ({
          id: c.id, name: c.name, phone: c.phone,
          lastOrder: c.last_order_at || c.created_at, firstOrder: c.created_at,
          totalOrders: c.total_orders, totalSpent: Number(c.total_spent),
          daysInactive: differenceInDays(new Date(), new Date(c.last_order_at || c.created_at)),
          favoriteProduct: c.favorite_product || null,
        })));
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao cadastrar cliente", variant: "destructive" });
    } finally {
      setSavingCustomer(false);
    }
  };

  const filterLabels: Record<FilterOption, string> = {
    all: "Todos os clientes",
    first_purchase: "Primeira compra",
    last_week: "Última semana",
    last_15: "Últimos 15 dias",
    last_30: "Últimos 30 dias",
    last_60: "Últimos 60 dias",
    last_90: "Últimos 90 dias",
    inactive: "Inativos (+90 dias)",
  };

  const sortLabels: Record<SortOption, string> = {
    recent: "Mais recentes",
    loyal: "Clientes Fiéis",
    top_revenue: "Top faturamento",
  };

  // Mensagens personalizadas por estágio do cliente
  const getMessageTemplate = (customer: Customer): string => {
    const firstName = customer.name.split(" ")[0];
    const days = customer.daysInactive;

    if (days <= 7) {
      return `Olá ${firstName}! 🌟\n\nObrigado por ser um cliente especial do ${restaurantName || "nosso restaurante"}!\n\nNotamos que você esteve conosco recentemente e queremos agradecer sua preferência.\n\nComo cliente VIP, preparamos uma surpresa para você no próximo pedido! 🎁\n\nPeça agora e aproveite!`;
    }
    if (days <= 15) {
      return `Oi ${firstName}! 😊\n\nQue bom ter você como cliente do ${restaurantName || "nosso restaurante"}!\n\nJá faz ${days} dias desde seu último pedido. Estamos com saudades!\n\nQue tal repetir aquele pedido delicioso? 🍔\n\nEsperamos você!`;
    }
    if (days <= 30) {
      return `Olá ${firstName}! 👋\n\nSentimos sua falta no ${restaurantName || "nosso restaurante"}!\n\nFaz ${days} dias que não nos vemos...\n\nTemos novidades no cardápio esperando por você! Venha conferir! 🆕\n\nFaça seu pedido agora!`;
    }
    if (days <= 60) {
      return `Oi ${firstName}! 💛\n\nJá faz ${days} dias desde sua última visita ao ${restaurantName || "nosso restaurante"}.\n\nSentimos muito sua falta! Para celebrar seu retorno, preparamos uma condição especial só para você! 🎉\n\nNão perca essa oportunidade!\n\nEsperamos seu pedido! 😊`;
    }
    if (days <= 90) {
      return `Olá ${firstName}! 🙏\n\nPercebemos que faz ${days} dias que você não pede no ${restaurantName || "nosso restaurante"}.\n\nQueremos muito te ver de volta! Por isso, estamos oferecendo um desconto exclusivo no seu próximo pedido! 🏷️\n\nVolte a fazer parte da nossa família!\n\nTe esperamos!`;
    }
    return `Oi ${firstName}! ❤️\n\nFaz tempo que não nos falamos... ${days} dias para ser exato!\n\nO ${restaurantName || "nosso restaurante"} sente muito a sua falta!\n\nQueremos reconquistar você! Por isso, preparamos uma oferta imperdível exclusiva para o seu retorno! 🔥\n\nResponda essa mensagem e ganhe um brinde especial no pedido!\n\nEsperamos ansiosamente seu retorno! 😊`;
  };

  const getCustomerStage = (days: number): string => {
    if (days <= 7) return "VIP";
    if (days <= 15) return "Ativo";
    if (days <= 30) return "Regular";
    if (days <= 60) return "Em Risco";
    if (days <= 90) return "Quase Inativo";
    return "Inativo";
  };

  const openCustomerDetail = async (customer: Customer) => {
    setDetailCustomer(customer);
    setDetailProductImage(null);
    setCustomerOrders([]);
    setDetailLoading(true);

    const cleanPhone = customer.phone.replace(/\D/g, "");
    const restIds = restaurantId ? [restaurantId] : selectedRestaurantIds;

    try {
      // Fetch product image + orders in parallel
      const [productRes, ordersRes] = await Promise.all([
        customer.favoriteProduct && restaurantId
          ? supabase
              .from("products")
              .select("image_url")
              .eq("restaurant_id", restaurantId)
              .ilike("name", customer.favoriteProduct)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("orders")
          .select("id, order_number, created_at, items, subtotal, discount, delivery_fee, total, delivery_type, payment_method, status, notes")
          .in("restaurant_id", restIds)
          .or(`customer_phone.eq.${cleanPhone},customer_phone.eq.${customer.phone}`)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (productRes.data?.image_url) {
        setDetailProductImage(productRes.data.image_url);
      }

      setCustomerOrders((ordersRes.data || []) as OrderHistory[]);
    } catch (err) {
      console.error("Error fetching customer detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };
  const openWhatsappDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomMessage(getMessageTemplate(customer));
    setWhatsappDialogOpen(true);
    setCopiedMessage(false);
  };

  const formatPhoneForWhatsapp = (phone: string): string => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11 || numbers.length === 10) {
      return `55${numbers}`;
    }
    return numbers;
  };

  const sendWhatsapp = () => {
    if (!selectedCustomer) return;
    const phone = formatPhoneForWhatsapp(selectedCustomer.phone);
    const encodedMessage = encodeURIComponent(customMessage);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, "_blank");
    setWhatsappDialogOpen(false);
    toast({ title: "WhatsApp aberto!", description: `Mensagem preparada para ${selectedCustomer.name}` });
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(customMessage);
    setCopiedMessage(true);
    toast({ title: "Mensagem copiada!", description: "Cole no WhatsApp para enviar" });
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  useEffect(() => {
    if (selectedRestaurantIds.length === 0) return;

    async function fetchCustomers() {
      setLoading(true);
      let query = supabase
        .from("customers")
        .select("id, name, phone, total_orders, total_spent, last_order_at, created_at, favorite_product")
        .order("last_order_at", { ascending: false, nullsFirst: false });

      if (selectedRestaurantIds.length === 1) {
        query = query.eq("restaurant_id", selectedRestaurantIds[0]);
      } else {
        query = query.in("restaurant_id", selectedRestaurantIds);
      }

      const { data: customersData, error } = await query;
      if (error || !customersData) { setLoading(false); return; }

      const customersArray: Customer[] = customersData.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        lastOrder: c.last_order_at || c.created_at,
        firstOrder: c.created_at,
        totalOrders: c.total_orders,
        totalSpent: Number(c.total_spent),
        daysInactive: differenceInDays(new Date(), new Date(c.last_order_at || c.created_at)),
        favoriteProduct: c.favorite_product || null,
      }));

      setCustomers(customersArray);
      setLoading(false);
    }
    fetchCustomers();
  }, [selectedRestaurantIds.join(",")]);

  const filteredCustomers = useMemo(() => {
    const now = new Date();
    const filtered = customers.filter((customer) => {
      const daysSinceOrder = differenceInDays(now, new Date(customer.lastOrder));
      if (filter === "first_purchase") return customer.totalOrders === 1;
      const isFirstPurchase = customer.totalOrders === 1;
      switch (filter) {
        case "last_week": return !isFirstPurchase && daysSinceOrder <= 7;
        case "last_15": return !isFirstPurchase && daysSinceOrder > 7 && daysSinceOrder <= 15;
        case "last_30": return !isFirstPurchase && daysSinceOrder > 15 && daysSinceOrder <= 30;
        case "last_60": return !isFirstPurchase && daysSinceOrder > 30 && daysSinceOrder <= 60;
        case "last_90": return !isFirstPurchase && daysSinceOrder > 60 && daysSinceOrder <= 90;
        case "inactive": return !isFirstPurchase && daysSinceOrder > 90;
        default: return true;
      }
    });

    // Apply sorting
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "loyal":
          return b.totalOrders - a.totalOrders;
        case "top_revenue":
          return b.totalSpent - a.totalSpent;
        case "recent":
        default:
          return new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime();
      }
    });
  }, [customers, filter, sortBy]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeCustomers = customers.filter((c) => differenceInDays(now, new Date(c.lastOrder)) <= 90);
    const inactiveCustomers = customers.filter((c) => differenceInDays(now, new Date(c.lastOrder)) > 90);
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgTicket = customers.length > 0 ? totalRevenue / customers.reduce((sum, c) => sum + c.totalOrders, 0) : 0;

    return {
      totalCustomers: customers.length,
      activeCustomers: activeCustomers.length,
      inactiveCustomers: inactiveCustomers.length,
      totalRevenue,
      avgTicket,
    };
  }, [customers]);

  const getStatusBadge = (daysInactive: number) => {
    if (daysInactive > 90) return <Badge variant="destructive" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Inativo</Badge>;
    if (daysInactive > 60) return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Em risco</Badge>;
    if (daysInactive > 30) return <Badge variant="outline" className="text-xs">Regular</Badge>;
    return <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Ativo</Badge>;
  };

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setNewCustomerOpen(true)} disabled={!restaurantId}>
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Cliente</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv} disabled={loading || customers.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <label>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={importingCsv || !restaurantId} asChild>
              <span>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">{importingCsv ? "Importando..." : "Importar"}</span>
              </span>
            </Button>
            <Input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCsv} disabled={importingCsv || !restaurantId} />
          </label>
        </div>
      </div>

      {/* Stats Cards - Modern Dashboard Style */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10">
          <div className="absolute top-3 right-3 p-2.5 rounded-xl bg-blue-500/15 dark:bg-blue-500/25">
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Base Total
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalCustomers}</div>
                <p className="text-xs text-muted-foreground mt-1">Clientes únicos</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10">
          <div className="absolute top-3 right-3 p-2.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/25">
            <UserCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.activeCustomers}</div>
                <p className="text-xs text-muted-foreground mt-1">Últimos 90 dias</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10">
          <div className="absolute top-3 right-3 p-2.5 rounded-xl bg-red-500/15 dark:bg-red-500/25">
            <UserX className="h-5 w-5 text-red-500" />
          </div>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Inativos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.inactiveCustomers}</div>
                <p className="text-xs text-muted-foreground mt-1">+90 dias sem pedir</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10">
          <div className="absolute top-3 right-3 p-2.5 rounded-xl bg-amber-500/15 dark:bg-amber-500/25">
            <DollarSign className="h-5 w-5 text-amber-500" />
          </div>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10">
          <div className="absolute top-3 right-3 p-2.5 rounded-xl bg-purple-500/15 dark:bg-purple-500/25">
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  R$ {stats.avgTicket.toFixed(2).replace(".", ",")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Por pedido</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period Filter + Sort */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtrar por Período
            </CardTitle>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ordenar:</span>
              {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                <Button
                  key={key}
                  variant={sortBy === key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSortBy(key)}
                  className={`text-xs h-7 ${sortBy === key ? "" : ""}`}
                >
                  {key === "loyal" && <Heart className="w-3 h-3 mr-1" />}
                  {key === "top_revenue" && <Crown className="w-3 h-3 mr-1" />}
                  {sortLabels[key]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(filterLabels) as FilterOption[]).map((key) => (
              <Button
                key={key}
                variant={filter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? key === "inactive" ? "bg-red-500 hover:bg-red-600" : ""
                    : key === "inactive" ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950" : ""
                }
              >
                {filterLabels[key]}
                {!loading && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({key === "all" ? customers.length :
                      key === "first_purchase" ? customers.filter(c => c.totalOrders === 1).length :
                      key === "inactive" ? customers.filter(c => c.totalOrders > 1 && c.daysInactive > 90).length :
                      customers.filter(c => {
                        if (c.totalOrders === 1) return false;
                        const days = c.daysInactive;
                        if (key === "last_week") return days <= 7;
                        if (key === "last_15") return days > 7 && days <= 15;
                        if (key === "last_30") return days > 15 && days <= 30;
                        if (key === "last_60") return days > 30 && days <= 60;
                        if (key === "last_90") return days > 60 && days <= 90;
                        return true;
                      }).length
                    })
                  </span>
                )}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground border-t pt-4">
            Exibindo: <span className="font-medium text-foreground">{filterLabels[filter]}</span>
            {" "}— <span className="font-medium">{filteredCustomers.length}</span> cliente{filteredCustomers.length !== 1 ? "s" : ""}
            {" "}| Ordenado por: <span className="font-medium text-foreground">{sortLabels[sortBy]}</span>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clientes</CardTitle>
          {filteredCustomers.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedCustomers.size === filteredCustomers.length) {
                    setSelectedCustomers(new Set());
                  } else {
                    setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
                  }
                }}
                className="gap-2"
              >
                {selectedCustomers.size === filteredCustomers.length ? (
                  <><Square className="h-4 w-4" />Desmarcar todos</>
                ) : (
                  <><CheckSquare className="h-4 w-4" />Selecionar todos</>
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3 pb-20">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum cliente encontrado neste período</p>
                </div>
              ) : (
                filteredCustomers.map((customer, index) => {
                  const isSelected = selectedCustomers.has(customer.id);
                  return (
                    <div
                      key={customer.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-lg border transition-colors cursor-pointer hover:border-primary/40 ${
                        isSelected ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                      }`}
                      onClick={() => openCustomerDetail(customer)}
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        <div onClick={(e) => e.stopPropagation()} className="pt-0.5 sm:pt-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedCustomers);
                              if (checked) newSelected.add(customer.id);
                              else newSelected.delete(customer.id);
                              setSelectedCustomers(newSelected);
                            }}
                            className="h-5 w-5"
                          />
                        </div>

                        {/* Ranking badge for top_revenue or loyal sort */}
                        {(sortBy === "top_revenue" || sortBy === "loyal") && index < 3 && (
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm font-bold ${
                            index === 0 ? "bg-amber-500/20 text-amber-500" :
                            index === 1 ? "bg-gray-400/20 text-gray-400" :
                            "bg-orange-700/20 text-orange-600"
                          }`}>
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm sm:text-base">{customer.name}</h3>
                            {customer.totalOrders === 1 && (
                              <Badge className="text-xs bg-blue-500 hover:bg-blue-600">✨ Novo</Badge>
                            )}
                            {getStatusBadge(customer.daysInactive)}
                          </div>
                          <p className="text-sm text-muted-foreground">{customer.phone}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3" />
                              {customer.totalOrders} pedido{customer.totalOrders !== 1 ? "s" : ""}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {customer.daysInactive}d atrás
                            </span>
                            {customer.favoriteProduct && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[120px] sm:max-w-[150px]">
                                <Star className="w-3 h-3 text-amber-500 shrink-0" />
                                {customer.favoriteProduct}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-8 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="font-semibold text-primary text-sm">R$ {customer.totalSpent.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Total gasto</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950"
                          onClick={(e) => { e.stopPropagation(); openWhatsappDialog(customer); }}
                        >
                          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk WhatsApp Sender */}
      {restaurantId && (
        <BulkWhatsappSender
          selectedCustomers={filteredCustomers.filter(c => selectedCustomers.has(c.id))}
          restaurantName={restaurantName}
          restaurantId={restaurantId}
          currentFilter={filter}
          onClearSelection={() => setSelectedCustomers(new Set())}
        />
      )}

      {/* WhatsApp Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar WhatsApp
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer && (
                <span>
                  Mensagem para <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})
                  <br />
                  <Badge variant="outline" className="mt-1">
                    Estágio: {getCustomerStage(selectedCustomer.daysInactive)}
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Mensagem personalizada:</label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={10}
                className="resize-none"
                placeholder="Digite sua mensagem..."
              />
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
              <strong>Dica:</strong> A mensagem já foi personalizada com o nome do cliente e adequada ao estágio dele.
              Você pode editar antes de enviar.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={copyMessage} className="gap-2">
              {copiedMessage ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedMessage ? "Copiado!" : "Copiar"}
            </Button>
            <Button onClick={sendWhatsapp} className="gap-2 bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Customer Detail Dialog */}
      <Dialog open={!!detailCustomer} onOpenChange={(open) => !open && setDetailCustomer(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes do Cliente</DialogTitle>
          </DialogHeader>

          {detailCustomer && (
            <div className="space-y-5">
              {/* Name & Stage */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {detailCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{detailCustomer.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge(detailCustomer.daysInactive)}
                    {detailCustomer.totalOrders === 1 && (
                      <Badge className="text-xs bg-blue-500 hover:bg-blue-600">✨ Novo</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Phone className="w-3 h-3" />
                    Telefone
                  </div>
                  <p className="font-medium text-sm">{detailCustomer.phone}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <ShoppingBag className="w-3 h-3" />
                    Pedidos
                  </div>
                  <p className="font-medium text-sm">{detailCustomer.totalOrders}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <DollarSign className="w-3 h-3" />
                    Total Gasto
                  </div>
                  <p className="font-semibold text-sm text-primary">R$ {detailCustomer.totalSpent.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="w-3 h-3" />
                    Ticket Médio
                  </div>
                  <p className="font-medium text-sm">
                    R$ {detailCustomer.totalOrders > 0 ? (detailCustomer.totalSpent / detailCustomer.totalOrders).toFixed(2) : "0.00"}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Primeiro pedido
                  </span>
                  <span className="font-medium">{format(new Date(detailCustomer.firstOrder), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Último pedido
                  </span>
                  <span className="font-medium">
                    {format(new Date(detailCustomer.lastOrder), "dd/MM/yyyy", { locale: ptBR })}
                    {detailCustomer.daysInactive > 0 && (
                      <span className={`ml-1 ${detailCustomer.daysInactive > 90 ? "text-destructive" : "text-muted-foreground"}`}>
                        ({detailCustomer.daysInactive}d atrás)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Favorite Product */}
              {detailCustomer.favoriteProduct && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      Preferência Alimentar
                    </p>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      {detailLoading ? (
                        <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
                      ) : detailProductImage ? (
                        <img
                          src={detailProductImage}
                          alt={detailCustomer.favoriteProduct}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="w-6 h-6 text-amber-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{detailCustomer.favoriteProduct}</p>
                        <p className="text-xs text-muted-foreground">Produto mais pedido</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Order History */}
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Histórico de Pedidos ({customerOrders.length})
                </p>

                {detailLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : customerOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado</p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2 pr-3">
                      {customerOrders.map((order) => {
                        const items = Array.isArray(order.items) ? order.items : [];
                        const statusLabel: Record<string, string> = {
                          pending: "Pendente",
                          confirmed: "Confirmado",
                          preparing: "Preparando",
                          ready: "Pronto",
                          delivering: "Em entrega",
                          delivered: "Entregue",
                          canceled: "Cancelado",
                        };
                        const paymentLabel: Record<string, string> = {
                          pix: "PIX",
                          cash: "Dinheiro",
                          card: "Cartão",
                        };

                        return (
                          <div key={order.id} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-medium text-muted-foreground">
                                  #{order.order_number}
                                </span>
                                <Badge
                                  variant={order.status === "delivered" ? "default" : order.status === "canceled" ? "destructive" : "secondary"}
                                  className="text-[10px] h-5"
                                >
                                  {statusLabel[order.status] || order.status}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </div>

                            {/* Items */}
                            <div className="space-y-0.5">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground truncate max-w-[200px]">
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
                              <p className="text-[10px] text-muted-foreground italic">Obs: {order.notes}</p>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}</span>
                                <span>• {paymentLabel[order.payment_method] || order.payment_method}</span>
                              </div>
                              <span className="font-semibold text-primary">R$ {Number(order.total).toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setDetailCustomer(null);
                    openWhatsappDialog(detailCustomer);
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Cadastrar Cliente
            </DialogTitle>
            <DialogDescription>
              Adicione um novo cliente manualmente à sua base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-customer-name">Nome</Label>
              <Input
                id="new-customer-name"
                placeholder="Nome do cliente"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-customer-phone">Telefone</Label>
              <Input
                id="new-customer-phone"
                placeholder="(99) 99999-9999"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                maxLength={15}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCustomer} disabled={savingCustomer}>
              {savingCustomer ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
