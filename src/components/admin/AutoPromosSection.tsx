import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Zap,
  ShoppingCart,
  DollarSign,
  Package,
  Tag,
  Truck,
  Percent,
  Gift,
} from "lucide-react";

interface AutoPromo {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: number;
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  benefit_type: string;
  benefit_value: number | null;
  benefit_product_id: string | null;
  is_active: boolean;
  show_in_menu: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Category {
  id: string;
  name: string;
}

interface AutoPromosSectionProps {
  restaurantId: string;
}

const TRIGGER_LABELS: Record<string, { label: string; icon: typeof ShoppingCart; description: string }> = {
  min_items: { label: "Qtd mínima de itens", icon: ShoppingCart, description: "Ativada quando o carrinho atinge X itens" },
  min_value: { label: "Valor mínimo do pedido", icon: DollarSign, description: "Ativada quando o subtotal atinge R$ X" },
  specific_product: { label: "Produto específico", icon: Package, description: "Ativada quando um produto específico está no carrinho" },
  specific_category: { label: "Categoria específica", icon: Tag, description: "Ativada quando há X itens de uma categoria" },
};

const BENEFIT_LABELS: Record<string, { label: string; icon: typeof Truck }> = {
  free_shipping: { label: "Frete grátis", icon: Truck },
  percentage_discount: { label: "Desconto %", icon: Percent },
  fixed_discount: { label: "Desconto R$ fixo", icon: DollarSign },
  free_product: { label: "Produto grátis", icon: Gift },
};

const emptyForm = {
  name: "",
  description: "",
  trigger_type: "min_items",
  trigger_value: 3,
  trigger_product_id: "",
  trigger_category_id: "",
  benefit_type: "free_shipping",
  benefit_value: 0,
  benefit_product_id: "",
  is_active: true,
  show_in_menu: true,
};

export function AutoPromosSection({ restaurantId }: AutoPromosSectionProps) {
  const [promos, setPromos] = useState<AutoPromo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchAll();
  }, [restaurantId]);

  async function fetchAll() {
    setLoading(true);
    const [promosRes, productsRes, categoriesRes] = await Promise.all([
      supabase
        .from("auto_promos")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("products")
        .select("id, name, price")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("name"),
    ]);
    if (promosRes.data) setPromos(promosRes.data as any);
    if (productsRes.data) setProducts(productsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(promo: AutoPromo) {
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      description: promo.description || "",
      trigger_type: promo.trigger_type,
      trigger_value: promo.trigger_value,
      trigger_product_id: promo.trigger_product_id || "",
      trigger_category_id: promo.trigger_category_id || "",
      benefit_type: promo.benefit_type,
      benefit_value: promo.benefit_value || 0,
      benefit_product_id: promo.benefit_product_id || "",
      is_active: promo.is_active,
      show_in_menu: promo.show_in_menu,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (form.trigger_type === "specific_product" && !form.trigger_product_id) {
      toast.error("Selecione o produto gatilho");
      return;
    }
    if (form.trigger_type === "specific_category" && !form.trigger_category_id) {
      toast.error("Selecione a categoria gatilho");
      return;
    }
    if (form.benefit_type === "free_product" && !form.benefit_product_id) {
      toast.error("Selecione o produto brinde");
      return;
    }
    if ((form.benefit_type === "percentage_discount" || form.benefit_type === "fixed_discount") && !form.benefit_value) {
      toast.error("Informe o valor do desconto");
      return;
    }

    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      trigger_type: form.trigger_type,
      trigger_value: form.trigger_value,
      trigger_product_id: form.trigger_product_id || null,
      trigger_category_id: form.trigger_category_id || null,
      benefit_type: form.benefit_type,
      benefit_value: form.benefit_value || null,
      benefit_product_id: form.benefit_product_id || null,
      is_active: form.is_active,
      show_in_menu: form.show_in_menu,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("auto_promos").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("auto_promos").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(editingId ? "Promo atualizada!" : "Promo criada!");
    setDialogOpen(false);
    fetchAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta promo automática?")) return;
    const { error } = await supabase.from("auto_promos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluída!");
    fetchAll();
  }

  async function handleToggle(id: string, active: boolean) {
    await supabase.from("auto_promos").update({ is_active: active }).eq("id", id);
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: active } : p)));
  }

  function getTriggerSummary(p: AutoPromo) {
    switch (p.trigger_type) {
      case "min_items": return `${p.trigger_value} itens no carrinho`;
      case "min_value": return `Pedido ≥ R$ ${Number(p.trigger_value).toFixed(2).replace(".", ",")}`;
      case "specific_product": {
        const prod = products.find((pr) => pr.id === p.trigger_product_id);
        return `Produto: ${prod?.name || "—"}`;
      }
      case "specific_category": {
        const cat = categories.find((c) => c.id === p.trigger_category_id);
        return `${p.trigger_value} itens de "${cat?.name || "—"}"`;
      }
      default: return "";
    }
  }

  function getBenefitSummary(p: AutoPromo) {
    switch (p.benefit_type) {
      case "free_shipping": return "Frete grátis";
      case "percentage_discount": return `${p.benefit_value}% de desconto`;
      case "fixed_discount": return `R$ ${Number(p.benefit_value).toFixed(2).replace(".", ",")} de desconto`;
      case "free_product": {
        const prod = products.find((pr) => pr.id === p.benefit_product_id);
        return `Brinde: ${prod?.name || "—"}`;
      }
      default: return "";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Promos Automáticas
          </h2>
          <p className="text-sm text-muted-foreground">
            Benefícios aplicados automaticamente com base no carrinho do cliente
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nova Regra
        </Button>
      </div>

      {promos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhuma promo automática configurada.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Crie regras como "frete grátis acima de 3 itens" ou "10% OFF acima de R$50".
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map((promo) => {
            const TriggerIcon = TRIGGER_LABELS[promo.trigger_type]?.icon || Zap;
            const BenefitIcon = BENEFIT_LABELS[promo.benefit_type]?.icon || Gift;

            return (
              <Card key={promo.id} className={!promo.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{promo.name}</h3>
                        <Badge variant={promo.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {promo.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>

                      {promo.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{promo.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-lg px-2.5 py-1.5">
                          <TriggerIcon className="w-3.5 h-3.5 text-primary" />
                          <span className="text-muted-foreground">Se:</span>
                          <span className="font-medium">{getTriggerSummary(promo)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs bg-primary/10 rounded-lg px-2.5 py-1.5">
                          <BenefitIcon className="w-3.5 h-3.5 text-primary" />
                          <span className="text-muted-foreground">Então:</span>
                          <span className="font-medium text-primary">{getBenefitSummary(promo)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={promo.is_active}
                        onCheckedChange={(v) => handleToggle(promo.id, v)}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(promo)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(promo.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Promo Automática" : "Nova Promo Automática"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Frete grátis acima de 3 itens"
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Mensagem exibida ao cliente quando a promo é ativada"
                  rows={2}
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Condição (Gatilho)
              </h3>

              <div>
                <Label>Tipo de condição</Label>
                <Select
                  value={form.trigger_type}
                  onValueChange={(v) => setForm({ ...form, trigger_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {TRIGGER_LABELS[form.trigger_type]?.description}
                </p>
              </div>

              {(form.trigger_type === "min_items" || form.trigger_type === "min_value" || form.trigger_type === "specific_category") && (
                <div>
                  <Label>
                    {form.trigger_type === "min_value" ? "Valor mínimo (R$)" : "Quantidade mínima"}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.trigger_value}
                    onChange={(e) => setForm({ ...form, trigger_value: Number(e.target.value) })}
                  />
                </div>
              )}

              {form.trigger_type === "specific_product" && (
                <div>
                  <Label>Produto</Label>
                  <Select
                    value={form.trigger_product_id}
                    onValueChange={(v) => setForm({ ...form, trigger_product_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.trigger_type === "specific_category" && (
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={form.trigger_category_id}
                    onValueChange={(v) => setForm({ ...form, trigger_category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Benefit */}
            <div className="space-y-3 p-3 rounded-lg border bg-primary/5">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />
                Benefício
              </h3>

              <div>
                <Label>Tipo de benefício</Label>
                <Select
                  value={form.benefit_type}
                  onValueChange={(v) => setForm({ ...form, benefit_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BENEFIT_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.benefit_type === "percentage_discount" && (
                <div>
                  <Label>Porcentagem de desconto (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.benefit_value}
                    onChange={(e) => setForm({ ...form, benefit_value: Number(e.target.value) })}
                  />
                </div>
              )}

              {form.benefit_type === "fixed_discount" && (
                <div>
                  <Label>Valor do desconto (R$)</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={form.benefit_value}
                    onChange={(e) => setForm({ ...form, benefit_value: Number(e.target.value) })}
                  />
                </div>
              )}

              {form.benefit_type === "free_product" && (
                <div>
                  <Label>Produto brinde</Label>
                  <Select
                    value={form.benefit_product_id}
                    onValueChange={(v) => setForm({ ...form, benefit_product_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto brinde" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — R$ {p.price.toFixed(2).replace(".", ",")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Exibir no cardápio</p>
                <p className="text-xs text-muted-foreground">Mostrar banner informativo ao cliente</p>
              </div>
              <Switch
                checked={form.show_in_menu}
                onCheckedChange={(v) => setForm({ ...form, show_in_menu: v })}
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Salvar Alterações" : "Criar Promo Automática"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
