import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Save, TrendingDown, DollarSign, Percent, AlertTriangle,
  CheckCircle2, Info, Package, Eye, Calculator, BarChart3, List, Settings,
  ChevronRight, Search, ArrowUpDown, X, Sparkles
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  created_at: string;
}

interface RecipeItem {
  id?: string;
  product_id: string;
  ingredient_id: string;
  quantity_used: number;
  waste_factor: number;
  recipe_unit?: string; // unit chosen by admin in recipe (may differ from ingredient base unit)
}

interface CMVSettings {
  optimal_max: number;
  warning_max: number;
}

const UNITS = [
  { value: "kg", label: "Quilos (kg)" },
  { value: "g", label: "Gramas (g)" },
  { value: "L", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "un", label: "Unidade (un)" },
];

// All recipe units available for the admin to pick
const RECIPE_UNITS = ["g", "ml", "un"];

function getCompatibleUnits(_baseUnit: string): string[] {
  return RECIPE_UNITS;
}

// Convert quantity from recipeUnit to ingredientUnit (base unit)
function convertQuantity(qty: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return qty;
  // recipe in g, ingredient registered in kg
  if (fromUnit === "g" && toUnit === "kg") return qty / 1000;
  if (fromUnit === "kg" && toUnit === "g") return qty * 1000;
  // recipe in ml, ingredient registered in L
  if (fromUnit === "ml" && toUnit === "L") return qty / 1000;
  if (fromUnit === "L" && toUnit === "ml") return qty * 1000;
  // incompatible units (e.g. g→un) — no conversion, use as-is
  return qty;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getStatusInfo(cmv: number, settings: CMVSettings) {
  if (cmv <= settings.optimal_max) return { label: "Ótimo", color: "text-green-600 dark:text-green-400", bg: "bg-green-500", badgeCls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30", barColor: "bg-green-500" };
  if (cmv <= settings.warning_max) return { label: "Atenção", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500", badgeCls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30", barColor: "bg-yellow-500" };
  return { label: "Crítico", color: "text-red-600 dark:text-red-400", bg: "bg-red-500", badgeCls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", barColor: "bg-red-500" };
}

function StatusBadge({ cmv, settings }: { cmv: number; settings: CMVSettings }) {
  const info = getStatusInfo(cmv, settings);
  const Icon = cmv <= settings.optimal_max ? CheckCircle2 : cmv <= settings.warning_max ? AlertTriangle : TrendingDown;
  return <Badge className={`${info.badgeCls} gap-1`}><Icon className="w-3 h-3" />{info.label}</Badge>;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminCMV() {
  const { selectedRestaurantIds } = useRestaurantContext();
  const restaurantId = selectedRestaurantIds[0];
  const { toast } = useToast();

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [settings, setSettings] = useState<CMVSettings>({ optimal_max: 35, warning_max: 45 });
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState("overview");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("cmv-desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [recipeModalProduct, setRecipeModalProduct] = useState<Product | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<(RecipeItem & { ingredientName?: string })[]>([]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Ingredients management
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [savingIngredient, setSavingIngredient] = useState(false);

  // Settings
  const [savingSettings, setSavingSettings] = useState(false);
  const [editSettings, setEditSettings] = useState<CMVSettings>({ optimal_max: 35, warning_max: 45 });

  // Pricing
  const [pricingProductId, setPricingProductId] = useState<string>("");
  const [pricingCmvTarget, setPricingCmvTarget] = useState(30);
  const [pricingMargin, setPricingMargin] = useState(40);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    const [prodRes, catRes, ingRes, recRes, setRes] = await Promise.all([
      supabase.from("products").select("id, name, price, image_url, category_id, is_active").in("restaurant_id", selectedRestaurantIds).eq("is_active", true).order("name"),
      supabase.from("categories").select("id, name").in("restaurant_id", selectedRestaurantIds).eq("is_active", true).order("name"),
      supabase.from("ingredients").select("*").in("restaurant_id", selectedRestaurantIds).order("name"),
      supabase.from("recipe_items").select("*"),
      supabase.from("cmv_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (ingRes.data) setIngredients(ingRes.data.map((i: any) => ({ ...i, cost_per_unit: Number(i.cost_per_unit) })));

    // Filter recipe items to only include items for our products
    if (recRes.data && prodRes.data) {
      const productIds = new Set(prodRes.data.map((p: any) => p.id));
      setRecipeItems(recRes.data.filter((r: any) => productIds.has(r.product_id)).map((r: any) => ({
        ...r,
        quantity_used: Number(r.quantity_used),
        waste_factor: Number(r.waste_factor),
      })));
    }

    if (setRes.data) {
      const s = { optimal_max: Number(setRes.data.optimal_max), warning_max: Number(setRes.data.warning_max) };
      setSettings(s);
      setEditSettings(s);
    }

    setLoading(false);
  }, [restaurantId, selectedRestaurantIds]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── CMV Calculations ─────────────────────────────────────────────────────

  const ingredientMap = useMemo(() => {
    const map: Record<string, Ingredient> = {};
    ingredients.forEach(i => { map[i.id] = i; });
    return map;
  }, [ingredients]);

  const productRecipes = useMemo(() => {
    const map: Record<string, RecipeItem[]> = {};
    recipeItems.forEach(r => {
      if (!map[r.product_id]) map[r.product_id] = [];
      map[r.product_id].push(r);
    });
    return map;
  }, [recipeItems]);

  function getProductCost(productId: string): number {
    const items = productRecipes[productId] || [];
    return items.reduce((sum, r) => {
      const ing = ingredientMap[r.ingredient_id];
      if (!ing) return sum;
      const recipeUnit = r.recipe_unit || ing.unit;
      const convertedQty = convertQuantity(r.quantity_used, recipeUnit, ing.unit);
      return sum + convertedQty * r.waste_factor * ing.cost_per_unit;
    }, 0);
  }

  function getProductCMV(product: Product): number {
    if (product.price <= 0) return 0;
    return (getProductCost(product.id) / product.price) * 100;
  }

  function hasRecipe(productId: string): boolean {
    return (productRecipes[productId] || []).length > 0;
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const withRecipe = products.filter(p => hasRecipe(p.id));
    if (withRecipe.length === 0) return { avgCmv: 0, total: 0, optimal: 0, warning: 0, critical: 0 };

    let totalWeightedCmv = 0, totalRevenue = 0, optimal = 0, warning = 0, critical = 0;
    withRecipe.forEach(p => {
      const cmv = getProductCMV(p);
      const cost = getProductCost(p.id);
      totalWeightedCmv += cost;
      totalRevenue += p.price;
      if (cmv <= settings.optimal_max) optimal++;
      else if (cmv <= settings.warning_max) warning++;
      else critical++;
    });

    return {
      avgCmv: totalRevenue > 0 ? (totalWeightedCmv / totalRevenue) * 100 : 0,
      total: withRecipe.length,
      optimal, warning, critical,
    };
  }, [products, recipeItems, ingredients, settings]);

  // ─── Category CMV for chart ────────────────────────────────────────────────

  const categoryCMV = useMemo(() => {
    const catMap: Record<string, { totalCost: number; totalRevenue: number; name: string }> = {};

    products.filter(p => hasRecipe(p.id)).forEach(p => {
      const catId = p.category_id || "sem-categoria";
      const catName = categories.find(c => c.id === p.category_id)?.name || "Sem Categoria";
      if (!catMap[catId]) catMap[catId] = { totalCost: 0, totalRevenue: 0, name: catName };
      catMap[catId].totalCost += getProductCost(p.id);
      catMap[catId].totalRevenue += p.price;
    });

    return Object.entries(catMap)
      .map(([id, data]) => ({
        id,
        name: data.name,
        cmv: data.totalRevenue > 0 ? (data.totalCost / data.totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.cmv - a.cmv);
  }, [products, recipeItems, ingredients, categories]);

  // ─── Filtered & sorted products ────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (categoryFilter !== "all") list = list.filter(p => p.category_id === categoryFilter);
    if (searchQuery) list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    list.sort((a, b) => {
      switch (sortBy) {
        case "cmv-desc": return getProductCMV(b) - getProductCMV(a);
        case "cmv-asc": return getProductCMV(a) - getProductCMV(b);
        case "name": return a.name.localeCompare(b.name);
        case "cost": return getProductCost(b.id) - getProductCost(a.id);
        default: return 0;
      }
    });

    // Products with recipe first, then without
    const withRecipe = list.filter(p => hasRecipe(p.id));
    const withoutRecipe = list.filter(p => !hasRecipe(p.id));
    return [...withRecipe, ...withoutRecipe];
  }, [products, categoryFilter, searchQuery, sortBy, recipeItems, ingredients]);

  // ─── Recipe Modal ──────────────────────────────────────────────────────────

  function openRecipeModal(product: Product) {
    setRecipeModalProduct(product);
    const existing = productRecipes[product.id] || [];
    if (existing.length > 0) {
      setEditingRecipe(existing.map(r => ({
        ...r,
        recipe_unit: r.recipe_unit || ingredientMap[r.ingredient_id]?.unit || "g",
      })));
    } else {
      setEditingRecipe([{ product_id: product.id, ingredient_id: "", quantity_used: 0, waste_factor: 1.0, recipe_unit: "g" }]);
    }
  }

  function addRecipeRow() {
    setEditingRecipe(prev => [...prev, {
      product_id: recipeModalProduct!.id,
      ingredient_id: "",
      quantity_used: 0,
      waste_factor: 1.0,
      recipe_unit: "g",
    }]);
  }

  function removeRecipeRow(index: number) {
    setEditingRecipe(prev => prev.filter((_, i) => i !== index));
  }

  function updateRecipeRow(index: number, field: string, value: any) {
    setEditingRecipe(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, [field]: value };
      // When ingredient changes, set recipe_unit to the ingredient's base unit
      if (field === "ingredient_id") {
        const ing = ingredientMap[value];
        if (ing) updated.recipe_unit = ing.unit;
      }
      return updated;
    }));
  }

  const editingRecipeCost = editingRecipe.reduce((sum, r) => {
    const ing = ingredientMap[r.ingredient_id];
    if (!ing) return sum;
    const recipeUnit = r.recipe_unit || ing.unit;
    const convertedQty = convertQuantity(Number(r.quantity_used), recipeUnit, ing.unit);
    return sum + convertedQty * Number(r.waste_factor) * ing.cost_per_unit;
  }, 0);

  const editingRecipeCMV = recipeModalProduct && recipeModalProduct.price > 0
    ? (editingRecipeCost / recipeModalProduct.price) * 100
    : 0;

  async function saveRecipe() {
    if (!recipeModalProduct) return;
    setSavingRecipe(true);

    // Delete existing recipe items for this product
    await supabase.from("recipe_items").delete().eq("product_id", recipeModalProduct.id);

    // Insert new items (filter valid ones)
    const validItems = editingRecipe.filter(r => r.ingredient_id && r.quantity_used > 0);
    if (validItems.length > 0) {
      const toInsert = validItems.map(r => {
        const ing = ingredientMap[r.ingredient_id];
        const recipeUnit = r.recipe_unit || ing?.unit || "g";
        return {
          product_id: r.product_id,
          ingredient_id: r.ingredient_id,
          quantity_used: Number(r.quantity_used), // stored as-entered (in recipe_unit)
          waste_factor: Math.max(1, Number(r.waste_factor)),
          recipe_unit: recipeUnit,
        };
      });
      const { error } = await supabase.from("recipe_items").insert(toInsert);
      if (error) {
        toast({ title: "Erro ao salvar ficha técnica", description: error.message, variant: "destructive" });
        setSavingRecipe(false);
        return;
      }
    }

    toast({ title: "Ficha técnica salva com sucesso!" });
    setRecipeModalProduct(null);
    setSavingRecipe(false);
    loadData();
  }

  // ─── Ingredient CRUD ──────────────────────────────────────────────────────

  async function saveIngredient() {
    if (!editingIngredient?.name?.trim()) return;
    setSavingIngredient(true);

    if (editingIngredient.id) {
      const { error } = await supabase.from("ingredients").update({
        name: editingIngredient.name.trim(),
        unit: editingIngredient.unit || "g",
        cost_per_unit: Number(editingIngredient.cost_per_unit) || 0,
        updated_at: new Date().toISOString(),
      }).eq("id", editingIngredient.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Ingrediente atualizado!" }); }
    } else {
      const { error } = await supabase.from("ingredients").insert({
        restaurant_id: restaurantId,
        name: editingIngredient.name.trim(),
        unit: editingIngredient.unit || "g",
        cost_per_unit: Number(editingIngredient.cost_per_unit) || 0,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Ingrediente cadastrado!" }); }
    }

    setSavingIngredient(false);
    setEditingIngredient(null);
    loadData();
  }

  async function deleteIngredient(id: string) {
    // Check if ingredient is used in any recipe
    const usedIn = recipeItems.filter(r => r.ingredient_id === id);
    if (usedIn.length > 0) {
      toast({
        title: "Ingrediente em uso",
        description: `Este ingrediente está sendo usado em ${usedIn.length} ficha(s) técnica(s). Remova-o das fichas antes de excluir.`,
        variant: "destructive",
      });
      return;
    }
    await supabase.from("ingredients").delete().eq("id", id);
    toast({ title: "Ingrediente excluído!" });
    loadData();
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  async function saveSettingsHandler() {
    setSavingSettings(true);
    const { error } = await supabase.from("cmv_settings").upsert({
      restaurant_id: restaurantId,
      optimal_max: editSettings.optimal_max,
      warning_max: editSettings.warning_max,
      target_cmv_percent: editSettings.optimal_max,
      fixed_costs_monthly: 0,
      packaging_cost_default: 0,
    }, { onConflict: "restaurant_id" });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSettings(editSettings);
      toast({ title: "Configurações salvas!" });
    }
    setSavingSettings(false);
  }

  // ─── Pricing calculations ─────────────────────────────────────────────────

  const pricingProduct = products.find(p => p.id === pricingProductId);
  const pricingCost = pricingProductId ? getProductCost(pricingProductId) : 0;

  const priceByCmv = pricingCmvTarget > 0 ? pricingCost / (pricingCmvTarget / 100) : 0;
  const priceByMargin = pricingMargin < 100 ? pricingCost / (1 - pricingMargin / 100) : 0;
  const smartPrice = pricingCost * 3.5;

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-8 bg-muted rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">CMV — Custo da Mercadoria Vendida</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie custos de produção, fichas técnicas e precificação dos seus produtos.
          </p>
        </div>
        <Button variant="outline" onClick={() => setIngredientModalOpen(true)} className="gap-2">
          <List className="w-4 h-4" /> Ingredientes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Por Produto</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><Calculator className="w-3.5 h-3.5" /> Precificação</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SUB-ABA 1: VISÃO GERAL                                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Percent className="w-3.5 h-3.5" /> CMV Médio
                </div>
                <p className={`text-2xl font-bold ${summary.total > 0 ? getStatusInfo(summary.avgCmv, settings).color : 'text-muted-foreground'}`}>
                  {summary.total > 0 ? `${summary.avgCmv.toFixed(1)}%` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">{summary.total} produto(s) com ficha técnica</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Ótimos
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.optimal}</p>
                <p className="text-[10px] text-muted-foreground">CMV ≤ {settings.optimal_max}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Atenção
                </div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.warning}</p>
                <p className="text-[10px] text-muted-foreground">CMV {settings.optimal_max}–{settings.warning_max}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Críticos
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.critical}</p>
                <p className="text-[10px] text-muted-foreground">CMV &gt; {settings.warning_max}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Category CMV Chart */}
          {categoryCMV.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">% CMV por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryCMV.map(cat => {
                  const status = getStatusInfo(cat.cmv, settings);
                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.name}</span>
                        <span className={`font-bold ${status.color}`}>{cat.cmv.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${status.barColor}`}
                          style={{ width: `${Math.min(cat.cmv, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Legend */}
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground border-t mt-4">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" /> Ótimo (≤ {settings.optimal_max}%)</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Atenção ({settings.optimal_max}–{settings.warning_max}%)</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /> Crítico (&gt; {settings.warning_max}%)</div>
                </div>
              </CardContent>
            </Card>
          )}

          {summary.total === 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-6 px-4 flex flex-col items-center gap-3 text-center">
                <Info className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold text-lg">Comece cadastrando seus ingredientes</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cadastre os ingredientes que você utiliza, depois crie as fichas técnicas de cada produto para visualizar o CMV.
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={() => setIngredientModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Cadastrar Ingredientes
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("products")}>
                    Ver Produtos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings inline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" /> Faixas de Referência</CardTitle>
              <CardDescription>Configure os limites de CMV para classificar seus produtos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>% CMV máximo para "Ótimo"</Label>
                  <Input
                    type="number" min={5} max={90}
                    value={editSettings.optimal_max}
                    onChange={e => setEditSettings(s => ({ ...s, optimal_max: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>% CMV máximo para "Atenção"</Label>
                  <Input
                    type="number" min={editSettings.optimal_max + 1} max={95}
                    value={editSettings.warning_max}
                    onChange={e => setEditSettings(s => ({ ...s, warning_max: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Visual preview */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prévia das faixas</Label>
                <div className="flex h-6 rounded-full overflow-hidden">
                  <div className="bg-green-500 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${editSettings.optimal_max}%` }}>
                    0–{editSettings.optimal_max}%
                  </div>
                  <div className="bg-yellow-500 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${editSettings.warning_max - editSettings.optimal_max}%` }}>
                    {editSettings.optimal_max}–{editSettings.warning_max}%
                  </div>
                  <div className="bg-red-500 flex items-center justify-center text-[10px] text-white font-bold flex-1">
                    &gt;{editSettings.warning_max}%
                  </div>
                </div>
              </div>

              <Button onClick={saveSettingsHandler} disabled={savingSettings} size="sm" className="gap-2">
                <Save className="w-4 h-4" /> {savingSettings ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SUB-ABA 2: CMV POR PRODUTO                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="products" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]"><ArrowUpDown className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cmv-desc">Maior CMV</SelectItem>
                <SelectItem value="cmv-asc">Menor CMV</SelectItem>
                <SelectItem value="name">Nome (A-Z)</SelectItem>
                <SelectItem value="cost">Maior custo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Preço Venda</TableHead>
                    <TableHead className="text-center w-[200px]">% CMV</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => {
                    const hasR = hasRecipe(product.id);
                    const cost = getProductCost(product.id);
                    const cmv = getProductCMV(product);
                    const catName = categories.find(c => c.id === product.category_id)?.name;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-sm">{product.name}</span>
                              {catName && <p className="text-[11px] text-muted-foreground">{catName}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {hasR ? <span className="font-medium">{formatCurrency(cost)}</span> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(product.price)}</TableCell>
                        <TableCell>
                          {hasR ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${getStatusInfo(cmv, settings).barColor}`}
                                  style={{ width: `${Math.min(cmv, 100)}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold min-w-[50px] text-right ${getStatusInfo(cmv, settings).color}`}>
                                {cmv.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs text-center block">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasR ? <StatusBadge cmv={cmv} settings={settings} /> : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">Sem ficha</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {hasR ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRecipeModal(product)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver ficha</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPricingProductId(product.id); setActiveTab("pricing"); }}>
                                      <Calculator className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Precificar</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => openRecipeModal(product)}>
                                <Plus className="w-3 h-3" /> Cadastrar ficha
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SUB-ABA 3: PRECIFICAÇÃO                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="pricing" className="space-y-6">
          {/* Product selector */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-semibold">Selecione o produto</Label>
                <Select value={pricingProductId} onValueChange={setPricingProductId}>
                  <SelectTrigger><SelectValue placeholder="Escolha um produto com ficha técnica" /></SelectTrigger>
                  <SelectContent>
                    {products.filter(p => hasRecipe(p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pricingProduct && (
                <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Custo por porção (calculado da ficha técnica)</p>
                    <p className="text-xl font-bold">{formatCurrency(pricingCost)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Preço atual de venda</p>
                    <p className="text-xl font-bold">{formatCurrency(pricingProduct.price)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {pricingProduct && pricingCost > 0 && (
            <>
              {/* Simule a sua Precificação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Simule a sua Precificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-sm">% CMV desejado</Label>
                        <span className="text-lg font-bold text-primary">{pricingCmvTarget}%</span>
                      </div>
                      <Slider
                        value={[pricingCmvTarget]}
                        onValueChange={([v]) => setPricingCmvTarget(v)}
                        min={20} max={50} step={1}
                      />
                      <p className="text-xs text-muted-foreground">Quanto menor, maior a margem.</p>
                      <div className="bg-muted/50 rounded-xl p-4 text-center mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Preço pelo CMV ({pricingCmvTarget}%)</p>
                        <p className="text-2xl font-bold">{formatCurrency(priceByCmv)}</p>
                        <PriceComparison currentPrice={pricingProduct.price} suggestedPrice={priceByCmv} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-sm">Margem de lucro</Label>
                        <span className="text-lg font-bold text-primary">{pricingMargin}%</span>
                      </div>
                      <Slider
                        value={[pricingMargin]}
                        onValueChange={([v]) => setPricingMargin(v)}
                        min={10} max={70} step={1}
                      />
                      <p className="text-xs text-muted-foreground">Percentual de lucro sobre o preço de venda.</p>
                      <div className="bg-muted/50 rounded-xl p-4 text-center mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Preço pela margem ({pricingMargin}%)</p>
                        <p className="text-2xl font-bold">{formatCurrency(priceByMargin)}</p>
                        <PriceComparison currentPrice={pricingProduct.price} suggestedPrice={priceByMargin} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preço Sugerido - destaque verde compacto */}
              <Card className="bg-green-600 dark:bg-green-700 border-0 shadow-lg max-w-md mx-auto w-full">
                <CardContent className="py-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-white/90" />
                    <p className="text-sm font-semibold text-white/90">Preço Sugerido</p>
                  </div>
                  <p className="text-4xl font-bold text-white">{formatCurrency(smartPrice)}</p>
                  <div className="mt-1.5">
                    {(() => {
                      const diff = smartPrice - pricingProduct.price;
                      if (Math.abs(diff) < 0.01) return <p className="text-sm text-white/70">Igual ao preço atual</p>;
                      return (
                        <p className="text-sm text-white/80">
                          {diff > 0 ? "↑" : "↓"} {formatCurrency(Math.abs(diff))} {diff > 0 ? "acima" : "abaixo"} do atual
                        </p>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!pricingProductId && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calculator className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Selecione um produto com ficha técnica para calcular preços sugeridos.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: FICHA TÉCNICA                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!recipeModalProduct} onOpenChange={open => !open && setRecipeModalProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {recipeModalProduct?.image_url && (
                <img src={recipeModalProduct.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
              )}
              Ficha Técnica — {recipeModalProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Preço de venda: {recipeModalProduct ? formatCurrency(recipeModalProduct.price) : "—"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Live preview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Custo Total</p>
                <p className="text-lg font-bold">{formatCurrency(editingRecipeCost)}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">CMV</p>
                <p className={`text-lg font-bold ${editingRecipeCMV > 0 ? getStatusInfo(editingRecipeCMV, settings).color : ''}`}>
                  {editingRecipeCMV.toFixed(1)}%
                </p>
              </div>
            </div>

            {editingRecipeCMV > 0 && <StatusBadge cmv={editingRecipeCMV} settings={settings} />}

            {/* Ingredients list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Ingredientes da receita</Label>
                <Button variant="outline" size="sm" onClick={addRecipeRow} className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </Button>
              </div>

              {ingredients.length === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Você precisa <button className="underline font-medium" onClick={() => { setRecipeModalProduct(null); setIngredientModalOpen(true); }}>cadastrar ingredientes</button> antes de criar fichas técnicas.</p>
                </div>
              )}

              {editingRecipe.map((item, index) => {
                const ing = ingredientMap[item.ingredient_id];
                const recipeUnit = item.recipe_unit || ing?.unit || "g";
                const convertedQty = ing ? convertQuantity(Number(item.quantity_used), recipeUnit, ing.unit) : 0;
                const itemCost = ing ? convertedQty * Number(item.waste_factor) * ing.cost_per_unit : 0;
                const compatibleUnits = ing ? getCompatibleUnits(ing.unit) : UNITS.map(u => u.value);

                return (
                  <div key={index} className="grid grid-cols-[1fr_80px_70px_80px_70px_36px] gap-2 items-end">
                    <div>
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Ingrediente</Label>}
                      <Select value={item.ingredient_id} onValueChange={v => updateRecipeRow(index, "ingredient_id", v)}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {ingredients.map(i => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} ({formatCurrency(i.cost_per_unit)}/{i.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Qtd</Label>}
                      <Input
                        type="number" min={0} step={0.01}
                        value={item.quantity_used || ""}
                        onChange={e => updateRecipeRow(index, "quantity_used", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unid.</Label>}
                      <Select value={recipeUnit} onValueChange={v => updateRecipeRow(index, "recipe_unit", v)}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {compatibleUnits.map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {index === 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1 cursor-help">
                              Perda <Info className="w-3 h-3" />
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px]">
                            Fator de perda no preparo. Ex: 1.10 = 10% de perda. Mínimo: 1.00 (sem perda).
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Input
                        type="number" min={1} step={0.01}
                        value={item.waste_factor || ""}
                        onChange={e => updateRecipeRow(index, "waste_factor", Math.max(1, Number(e.target.value)))}
                      />
                    </div>
                    <div>
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Custo</Label>}
                      <div className="h-10 flex items-center justify-end text-sm font-medium text-muted-foreground">
                        {ing ? formatCurrency(itemCost) : "—"}
                      </div>
                    </div>
                    <div>
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">&nbsp;</Label>}
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" onClick={() => removeRecipeRow(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipeModalProduct(null)}>Cancelar</Button>
            <Button onClick={saveRecipe} disabled={savingRecipe} className="gap-2">
              <Save className="w-4 h-4" /> {savingRecipe ? "Salvando..." : "Salvar Ficha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: INGREDIENTES                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={ingredientModalOpen} onOpenChange={setIngredientModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastro de Ingredientes</DialogTitle>
            <DialogDescription>Gerencie os ingredientes disponíveis para as fichas técnicas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* New/Edit form */}
            {editingIngredient !== null ? (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <p className="font-semibold text-sm">{editingIngredient.id ? "Editar" : "Novo"} Ingrediente</p>
                  <div className="grid grid-cols-[1fr_120px_120px] gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        placeholder="Ex: Filé mignon"
                        value={editingIngredient.name || ""}
                        onChange={e => setEditingIngredient(prev => ({ ...prev!, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unidade</Label>
                      <Select
                        value={editingIngredient.unit || "g"}
                        onValueChange={v => setEditingIngredient(prev => ({ ...prev!, unit: v }))}
                      >
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">R$ / unidade</Label>
                      <Input
                        type="number" min={0} step={0.01}
                        value={editingIngredient.cost_per_unit || ""}
                        onChange={e => setEditingIngredient(prev => ({ ...prev!, cost_per_unit: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingIngredient(null)}>Cancelar</Button>
                    <Button size="sm" onClick={saveIngredient} disabled={savingIngredient} className="gap-1.5">
                      <Save className="w-3.5 h-3.5" /> {savingIngredient ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" onClick={() => setEditingIngredient({ unit: "g", cost_per_unit: 0 })} className="gap-2 w-full">
                <Plus className="w-4 h-4" /> Novo Ingrediente
              </Button>
            )}

            {/* List */}
            {ingredients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Custo/un</TableHead>
                    <TableHead className="text-center w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map(ing => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.name}</TableCell>
                      <TableCell>{ing.unit}</TableCell>
                      <TableCell className="text-right">{formatCurrency(ing.cost_per_unit)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingIngredient({ ...ing })}>
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteIngredient(ing.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum ingrediente cadastrado. Clique em "Novo Ingrediente" para começar.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PriceComparison({ currentPrice, suggestedPrice }: { currentPrice: number; suggestedPrice: number }) {
  const diff = suggestedPrice - currentPrice;
  if (Math.abs(diff) < 0.01) return <p className="text-xs text-muted-foreground mt-1">= preço atual</p>;
  return (
    <p className={`text-xs mt-1 ${diff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
      {diff > 0 ? `↑ ${formatCurrency(diff)} acima do atual` : `↓ ${formatCurrency(Math.abs(diff))} abaixo do atual`}
    </p>
  );
}
