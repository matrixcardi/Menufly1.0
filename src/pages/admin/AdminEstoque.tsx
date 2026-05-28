import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Box, RefreshCw, SlidersHorizontal } from "lucide-react";

type StockStatus = "ok" | "alerta" | "critico";
type FilterStatus = "todos" | StockStatus;

type Ingredient = {
  id: string;
  name: string;
  unit: string;
};

type StockLevelRow = {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  current_quantity: number;
  min_quantity: number;
  unit: string | null;
  updated_at: string;
  ingredients: Ingredient | null;
};

type Supplier = {
  id: string;
  name: string;
};

type StockMovement = {
  id: string;
  ingredient_id: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: number;
  reason: string | null;
  created_at: string;
};

type StockRowVM = {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  currentQty: number;
  minQty: number;
  status: StockStatus;
  lastMovementAt: string | null;
};

function toNumber(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatQty(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function computeStatus(currentQty: number, minQty: number): StockStatus {
  if (currentQty <= 0) return "critico";
  if (currentQty < minQty) return "alerta";
  return "ok";
}

function badgeVariant(status: StockStatus) {
  if (status === "ok") return "default";
  if (status === "alerta") return "secondary";
  return "destructive";
}

function statusLabel(status: StockStatus) {
  if (status === "ok") return "OK";
  if (status === "alerta") return "Alerta";
  return "Crítico";
}

export default function AdminEstoque() {
  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds, selectedRestaurant } = useRestaurantContext();
  const restaurantId = ctxSelectedId === "all" ? (selectedRestaurantIds[0] || null) : ctxSelectedId;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockRowVM[]>([]);
  const [rawStock, setRawStock] = useState<StockLevelRow[]>([]);
  const [lastMovementByIngredient, setLastMovementByIngredient] = useState<Record<string, string | null>>({});
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("todos");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const selectedRow = useMemo(() => rows.find(r => r.ingredientId === selectedIngredientId) || null, [rows, selectedIngredientId]);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<StockMovement[]>([]);

  const [entradaOpen, setEntradaOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [entradaIngredientId, setEntradaIngredientId] = useState<string>("");
  const [entradaQty, setEntradaQty] = useState<string>("");
  const [entradaSupplierId, setEntradaSupplierId] = useState<string>("none");

  const [ajusteIngredientId, setAjusteIngredientId] = useState<string>("");
  const [ajusteNewQty, setAjusteNewQty] = useState<string>("");
  const [ajusteReason, setAjusteReason] = useState<string>("");

  const ingredientOptions = useMemo(() => {
    return allIngredients
      .map((ing) => ({
        id: ing.id,
        name: ing.name,
        unit: ing.unit || "un",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [allIngredients]);

  async function fetchSuppliersIfNeeded() {
    if (!restaurantId) return;
    if (suppliers.length > 0) return;
    setSuppliersLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .order("name");
    setSuppliersLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar fornecedores", description: error.message, variant: "destructive" });
      return;
    }
    setSuppliers((data as Supplier[]) || []);
  }

  async function fetchIngredients() {
    if (!restaurantId) {
      setAllIngredients([]);
      return;
    }
    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("restaurant_id", restaurantId)
      .order("name");
    if (error) {
      toast({ title: "Erro ao carregar ingredientes", description: error.message, variant: "destructive" });
      return;
    }
    setAllIngredients((data as Ingredient[]) || []);
  }

  async function fetchStock() {
    if (!restaurantId) {
      setLoading(false);
      setRows([]);
      setRawStock([]);
      setLastMovementByIngredient({});
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stock_levels")
        .select("id, restaurant_id, ingredient_id, current_quantity, min_quantity, unit, updated_at, ingredients:ingredient_id (id, name, unit)")
        .eq("restaurant_id", restaurantId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const stock = (data as unknown as StockLevelRow[]) || [];
      setRawStock(stock);

      // Fetch last movement for visible ingredients
      const ingredientIds = stock.map(s => s.ingredient_id).filter(Boolean);
      if (ingredientIds.length > 0) {
        const { data: mvData, error: mvErr } = await supabase
          .from("stock_movements")
          .select("ingredient_id, created_at")
          .eq("restaurant_id", restaurantId)
          .in("ingredient_id", ingredientIds)
          .order("created_at", { ascending: false })
          .limit(500);
        if (mvErr) throw mvErr;

        const latest: Record<string, string> = {};
        (mvData as Array<{ ingredient_id: string; created_at: string }> | null)?.forEach((m) => {
          if (!latest[m.ingredient_id]) latest[m.ingredient_id] = m.created_at;
        });
        const merged: Record<string, string | null> = {};
        ingredientIds.forEach((id) => { merged[id] = latest[id] || null; });
        setLastMovementByIngredient(merged);
      } else {
        setLastMovementByIngredient({});
      }

      const vm: StockRowVM[] = stock
        .map((r) => {
          const ingredientName = r.ingredients?.name || "Ingrediente";
          const unit = r.unit || r.ingredients?.unit || "un";
          const currentQty = toNumber(r.current_quantity, 0);
          const minQty = toNumber(r.min_quantity, 0);
          return {
            ingredientId: r.ingredient_id,
            ingredientName,
            unit,
            currentQty,
            minQty,
            status: computeStatus(currentQty, minQty),
            lastMovementAt: null,
          };
        })
        .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, "pt-BR"));

      setRows(vm);
    } catch (err: any) {
      toast({ title: "Erro ao carregar estoque", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStock();
    fetchIngredients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Apply last movement dates into VM
  useEffect(() => {
    if (!rows.length) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        lastMovementAt: lastMovementByIngredient[r.ingredientId] ?? r.lastMovementAt ?? null,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(lastMovementByIngredient).join(",")]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || r.ingredientName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "todos" ? true : r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const alerta = rows.filter(r => r.status === "alerta").length;
    const critico = rows.filter(r => r.status === "critico").length;
    return { total, alerta, critico };
  }, [rows]);

  async function openHistory(ingredientId: string) {
    if (!restaurantId) return;
    setSelectedIngredientId(ingredientId);
    setDrawerOpen(true);
    setHistory([]);
    setHistoryLoading(true);

    const { data, error } = await supabase
      .from("stock_movements")
      .select("id, ingredient_id, type, quantity, reason, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("ingredient_id", ingredientId)
      .order("created_at", { ascending: false })
      .limit(100);

    setHistoryLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar movimentações", description: error.message, variant: "destructive" });
      return;
    }
    setHistory((data as StockMovement[]) || []);
  }

  async function ensureRestaurantSelected() {
    if (!restaurantId) {
      toast({ title: "Selecione um restaurante", description: "Escolha um restaurante para gerenciar o estoque.", variant: "destructive" });
      return false;
    }
    return true;
  }

  async function registerEntrada() {
    if (!restaurantId) return;
    const ingredientId = entradaIngredientId;
    const qty = toNumber(entradaQty, NaN);
    if (!ingredientId || !Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Dados inválidos", description: "Selecione o ingrediente e informe uma quantidade válida.", variant: "destructive" });
      return;
    }

    const stockRow = rawStock.find(r => r.ingredient_id === ingredientId);
    const current = toNumber(stockRow?.current_quantity, 0);
    const next = current + qty;

    const supplierName = entradaSupplierId !== "none" ? suppliers.find(s => s.id === entradaSupplierId)?.name : null;
    const reason = supplierName ? `Entrada - Fornecedor: ${supplierName}` : "Entrada";

    const { data: userRes } = await supabase.auth.getUser();
    const createdBy = userRes.user?.id ?? null;

    const { error: mvErr } = await supabase.from("stock_movements").insert({
      restaurant_id: restaurantId,
      ingredient_id: ingredientId,
      type: "entrada",
      quantity: qty,
      reason,
      created_by: createdBy,
    } as any);
    if (mvErr) {
      toast({ title: "Erro ao registrar entrada", description: mvErr.message, variant: "destructive" });
      return;
    }

    if (stockRow?.id) {
      const { error: upErr } = await supabase
        .from("stock_levels")
        .update({ current_quantity: next, updated_at: new Date().toISOString() } as any)
        .eq("id", stockRow.id);
      if (upErr) {
        toast({ title: "Entrada registrada, mas falhou ao atualizar saldo", description: upErr.message, variant: "destructive" });
      }
    } else {
      const ingredient = ingredientOptions.find(i => i.id === ingredientId);
      const { error: insErr } = await supabase.from("stock_levels").insert({
        restaurant_id: restaurantId,
        ingredient_id: ingredientId,
        current_quantity: next,
        min_quantity: 0,
        unit: ingredient?.unit || "un",
      } as any);
      if (insErr) {
        toast({ title: "Entrada registrada, mas falhou ao criar saldo", description: insErr.message, variant: "destructive" });
      }
    }

    toast({ title: "Entrada registrada" });
    setEntradaOpen(false);
    setEntradaIngredientId("");
    setEntradaQty("");
    setEntradaSupplierId("none");
    fetchStock();
  }

  async function registerAjuste() {
    if (!restaurantId) return;
    const ingredientId = ajusteIngredientId;
    const newQty = toNumber(ajusteNewQty, NaN);
    const reason = ajusteReason.trim();
    if (!ingredientId || !Number.isFinite(newQty) || newQty < 0) {
      toast({ title: "Dados inválidos", description: "Selecione o ingrediente e informe uma quantidade válida.", variant: "destructive" });
      return;
    }
    if (!reason) {
      toast({ title: "Motivo obrigatório", description: "Informe o motivo do ajuste.", variant: "destructive" });
      return;
    }

    const stockRow = rawStock.find(r => r.ingredient_id === ingredientId);
    const current = toNumber(stockRow?.current_quantity, 0);
    const delta = newQty - current;

    const { data: userRes } = await supabase.auth.getUser();
    const createdBy = userRes.user?.id ?? null;

    const { error: mvErr } = await supabase.from("stock_movements").insert({
      restaurant_id: restaurantId,
      ingredient_id: ingredientId,
      type: "ajuste",
      quantity: delta,
      reason,
      created_by: createdBy,
    } as any);
    if (mvErr) {
      toast({ title: "Erro ao registrar ajuste", description: mvErr.message, variant: "destructive" });
      return;
    }

    if (stockRow?.id) {
      const { error: upErr } = await supabase
        .from("stock_levels")
        .update({ current_quantity: newQty, updated_at: new Date().toISOString() } as any)
        .eq("id", stockRow.id);
      if (upErr) {
        toast({ title: "Ajuste registrado, mas falhou ao atualizar saldo", description: upErr.message, variant: "destructive" });
      }
    } else {
      const ingredient = ingredientOptions.find(i => i.id === ingredientId);
      const { error: insErr } = await supabase.from("stock_levels").insert({
        restaurant_id: restaurantId,
        ingredient_id: ingredientId,
        current_quantity: newQty,
        min_quantity: 0,
        unit: ingredient?.unit || "un",
      } as any);
      if (insErr) {
        toast({ title: "Ajuste registrado, mas falhou ao criar saldo", description: insErr.message, variant: "destructive" });
      }
    }

    toast({ title: "Ajuste registrado" });
    setAjusteOpen(false);
    setAjusteIngredientId("");
    setAjusteNewQty("");
    setAjusteReason("");
    fetchStock();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Box className="w-6 h-6" />
            Estoque
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedRestaurant ? `Restaurante: ${selectedRestaurant.name}` : "Gerencie o saldo dos ingredientes"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchStock()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button
            onClick={async () => {
              if (!(await ensureRestaurantSelected())) return;
              await fetchSuppliersIfNeeded();
              setEntradaOpen(true);
            }}
            className="gap-2"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Registrar Entrada
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!(await ensureRestaurantSelected())) return;
              setAjusteOpen(true);
            }}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Ajuste de Inventário
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de ingredientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{summary.total}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Itens em alerta</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{summary.alerta}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Itens críticos (zerados)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{summary.critico}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ingrediente..."
            className="max-w-md"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="alerta">Alerta</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? "Carregando..." : `${filteredRows.length} item(ns)`}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Qtd atual</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última movimentação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    Nenhum ingrediente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((r) => (
                  <TableRow
                    key={r.ingredientId}
                    role="button"
                    onClick={() => openHistory(r.ingredientId)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{r.ingredientName}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell className="text-right">{formatQty(r.currentQty)}</TableCell>
                    <TableCell className="text-right">{formatQty(r.minQty)}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.lastMovementAt ? formatDateTime(r.lastMovementAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer: history */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-w-2xl mx-auto">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Box className="w-5 h-5" />
              {selectedRow ? selectedRow.ingredientName : "Movimentações"}
            </DrawerTitle>
            <DrawerDescription>
              Histórico de movimentações do ingrediente
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-5 space-y-3">
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma movimentação registrada.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((m) => (
                  <div key={m.id} className="rounded-xl border bg-card p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {m.type === "entrada" ? <ArrowUpCircle className="w-4 h-4 text-emerald-600" /> : m.type === "saida" ? <ArrowDownCircle className="w-4 h-4 text-amber-600" /> : <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-sm font-semibold">
                          {m.type === "entrada" ? "Entrada" : m.type === "saida" ? "Saída" : "Ajuste"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {m.quantity >= 0 ? `+${formatQty(m.quantity)}` : formatQty(m.quantity)}
                        </Badge>
                      </div>
                      {m.reason && <p className="text-xs text-muted-foreground mt-1 truncate">{m.reason}</p>}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Dialog: entrada */}
      <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrada</DialogTitle>
            <DialogDescription>
              Selecione o ingrediente, quantidade e (opcionalmente) o fornecedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ingrediente</Label>
              <Select value={entradaIngredientId} onValueChange={setEntradaIngredientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredientOptions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input value={entradaQty} onChange={(e) => setEntradaQty(e.target.value)} placeholder="Ex: 5" inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={entradaSupplierId} onValueChange={setEntradaSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={suppliersLoading ? "Carregando..." : "Opcional"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem fornecedor</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEntradaOpen(false)}>Cancelar</Button>
            <Button onClick={registerEntrada} className="gap-2">
              <ArrowUpCircle className="w-4 h-4" />
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: ajuste */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de Inventário</DialogTitle>
            <DialogDescription>
              Corrija o saldo do ingrediente e informe o motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ingrediente</Label>
              <Select value={ajusteIngredientId} onValueChange={setAjusteIngredientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredientOptions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nova quantidade</Label>
              <Input value={ajusteNewQty} onChange={(e) => setAjusteNewQty(e.target.value)} placeholder="Ex: 12" inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={ajusteReason} onChange={(e) => setAjusteReason(e.target.value)} placeholder="Ex: contagem de estoque / perda / ajuste de cadastro" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={registerAjuste} className="gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Aplicar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

