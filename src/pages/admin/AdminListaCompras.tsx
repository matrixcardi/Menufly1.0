import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Building2, ClipboardList, MessageCircle, PackageCheck, Plus, RefreshCw, Sparkles } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

type Ingredient = {
  id: string;
  name: string;
  unit: string;
};

type StockLevelRow = {
  ingredient_id: string;
  current_quantity: number;
  min_quantity: number;
  unit: string | null;
  ingredients: Ingredient | null;
};

type IngredientSupplierPreferred = {
  ingredient_id: string;
  supplier_id: string;
  unit_cost: number | null;
  suppliers: Supplier | null;
};

type PurchaseOrder = {
  id: string;
  supplier_id: string;
  status: "rascunho" | "enviado" | "recebido" | "cancelado";
  total_value: number | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  suppliers: Supplier | null;
};

type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  ingredient_id: string;
  quantity_ordered: number;
  quantity_received: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  ingredients: Ingredient | null;
};

function toNumber(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatQty(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusBadgeVariant(status: PurchaseOrder["status"]) {
  if (status === "rascunho") return "secondary";
  if (status === "enviado") return "default";
  if (status === "recebido") return "outline";
  return "destructive";
}

function statusLabel(status: PurchaseOrder["status"]) {
  if (status === "rascunho") return "Rascunho";
  if (status === "enviado") return "Enviado";
  if (status === "recebido") return "Recebido";
  return "Cancelado";
}

function waDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // If user already includes country code, keep. Otherwise assume BR.
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export default function AdminListaCompras() {
  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const restaurantId = ctxSelectedId === "all" ? (selectedRestaurantIds[0] || null) : ctxSelectedId;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [openOrders, setOpenOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  const [editingQty, setEditingQty] = useState<Record<string, string>>({});
  const [editingSaving, setEditingSaving] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualSupplierId, setManualSupplierId] = useState<string>("");

  const [addItemIngredientId, setAddItemIngredientId] = useState<string>("");
  const [addItemQty, setAddItemQty] = useState<string>("");
  const [addItemUnitCost, setAddItemUnitCost] = useState<string>("");
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, i) => sum + toNumber(i.total_cost, 0), 0);
  }, [items]);

  async function ensureRestaurantSelected() {
    if (!restaurantId) {
      toast({ title: "Selecione um restaurante", description: "Escolha um restaurante para gerar listas.", variant: "destructive" });
      return false;
    }
    return true;
  }

  async function fetchOpenOrders() {
    if (!restaurantId) {
      setLoading(false);
      setOpenOrders([]);
      setSuppliers([]);
      return;
    }
    setLoading(true);
    try {
      const { data: supData, error: supErr } = await supabase
        .from("suppliers")
        .select("id, name, phone, active")
        .eq("restaurant_id", restaurantId)
        .order("name");
      if (supErr) throw supErr;
      setSuppliers((supData as Supplier[]) || []);

      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, supplier_id, status, total_value, sent_at, received_at, created_at, suppliers:supplier_id (id, name, phone, active)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["rascunho", "enviado"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setOpenOrders((data as unknown as PurchaseOrder[]) || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar listas", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOpenOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function fetchIngredientsOnce() {
    if (!restaurantId) return;
    if (ingredients.length > 0) return;
    setIngredientsLoading(true);
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setIngredientsLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar ingredientes", description: error.message, variant: "destructive" });
      return;
    }
    setIngredients((data as Ingredient[]) || []);
  }

  async function openOrder(po: PurchaseOrder) {
    setSelectedOrder(po);
    setDrawerOpen(true);
    setItems([]);
    setEditingQty({});
    setItemsLoading(true);

    const { data, error } = await supabase
      .from("purchase_order_items")
      .select("id, purchase_order_id, ingredient_id, quantity_ordered, quantity_received, unit_cost, total_cost, ingredients:ingredient_id (id, name, unit)")
      .eq("purchase_order_id", po.id)
      .order("id");
    setItemsLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar itens", description: error.message, variant: "destructive" });
      return;
    }
    const list = (data as unknown as PurchaseOrderItem[]) || [];
    setItems(list);
    const map: Record<string, string> = {};
    list.forEach((it) => { map[it.id] = String(it.quantity_ordered ?? ""); });
    setEditingQty(map);
  }

  async function createManualList() {
    if (!(await ensureRestaurantSelected())) return;
    if (!manualSupplierId) {
      toast({ title: "Selecione um fornecedor", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({
        restaurant_id: restaurantId,
        supplier_id: manualSupplierId,
        status: "rascunho",
        total_value: 0,
      } as any)
      .select("id, supplier_id, status, total_value, sent_at, received_at, created_at, suppliers:supplier_id (id, name, phone, active)")
      .maybeSingle();
    if (error || !data) {
      toast({ title: "Erro ao criar lista", description: error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: "Lista criada" });
    setManualOpen(false);
    setManualSupplierId("");
    await fetchOpenOrders();
    await openOrder(data as unknown as PurchaseOrder);
  }

  async function addItemToOrder() {
    if (!selectedOrder) return;
    if (!(await ensureRestaurantSelected())) return;
    const ingredientId = addItemIngredientId;
    const qty = toNumber(addItemQty, NaN);
    const unitCost = addItemUnitCost.trim() ? toNumber(addItemUnitCost, NaN) : null;
    if (!ingredientId || !Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Dados inválidos", description: "Selecione ingrediente e informe quantidade válida.", variant: "destructive" });
      return;
    }
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      toast({ title: "Custo inválido", variant: "destructive" });
      return;
    }

    const totalCost = unitCost != null ? qty * unitCost : null;
    const { error } = await supabase.from("purchase_order_items").insert({
      purchase_order_id: selectedOrder.id,
      ingredient_id: ingredientId,
      quantity_ordered: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
    } as any);
    if (error) {
      toast({ title: "Erro ao adicionar item", description: error.message, variant: "destructive" });
      return;
    }
    setAddItemIngredientId("");
    setAddItemQty("");
    setAddItemUnitCost("");
    await openOrder(selectedOrder);
    await recalcAndSaveOrderTotal(selectedOrder.id);
    await fetchOpenOrders();
  }

  async function recalcAndSaveOrderTotal(purchaseOrderId: string) {
    const { data, error } = await supabase
      .from("purchase_order_items")
      .select("total_cost, quantity_ordered, unit_cost")
      .eq("purchase_order_id", purchaseOrderId);
    if (error) return;
    const sum = ((data as any[]) || []).reduce((s, it) => {
      const tc = toNumber(it.total_cost, NaN);
      if (Number.isFinite(tc)) return s + tc;
      const qty = toNumber(it.quantity_ordered, 0);
      const uc = toNumber(it.unit_cost, NaN);
      if (Number.isFinite(uc)) return s + qty * uc;
      return s;
    }, 0);
    await supabase.from("purchase_orders").update({ total_value: sum } as any).eq("id", purchaseOrderId);
  }

  async function saveQuantities() {
    if (!selectedOrder) return;
    setEditingSaving(true);
    try {
      for (const it of items) {
        const raw = (editingQty[it.id] ?? "").trim();
        const qty = toNumber(raw, NaN);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const unitCost = it.unit_cost != null ? toNumber(it.unit_cost, NaN) : NaN;
        const totalCost = Number.isFinite(unitCost) ? qty * unitCost : null;
        const { error } = await supabase
          .from("purchase_order_items")
          .update({ quantity_ordered: qty, total_cost: totalCost } as any)
          .eq("id", it.id);
        if (error) throw error;
      }
      await recalcAndSaveOrderTotal(selectedOrder.id);
      toast({ title: "Quantidades salvas" });
      await openOrder(selectedOrder);
      await fetchOpenOrders();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setEditingSaving(false);
    }
  }

  async function generateAutomaticLists() {
    if (!(await ensureRestaurantSelected())) return;

    setLoading(true);
    try {
      const { data: stockData, error: stockErr } = await supabase
        .from("stock_levels")
        .select("ingredient_id, current_quantity, min_quantity, unit, ingredients:ingredient_id (id, name, unit)")
        .eq("restaurant_id", restaurantId)
        .lte("current_quantity", 1e18); // broad filter; we validate <= min in JS below

      if (stockErr) throw stockErr;
      const stock = (stockData as unknown as StockLevelRow[]) || [];
      const low = stock.filter((s) => toNumber(s.current_quantity, 0) <= toNumber(s.min_quantity, 0));
      const deficits = low
        .map((s) => {
          const cur = toNumber(s.current_quantity, 0);
          const min = toNumber(s.min_quantity, 0);
          const suggested = Math.max(min - cur, 0);
          return {
            ingredientId: s.ingredient_id,
            ingredientName: s.ingredients?.name || "Ingrediente",
            unit: s.unit || s.ingredients?.unit || "un",
            suggestedQty: suggested,
          };
        })
        .filter((d) => d.suggestedQty > 0);

      if (deficits.length === 0) {
        toast({ title: "Nada para comprar", description: "Nenhum ingrediente está abaixo do mínimo." });
        setLoading(false);
        return;
      }

      const ingredientIds = deficits.map(d => d.ingredientId);

      // 2) Load preferred suppliers for these ingredients (is_preferred=true)
      const { data: prefData, error: prefErr } = await supabase
        .from("ingredient_suppliers")
        .select("ingredient_id, supplier_id, unit_cost, suppliers:supplier_id (id, name, phone, active)")
        .in("ingredient_id", ingredientIds)
        .eq("is_preferred", true);
      if (prefErr) throw prefErr;
      const prefs = (prefData as unknown as IngredientSupplierPreferred[]) || [];
      const prefByIngredient: Record<string, IngredientSupplierPreferred> = {};
      prefs.forEach((p) => {
        if (!prefByIngredient[p.ingredient_id]) prefByIngredient[p.ingredient_id] = p;
      });

      // Group by supplier
      const grouped: Record<string, Array<{ ingredientId: string; qty: number; unitCost: number | null }>> = {};
      const missing: string[] = [];
      deficits.forEach((d) => {
        const pref = prefByIngredient[d.ingredientId];
        if (!pref?.supplier_id) {
          missing.push(d.ingredientName);
          return;
        }
        if (!grouped[pref.supplier_id]) grouped[pref.supplier_id] = [];
        grouped[pref.supplier_id].push({ ingredientId: d.ingredientId, qty: d.suggestedQty, unitCost: pref.unit_cost ?? null });
      });

      const supplierIds = Object.keys(grouped);
      if (supplierIds.length === 0) {
        toast({
          title: "Sem fornecedor preferido",
          description: "Nenhum ingrediente em falta tem fornecedor preferido configurado.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 3) Create purchase_orders (one per supplier)
      for (const sid of supplierIds) {
        const lines = grouped[sid];
        const total = lines.reduce((sum, l) => sum + (l.unitCost != null ? l.unitCost * l.qty : 0), 0);
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .insert({
            restaurant_id: restaurantId,
            supplier_id: sid,
            status: "rascunho",
            total_value: total,
          } as any)
          .select("id")
          .maybeSingle();
        if (poErr || !po?.id) throw poErr || new Error("Falha ao criar pedido de compra.");

        const itemPayload = lines.map((l) => ({
          purchase_order_id: po.id,
          ingredient_id: l.ingredientId,
          quantity_ordered: l.qty,
          unit_cost: l.unitCost,
          total_cost: l.unitCost != null ? l.unitCost * l.qty : null,
        }));
        const { error: itemsErr } = await supabase.from("purchase_order_items").insert(itemPayload as any);
        if (itemsErr) throw itemsErr;
      }

      const missingMsg = missing.length > 0 ? `Alguns itens foram ignorados por não terem fornecedor preferido: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "..." : ""}` : null;
      toast({ title: "Listas geradas", description: missingMsg || "Pedidos em rascunho criados por fornecedor." });
      await fetchOpenOrders();
    } catch (err: any) {
      toast({ title: "Erro ao gerar lista", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp() {
    if (!selectedOrder?.suppliers?.phone) {
      toast({ title: "Sem telefone", description: "Cadastre o telefone do fornecedor para enviar por WhatsApp.", variant: "destructive" });
      return;
    }
    const digits = waDigits(selectedOrder.suppliers.phone);
    if (!digits) {
      toast({ title: "Telefone inválido", description: "Informe DDD + número.", variant: "destructive" });
      return;
    }

    const lines = items.map((it) => {
      const name = it.ingredients?.name || "Ingrediente";
      const unit = it.ingredients?.unit || "un";
      const qty = toNumber(it.quantity_ordered, 0);
      const uc = it.unit_cost != null ? toNumber(it.unit_cost, NaN) : NaN;
      const costTxt = Number.isFinite(uc) ? ` (R$ ${uc.toFixed(2).replace(".", ",")}/${unit})` : "";
      return `- ${formatQty(qty)} ${unit} • ${name}${costTxt}`;
    }).join("\n");

    const header = `🧾 *Lista de Compras* (${statusLabel(selectedOrder.status)})\n🏪 Pedido: ${selectedOrder.id}\n📅 ${formatDateTime(new Date().toISOString())}\n\n`;
    const footer = `\n\nTotal estimado: ${formatCurrency(estimatedTotal)}\n\nPode confirmar disponibilidade e prazo?`;
    const msg = header + lines + footer;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function confirmRecebimento() {
    if (!selectedOrder) return;
    if (!(await ensureRestaurantSelected())) return;
    if (selectedOrder.status === "recebido") return;

    try {
      // Ensure latest quantities are saved before receiving
      await saveQuantities();

      const { data: userRes } = await supabase.auth.getUser();
      const createdBy = userRes.user?.id ?? null;

      // Load fresh items
      const { data: itemsData, error: itemsErr } = await supabase
        .from("purchase_order_items")
        .select("id, ingredient_id, quantity_ordered, unit_cost, total_cost")
        .eq("purchase_order_id", selectedOrder.id);
      if (itemsErr) throw itemsErr;
      const list = (itemsData as any[]) || [];

      // Insert movements + update stock levels
      for (const it of list) {
        const ingredientId = it.ingredient_id as string;
        const qty = toNumber(it.quantity_ordered, 0);
        if (qty <= 0) continue;

        const reason = `Recebimento pedido de compra ${selectedOrder.id}`;
        const { error: mvErr } = await supabase.from("stock_movements").insert({
          restaurant_id: restaurantId,
          ingredient_id: ingredientId,
          type: "entrada",
          quantity: qty,
          reason,
          purchase_order_id: selectedOrder.id,
          created_by: createdBy,
        } as any);
        if (mvErr) throw mvErr;

        // Update stock_levels (increment current_quantity)
        const { data: sl, error: slErr } = await supabase
          .from("stock_levels")
          .select("id, current_quantity")
          .eq("restaurant_id", restaurantId)
          .eq("ingredient_id", ingredientId)
          .maybeSingle();
        if (slErr) throw slErr;
        if (sl?.id) {
          const next = toNumber(sl.current_quantity, 0) + qty;
          const { error: upErr } = await supabase
            .from("stock_levels")
            .update({ current_quantity: next, updated_at: new Date().toISOString() } as any)
            .eq("id", sl.id);
          if (upErr) throw upErr;
        } else {
          // Create a default stock row if missing
          const { data: ing } = await supabase.from("ingredients").select("unit").eq("id", ingredientId).maybeSingle();
          const { error: insErr } = await supabase.from("stock_levels").insert({
            restaurant_id: restaurantId,
            ingredient_id: ingredientId,
            current_quantity: qty,
            min_quantity: 0,
            unit: (ing as any)?.unit || "un",
          } as any);
          if (insErr) throw insErr;
        }
      }

      // Update PO status
      const now = new Date().toISOString();
      const { error: poErr } = await supabase
        .from("purchase_orders")
        .update({ status: "recebido", received_at: now } as any)
        .eq("id", selectedOrder.id);
      if (poErr) throw poErr;

      toast({ title: "Recebimento confirmado", description: "Entrada lançada automaticamente no estoque." });
      setDrawerOpen(false);
      setSelectedOrder(null);
      await fetchOpenOrders();
    } catch (err: any) {
      toast({ title: "Erro ao confirmar recebimento", description: err.message || "Tente novamente.", variant: "destructive" });
    }
  }

  const cardsVM = useMemo(() => {
    // We need item counts; fetch per card would be heavy. We'll infer 0 and show only totals for now.
    return openOrders.map((po) => ({
      ...po,
      itemCount: null as number | null,
      estimated: toNumber(po.total_value, 0),
    }));
  }, [openOrders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Lista de Compras
          </h1>
          <p className="text-sm text-muted-foreground">Crie e envie listas por fornecedor</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => fetchOpenOrders()}>
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button className="gap-2" onClick={generateAutomaticLists}>
            <Sparkles className="w-4 h-4" />
            Gerar Lista Automática
          </Button>
          <Button variant="secondary" className="gap-2" onClick={async () => { if (!(await ensureRestaurantSelected())) return; setManualOpen(true); }}>
            <Plus className="w-4 h-4" />
            Nova Lista Manual
          </Button>
        </div>
      </div>

      {/* Open lists */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))
        ) : cardsVM.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma lista aberta (rascunho/enviado).
            </CardContent>
          </Card>
        ) : (
          cardsVM.map((po) => (
            <Card
              key={po.id}
              role="button"
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => openOrder(po)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {po.suppliers?.name || "Fornecedor"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      Criado em {formatDateTime(po.created_at)}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(po.status)}>{statusLabel(po.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Itens</span>
                  <span className="font-medium">{po.itemCount == null ? "—" : po.itemCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor estimado</span>
                  <span className="font-semibold">{formatCurrency(toNumber(po.total_value, 0))}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Drawer: order details */}
      <Drawer open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setSelectedOrder(null); }}>
        <DrawerContent className="max-w-4xl mx-auto">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {selectedOrder?.suppliers?.name || "Lista de Compras"}
            </DrawerTitle>
            <DrawerDescription>
              {selectedOrder ? `${statusLabel(selectedOrder.status)} · Total estimado: ${formatCurrency(estimatedTotal)}` : "Itens"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                {selectedOrder && (
                  <Badge variant={statusBadgeVariant(selectedOrder.status)}>{statusLabel(selectedOrder.status)}</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {selectedOrder ? `Criado em ${formatDateTime(selectedOrder.created_at)}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={openWhatsApp} disabled={!selectedOrder}>
                  <MessageCircle className="w-4 h-4" />
                  Enviar por WhatsApp
                </Button>
                <Button variant="secondary" className="gap-2" onClick={saveQuantities} disabled={!selectedOrder || editingSaving}>
                  <RefreshCw className="w-4 h-4" />
                  Salvar quantidades
                </Button>
                <Button className="gap-2" onClick={confirmRecebimento} disabled={!selectedOrder}>
                  <PackageCheck className="w-4 h-4" />
                  Confirmar Recebimento
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Itens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {itemsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">Nenhum item nesta lista.</div>
                ) : (
                  <div className="space-y-2">
                    {items.map((it) => {
                      const name = it.ingredients?.name || "Ingrediente";
                      const unit = it.ingredients?.unit || "un";
                      const unitCost = it.unit_cost != null ? toNumber(it.unit_cost, NaN) : NaN;
                      const qtyRaw = editingQty[it.id] ?? String(it.quantity_ordered ?? "");
                      const qty = toNumber(qtyRaw, 0);
                      const total = Number.isFinite(unitCost) ? qty * unitCost : toNumber(it.total_cost, 0);
                      return (
                        <div key={it.id} className="rounded-xl border bg-card p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              Unidade: {unit}
                              {Number.isFinite(unitCost) && ` · Custo: ${formatCurrency(unitCost)}/${unit}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-32">
                              <Label className="text-xs text-muted-foreground">Qtd</Label>
                              <Input
                                value={qtyRaw}
                                onChange={(e) => setEditingQty((p) => ({ ...p, [it.id]: e.target.value }))}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="w-36 text-right">
                              <Label className="text-xs text-muted-foreground">Total</Label>
                              <div className="font-semibold">{formatCurrency(total)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedOrder?.status === "rascunho" && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Adicionar item</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2 md:col-span-1">
                          <Label>Ingrediente</Label>
                          <Select
                            value={addItemIngredientId}
                            onValueChange={setAddItemIngredientId}
                            onOpenChange={async (open) => { if (open) await fetchIngredientsOnce(); }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={ingredientsLoading ? "Carregando..." : "Selecione..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredients.map((i) => (
                                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input value={addItemQty} onChange={(e) => setAddItemQty(e.target.value)} inputMode="decimal" placeholder="Ex: 5" />
                        </div>
                        <div className="space-y-2">
                          <Label>Custo unitário (opcional)</Label>
                          <Input value={addItemUnitCost} onChange={(e) => setAddItemUnitCost(e.target.value)} inputMode="decimal" placeholder="Ex: 12.50" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button className="gap-2" onClick={addItemToOrder}>
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Manual list dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Lista Manual</DialogTitle>
            <DialogDescription>Escolha um fornecedor para criar um rascunho.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select value={manualSupplierId} onValueChange={setManualSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.filter(s => s.active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={createManualList}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

