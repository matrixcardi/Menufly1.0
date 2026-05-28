import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, RefreshCw, Link2, Unlink, DollarSign } from "lucide-react";

type Supplier = {
  id: string;
  restaurant_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  payment_terms: string | null;
  delivery_days: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type Ingredient = {
  id: string;
  name: string;
  unit: string;
};

type IngredientSupplierRow = {
  id: string;
  supplier_id: string;
  ingredient_id: string;
  unit_cost: number | null;
  is_preferred: boolean;
  ingredients: Ingredient | null;
};

type PurchaseOrder = {
  id: string;
  status: "rascunho" | "enviado" | "recebido" | "cancelado";
  total_value: number | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
};

function toNumber(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function getMonthRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function AdminFornecedores() {
  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const restaurantId = ctxSelectedId === "all" ? (selectedRestaurantIds[0] || null) : ctxSelectedId;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredientCountBySupplier, setIngredientCountBySupplier] = useState<Record<string, number>>({});
  const [ordersThisMonth, setOrdersThisMonth] = useState<number>(0);

  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [linksLoading, setLinksLoading] = useState(false);
  const [ingredientLinks, setIngredientLinks] = useState<IngredientSupplierRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [supplierOrders, setSupplierOrders] = useState<PurchaseOrder[]>([]);

  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    cnpj: "",
    payment_terms: "",
    delivery_days: "",
    notes: "",
    active: true,
  });

  const [linkIngredientId, setLinkIngredientId] = useState<string>("");
  const [linkUnitCost, setLinkUnitCost] = useState<string>("");
  const [linkPreferred, setLinkPreferred] = useState<boolean>(false);

  const activeSuppliersCount = useMemo(() => suppliers.filter(s => s.active).length, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s => s.name.toLowerCase().includes(q));
  }, [suppliers, search]);

  async function ensureRestaurantSelected() {
    if (!restaurantId) {
      toast({ title: "Selecione um restaurante", description: "Escolha um restaurante para gerenciar fornecedores.", variant: "destructive" });
      return false;
    }
    return true;
  }

  async function fetchSuppliers() {
    if (!restaurantId) {
      setLoading(false);
      setSuppliers([]);
      setIngredientCountBySupplier({});
      setOrdersThisMonth(0);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, restaurant_id, name, contact_name, phone, email, cnpj, payment_terms, delivery_days, notes, active, created_at")
        .eq("restaurant_id", restaurantId)
        .order("name");
      if (error) throw error;
      const list = (data as Supplier[]) || [];
      setSuppliers(list);

      const supplierIds = list.map(s => s.id);
      if (supplierIds.length > 0) {
        // ingredient count per supplier
        const { data: linkData, error: linkErr } = await supabase
          .from("ingredient_suppliers")
          .select("supplier_id")
          .in("supplier_id", supplierIds);
        if (linkErr) throw linkErr;
        const counts: Record<string, number> = {};
        (linkData as Array<{ supplier_id: string }> | null)?.forEach((r) => {
          counts[r.supplier_id] = (counts[r.supplier_id] || 0) + 1;
        });
        supplierIds.forEach((id) => { if (counts[id] == null) counts[id] = 0; });
        setIngredientCountBySupplier(counts);
      } else {
        setIngredientCountBySupplier({});
      }

      // orders this month (all suppliers)
      const { start, end } = getMonthRangeISO();
      const { count, error: poErr } = await supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start)
        .lt("created_at", end);
      if (poErr) throw poErr;
      setOrdersThisMonth(count || 0);
    } catch (err: any) {
      toast({ title: "Erro ao carregar fornecedores", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchIngredientsOnce() {
    if (!restaurantId) return;
    if (allIngredients.length > 0) return;
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
    setAllIngredients((data as Ingredient[]) || []);
  }

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function openSupplierDrawer(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setDrawerOpen(true);
    setIngredientLinks([]);
    setSupplierOrders([]);
    setLinkIngredientId("");
    setLinkUnitCost("");
    setLinkPreferred(false);

    if (!restaurantId) return;

    // Links
    setLinksLoading(true);
    const { data: links, error: linksErr } = await supabase
      .from("ingredient_suppliers")
      .select("id, supplier_id, ingredient_id, unit_cost, is_preferred, ingredients:ingredient_id (id, name, unit)")
      .eq("supplier_id", supplier.id)
      .order("is_preferred", { ascending: false });
    setLinksLoading(false);
    if (linksErr) {
      toast({ title: "Erro ao carregar ingredientes", description: linksErr.message, variant: "destructive" });
    } else {
      setIngredientLinks((links as unknown as IngredientSupplierRow[]) || []);
    }

    // Purchase Orders
    setOrdersLoading(true);
    const { data: pos, error: posErr } = await supabase
      .from("purchase_orders")
      .select("id, status, total_value, sent_at, received_at, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setOrdersLoading(false);
    if (posErr) {
      toast({ title: "Erro ao carregar pedidos", description: posErr.message, variant: "destructive" });
    } else {
      setSupplierOrders((pos as PurchaseOrder[]) || []);
    }
  }

  function openCreateDialog() {
    setEditingSupplier(null);
    setForm({
      name: "",
      contact_name: "",
      phone: "",
      email: "",
      cnpj: "",
      payment_terms: "",
      delivery_days: "",
      notes: "",
      active: true,
    });
    setEditOpen(true);
  }

  function openEditDialog(s: Supplier) {
    setEditingSupplier(s);
    setForm({
      name: s.name || "",
      contact_name: s.contact_name || "",
      phone: s.phone || "",
      email: s.email || "",
      cnpj: s.cnpj || "",
      payment_terms: s.payment_terms || "",
      delivery_days: s.delivery_days == null ? "" : String(s.delivery_days),
      notes: s.notes || "",
      active: !!s.active,
    });
    setEditOpen(true);
  }

  async function saveSupplier() {
    if (!(await ensureRestaurantSelected())) return;
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do fornecedor.", variant: "destructive" });
      return;
    }

    const payload: any = {
      restaurant_id: restaurantId,
      name,
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      cnpj: form.cnpj.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      delivery_days: form.delivery_days.trim() ? Number(form.delivery_days) : null,
      notes: form.notes.trim() || null,
      active: form.active,
    };

    if (payload.delivery_days != null && (!Number.isFinite(payload.delivery_days) || payload.delivery_days < 0)) {
      toast({ title: "Prazo inválido", description: "Prazo de entrega deve ser um número válido.", variant: "destructive" });
      return;
    }

    if (editingSupplier) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id);
      if (error) {
        toast({ title: "Erro ao salvar fornecedor", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Fornecedor atualizado" });
    } else {
      const { error } = await supabase.from("suppliers").insert(payload);
      if (error) {
        toast({ title: "Erro ao criar fornecedor", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Fornecedor criado" });
    }

    setEditOpen(false);
    await fetchSuppliers();
  }

  async function linkIngredient() {
    if (!selectedSupplier) return;
    if (!(await ensureRestaurantSelected())) return;
    const ingredientId = linkIngredientId;
    const unitCost = linkUnitCost.trim() ? toNumber(linkUnitCost, NaN) : null;

    if (!ingredientId) {
      toast({ title: "Selecione um ingrediente", variant: "destructive" });
      return;
    }
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      toast({ title: "Custo inválido", description: "Informe um custo unitário válido.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("ingredient_suppliers").upsert({
      supplier_id: selectedSupplier.id,
      ingredient_id: ingredientId,
      unit_cost: unitCost,
      is_preferred: linkPreferred,
    } as any, { onConflict: "ingredient_id,supplier_id" });

    if (error) {
      toast({ title: "Erro ao vincular ingrediente", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Ingrediente vinculado" });
    setLinkIngredientId("");
    setLinkUnitCost("");
    setLinkPreferred(false);
    await openSupplierDrawer(selectedSupplier);
    await fetchSuppliers();
  }

  async function unlinkIngredient(linkId: string) {
    if (!selectedSupplier) return;
    const { error } = await supabase.from("ingredient_suppliers").delete().eq("id", linkId);
    if (error) {
      toast({ title: "Erro ao remover vínculo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vínculo removido" });
    await openSupplierDrawer(selectedSupplier);
    await fetchSuppliers();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie fornecedores do restaurante</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => fetchSuppliers()}>
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Fornecedores ativos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{activeSuppliersCount}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pedidos de compra (este mês)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{ordersThisMonth}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar fornecedor..."
          className="max-w-md"
        />
        <div className="text-sm text-muted-foreground">
          {loading ? "Carregando..." : `${filteredSuppliers.length} fornecedor(es)`}
        </div>
      </div>

      {/* Supplier cards */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum fornecedor encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSuppliers.map((s) => (
            <Card
              key={s.id}
              role="button"
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => openSupplierDrawer(s)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{s.name}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.contact_name ? `Contato: ${s.contact_name}` : "Sem contato"}
                    </p>
                  </div>
                  <Badge variant={s.active ? "default" : "secondary"} className={s.active ? "bg-accent text-accent-foreground" : ""}>
                    {s.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Telefone: </span>
                  <span className="font-medium">{s.phone || "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Ingredientes: </span>
                  <span className="font-semibold">{ingredientCountBySupplier[s.id] ?? 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setSelectedSupplier(null); }}>
        <DrawerContent className="max-w-3xl mx-auto">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {selectedSupplier?.name || "Fornecedor"}
            </DrawerTitle>
            <DrawerDescription>Detalhes do fornecedor, ingredientes e pedidos</DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-5">
            {!selectedSupplier ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                {/* Details */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm text-muted-foreground">Dados do fornecedor</CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(selectedSupplier)}>Editar</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex flex-wrap gap-x-8 gap-y-2">
                      <div><span className="text-muted-foreground">Contato:</span> <span className="font-medium">{selectedSupplier.contact_name || "—"}</span></div>
                      <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{selectedSupplier.phone || "—"}</span></div>
                      <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selectedSupplier.email || "—"}</span></div>
                      <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-medium">{selectedSupplier.cnpj || "—"}</span></div>
                      <div><span className="text-muted-foreground">Prazo:</span> <span className="font-medium">{selectedSupplier.delivery_days != null ? `${selectedSupplier.delivery_days} dia(s)` : "—"}</span></div>
                    </div>
                    {selectedSupplier.payment_terms && (
                      <div><span className="text-muted-foreground">Condição:</span> <span className="font-medium">{selectedSupplier.payment_terms}</span></div>
                    )}
                    {selectedSupplier.notes && (
                      <div className="pt-2 text-muted-foreground">{selectedSupplier.notes}</div>
                    )}
                  </CardContent>
                </Card>

                {/* Link ingredients */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Ingredientes que fornece</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-1">
                        <Label>Ingrediente</Label>
                        <Select
                          value={linkIngredientId}
                          onValueChange={async (v) => { setLinkIngredientId(v); await fetchIngredientsOnce(); }}
                          onOpenChange={async (open) => { if (open) await fetchIngredientsOnce(); }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={ingredientsLoading ? "Carregando..." : "Selecione..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {allIngredients.map((i) => (
                              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Custo unitário</Label>
                        <Input value={linkUnitCost} onChange={(e) => setLinkUnitCost(e.target.value)} placeholder="Ex: 12.50" inputMode="decimal" />
                      </div>
                      <div className="space-y-2">
                        <Label>Preferencial</Label>
                        <div className="h-10 flex items-center justify-between rounded-md border px-3">
                          <span className="text-sm text-muted-foreground">Marcar como principal</span>
                          <Switch checked={linkPreferred} onCheckedChange={setLinkPreferred} />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button className="gap-2" onClick={linkIngredient}>
                        <Link2 className="w-4 h-4" />
                        Vincular
                      </Button>
                    </div>

                    <Separator />

                    {linksLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : ingredientLinks.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">Nenhum ingrediente vinculado.</div>
                    ) : (
                      <div className="space-y-2">
                        {ingredientLinks.map((l) => (
                          <div key={l.id} className="rounded-xl border bg-card p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{l.ingredients?.name || "Ingrediente"}</span>
                                {l.is_preferred && <Badge variant="outline">Preferencial</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Unidade: {l.ingredients?.unit || "—"}
                                {l.unit_cost != null && (
                                  <>
                                    {" · "}
                                    <span className="inline-flex items-center gap-1">
                                      <DollarSign className="w-3.5 h-3.5" />
                                      {formatCurrency(toNumber(l.unit_cost, 0))}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => unlinkIngredient(l.id)}>
                              <Unlink className="w-4 h-4" />
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Purchase orders */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Histórico de pedidos de compra</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ordersLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : supplierOrders.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">Nenhum pedido de compra encontrado.</div>
                    ) : (
                      <div className="space-y-2">
                        {supplierOrders.map((po) => (
                          <div key={po.id} className="rounded-xl border bg-card p-3 flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{po.status}</Badge>
                                <span className="text-sm font-medium">{po.total_value != null ? formatCurrency(toNumber(po.total_value, 0)) : "—"}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Criado em {formatDateTime(po.created_at)}
                                {po.sent_at && ` · Enviado: ${formatDateTime(po.sent_at)}`}
                                {po.received_at && ` · Recebido: ${formatDateTime(po.received_at)}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Dialog create/edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Distribuidora X" />
            </div>

            <div className="space-y-2">
              <Label>Contato</Label>
              <Input value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} placeholder="Nome do contato" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(51) 99999-9999" />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contato@fornecedor.com" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>

            <div className="space-y-2">
              <Label>Prazo de pagamento</Label>
              <Input value={form.payment_terms} onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))} placeholder="Ex: 14 dias / à vista" />
            </div>
            <div className="space-y-2">
              <Label>Prazo de entrega (dias)</Label>
              <Input value={form.delivery_days} onChange={(e) => setForm((p) => ({ ...p, delivery_days: e.target.value }))} placeholder="Ex: 2" inputMode="numeric" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Ex: atende seg-sex, entrega pela manhã..." />
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-xs text-muted-foreground">Ativo aparece nas seleções de fornecedor</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={form.active ? "default" : "secondary"} className={form.active ? "bg-accent text-accent-foreground" : ""}>
                  {form.active ? "Ativo" : "Inativo"}
                </Badge>
                <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveSupplier}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

