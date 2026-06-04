import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Loader2,
  Clock,
  Calendar,
  Image as ImageIcon,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

interface Promo {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  promo_type: string;
  price: number | null;
  discount_value: number | null;
  discount_type: string | null;
  schedule_type: string;
  schedule_days: number[];
  schedule_start_date: string | null;
  schedule_end_date: string | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  is_active: boolean;
  show_in_menu: boolean;
  sort_order: number;
}

interface PromoItem {
  id: string;
  promo_id: string;
  product_id: string;
  group_name: string | null;
  max_choices: number;
  is_required: boolean;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

interface PromoKitsSectionProps {
  restaurantId: string;
}

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PROMO_TYPE_LABELS: Record<string, string> = {
  fixed_kit: "Kit Fixo",
  choice_kit: "Kit com Opções",
  auto_discount: "Desconto Automático",
};

export function PromoKitsSection({ restaurantId }: PromoKitsSectionProps) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; groupName: string; maxChoices: number }[]>([]);
  const { toast } = useToast();

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    image_url: "",
    promo_type: "fixed_kit",
    price: "",
    discount_value: "",
    discount_type: "percentage",
    schedule_type: "always",
    schedule_days: [] as number[],
    schedule_start_date: "",
    schedule_end_date: "",
    schedule_start_time: "",
    schedule_end_time: "",
    is_active: true,
    show_in_menu: true,
  });

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    const [promosRes, productsRes] = await Promise.all([
      supabase.from("promos").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
      supabase.from("products").select("id, name, price, image_url").eq("restaurant_id", restaurantId).eq("is_active", true).order("name"),
    ]);
    setPromos((promosRes.data as any[]) || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      name: "", description: "", image_url: "", promo_type: "fixed_kit",
      price: "", discount_value: "", discount_type: "percentage",
      schedule_type: "always", schedule_days: [],
      schedule_start_date: "", schedule_end_date: "",
      schedule_start_time: "", schedule_end_time: "",
      is_active: true, show_in_menu: true,
    });
    setSelectedProducts([]);
    setEditingPromo(null);
  };

  const openEdit = async (promo: Promo) => {
    setEditingPromo(promo);
    setForm({
      name: promo.name,
      description: promo.description || "",
      image_url: promo.image_url || "",
      promo_type: promo.promo_type,
      price: promo.price?.toString() || "",
      discount_value: promo.discount_value?.toString() || "",
      discount_type: promo.discount_type || "percentage",
      schedule_type: promo.schedule_type,
      schedule_days: promo.schedule_days || [],
      schedule_start_date: promo.schedule_start_date || "",
      schedule_end_date: promo.schedule_end_date || "",
      schedule_start_time: promo.schedule_start_time || "",
      schedule_end_time: promo.schedule_end_time || "",
      is_active: promo.is_active,
      show_in_menu: promo.show_in_menu,
    });

    // Load promo items
    const { data: items } = await supabase
      .from("promo_items")
      .select("*")
      .eq("promo_id", promo.id)
      .order("sort_order");

    setSelectedProducts(
      (items as any[] || []).map((i: PromoItem) => ({
        productId: i.product_id,
        groupName: i.group_name || "",
        maxChoices: i.max_choices || 1,
      }))
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Nome da promo é obrigatório", variant: "destructive" });
      return;
    }
    if (selectedProducts.length === 0) {
      toast({ title: "Erro", description: "Selecione ao menos um produto", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const promoData: any = {
        restaurant_id: restaurantId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        promo_type: form.promo_type,
        price: form.promo_type !== "auto_discount" && form.price ? parseFloat(form.price) : null,
        discount_value: form.promo_type === "auto_discount" && form.discount_value ? parseFloat(form.discount_value) : null,
        discount_type: form.promo_type === "auto_discount" ? form.discount_type : null,
        schedule_type: form.schedule_type,
        schedule_days: form.schedule_days,
        schedule_start_date: form.schedule_start_date || null,
        schedule_end_date: form.schedule_end_date || null,
        schedule_start_time: form.schedule_start_time || null,
        schedule_end_time: form.schedule_end_time || null,
        is_active: form.is_active,
        show_in_menu: form.show_in_menu,
      };

      let promoId: string;

      if (editingPromo) {
        const { error } = await supabase.from("promos").update(promoData).eq("id", editingPromo.id);
        if (error) throw error;
        promoId = editingPromo.id;
        // Clear existing items
        await supabase.from("promo_items").delete().eq("promo_id", promoId);
      } else {
        const { data, error } = await supabase.from("promos").insert(promoData).select("id").single();
        if (error) throw error;
        promoId = data.id;
      }

      // Insert promo items
      if (selectedProducts.length > 0) {
        const items = selectedProducts.map((sp, idx) => ({
          promo_id: promoId,
          product_id: sp.productId,
          group_name: sp.groupName || null,
          max_choices: sp.maxChoices || 1,
          sort_order: idx,
        }));
        const { error: itemsError } = await supabase.from("promo_items").insert(items);
        if (itemsError) throw itemsError;
      }

      toast({ title: editingPromo ? "Promo atualizada!" : "Promo criada!" });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta promo?")) return;
    await supabase.from("promo_items").delete().eq("promo_id", id);
    await supabase.from("promos").delete().eq("id", id);
    toast({ title: "Promo excluída!" });
    fetchData();
  };

  const handleToggleActive = async (promo: Promo) => {
    await supabase.from("promos").update({ is_active: !promo.is_active } as any).eq("id", promo.id);
    fetchData();
  };

  const handleToggleVisibility = async (promo: Promo) => {
    await supabase.from("promos").update({ show_in_menu: !promo.show_in_menu } as any).eq("id", promo.id);
    fetchData();
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      if (prev.some((p) => p.productId === productId)) {
        return prev.filter((p) => p.productId !== productId);
      }
      return [...prev, { productId, groupName: "", maxChoices: 1 }];
    });
  };

  const updateProductGroup = (productId: string, groupName: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, groupName } : p))
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `promos/${restaurantId}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("campaign-images").upload(filePath, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("campaign-images").getPublicUrl(filePath);
    setForm({ ...form, image_url: urlData.publicUrl });
  };

  const getScheduleLabel = (promo: Promo) => {
    if (promo.schedule_type === "always") return "Sempre ativo";
    const parts: string[] = [];
    if (promo.schedule_days?.length > 0) {
      parts.push(promo.schedule_days.map((d) => WEEKDAY_NAMES[d]).join(", "));
    }
    if (promo.schedule_start_time && promo.schedule_end_time) {
      parts.push(`${promo.schedule_start_time.slice(0, 5)} - ${promo.schedule_end_time.slice(0, 5)}`);
    }
    if (promo.schedule_start_date) {
      parts.push(`De ${promo.schedule_start_date}`);
    }
    if (promo.schedule_end_date) {
      parts.push(`até ${promo.schedule_end_date}`);
    }
    return parts.join(" • ") || "Agendado";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Kits & Promos</h2>
          <p className="text-muted-foreground text-sm">Crie combos, kits e promoções especiais</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Promo
        </Button>
      </div>

      {/* Promo list */}
      {promos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma promo cadastrada</p>
            <p className="text-sm text-muted-foreground mt-1">Crie sua primeira promo para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map((promo) => (
            <Card key={promo.id} className={!promo.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {promo.image_url ? (
                    <img src={promo.image_url} alt={promo.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg">{promo.name}</span>
                      <Badge variant="outline">{PROMO_TYPE_LABELS[promo.promo_type]}</Badge>
                      {!promo.is_active && <Badge variant="secondary">Inativo</Badge>}
                      {promo.is_active && !promo.show_in_menu && <Badge variant="outline">Oculto</Badge>}
                    </div>
                    {promo.description && (
                      <p className="text-sm text-muted-foreground truncate">{promo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {promo.promo_type !== "auto_discount" && promo.price != null && (
                        <span className="font-semibold text-primary">
                          R$ {Number(promo.price).toFixed(2).replace(".", ",")}
                        </span>
                      )}
                      {promo.promo_type === "auto_discount" && promo.discount_value != null && (
                        <span className="font-semibold text-primary">
                          {promo.discount_type === "percentage"
                            ? `${promo.discount_value}% OFF`
                            : `R$ ${Number(promo.discount_value).toFixed(2).replace(".", ",")} OFF`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {getScheduleLabel(promo)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleToggleVisibility(promo)} title={promo.show_in_menu ? "Ocultar do cardápio" : "Exibir no cardápio"}>
                      {promo.show_in_menu ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Switch checked={promo.is_active} onCheckedChange={() => handleToggleActive(promo)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(promo)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(promo.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo ? "Editar Promo" : "Nova Promo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Nome da promo *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Combo Família" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional da promo" rows={2} />
            </div>

            {/* Image */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Preview" className="w-20 h-20 rounded-lg object-cover" />
                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 w-6 h-6" onClick={() => setForm({ ...form, image_url: "" })}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            </div>

            {/* Promo Type */}
            <div className="space-y-2">
              <Label>Tipo da promo</Label>
              <Select value={form.promo_type} onValueChange={(v) => setForm({ ...form, promo_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_kit">Kit Fixo — produtos fixos, preço único</SelectItem>
                  <SelectItem value="choice_kit">Kit com Opções — cliente escolhe entre grupos</SelectItem>
                  <SelectItem value="auto_discount">Desconto Automático — desconto aplicado nos produtos selecionados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price or Discount */}
            {form.promo_type !== "auto_discount" ? (
              <div className="space-y-2">
                <Label>Preço do kit (R$) *</Label>
                <CurrencyInput value={typeof form.price === 'string' ? parseFloat(form.price) || 0 : form.price} onChange={(value) => setForm({ ...form, price: value })} placeholder="Ex: 49,90" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de desconto</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do desconto *</Label>
                  {form.discount_type === "fixed" ? (
                    <CurrencyInput value={typeof form.discount_value === 'string' ? parseFloat(form.discount_value) || 0 : form.discount_value} onChange={(value) => setForm({ ...form, discount_value: value })} placeholder="Ex: 10,00" />
                  ) : (
                    <Input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder="Ex: 15" />
                  )}
                </div>
              </div>
            )}

            {/* Product Selection */}
            <div className="space-y-2">
              <Label>Produtos inclusos *</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {products.map((product) => {
                  const isSelected = selectedProducts.some((p) => p.productId === product.id);
                  return (
                    <div key={product.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleProduct(product.id)} />
                      <span className="flex-1 text-sm">{product.name}</span>
                      <span className="text-xs text-muted-foreground">R$ {product.price.toFixed(2).replace(".", ",")}</span>
                      {form.promo_type === "choice_kit" && isSelected && (
                        <Input
                          className="w-32 h-7 text-xs"
                          placeholder="Grupo (ex: Burger)"
                          value={selectedProducts.find((p) => p.productId === product.id)?.groupName || ""}
                          onChange={(e) => updateProductGroup(product.id, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{selectedProducts.length} produto(s) selecionado(s)</p>
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <Label>Agendamento</Label>
              <Select value={form.schedule_type} onValueChange={(v) => setForm({ ...form, schedule_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Sempre ativo</SelectItem>
                  <SelectItem value="weekday">Dias da semana + horário</SelectItem>
                  <SelectItem value="specific_date">Data específica</SelectItem>
                  <SelectItem value="both">Dias da semana + Data específica</SelectItem>
                </SelectContent>
              </Select>

              {(form.schedule_type === "weekday" || form.schedule_type === "both") && (
                <div className="space-y-2">
                  <Label className="text-sm">Dias da semana</Label>
                  <div className="flex gap-2 flex-wrap">
                    {WEEKDAY_NAMES.map((day, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        size="sm"
                        variant={form.schedule_days.includes(idx) ? "default" : "outline"}
                        className="h-8 px-3"
                        onClick={() =>
                          setForm({
                            ...form,
                            schedule_days: form.schedule_days.includes(idx)
                              ? form.schedule_days.filter((d) => d !== idx)
                              : [...form.schedule_days, idx],
                          })
                        }
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {(form.schedule_type === "weekday" || form.schedule_type === "both") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Horário início</Label>
                    <Input type="time" value={form.schedule_start_time} onChange={(e) => setForm({ ...form, schedule_start_time: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Horário fim</Label>
                    <Input type="time" value={form.schedule_end_time} onChange={(e) => setForm({ ...form, schedule_end_time: e.target.value })} />
                  </div>
                </div>
              )}

              {(form.schedule_type === "specific_date" || form.schedule_type === "both") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Data início</Label>
                    <Input type="date" value={form.schedule_start_date} onChange={(e) => setForm({ ...form, schedule_start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Data fim</Label>
                    <Input type="date" value={form.schedule_end_date} onChange={(e) => setForm({ ...form, schedule_end_date: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Promo ativa</p>
                  <p className="text-sm text-muted-foreground">Desative para pausar a promo</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Exibir no cardápio</p>
                  <p className="text-sm text-muted-foreground">Mostrar na seção "Promos" do cardápio digital</p>
                </div>
                <Switch checked={form.show_in_menu} onCheckedChange={(checked) => setForm({ ...form, show_in_menu: checked })} />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" size="lg" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingPromo ? "Salvar Alterações" : "Criar Promo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
