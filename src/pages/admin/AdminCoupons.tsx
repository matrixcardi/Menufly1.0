import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromoKitsSection } from "@/components/admin/PromoKitsSection";
import { AutoPromosSection } from "@/components/admin/AutoPromosSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Tag, Percent, DollarSign, Users, Loader2, Truck, ShoppingBag, Receipt, CalendarIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  max_uses: number | null;
  max_uses_per_user: number | null;
  used_count: number;
  is_active: boolean;
  show_in_menu: boolean;
  expires_at: string | null;
  applies_to: string;
}

export default function AdminCoupons() {
  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = ctxSelectedId === "all" ? selectedRestaurantIds[0] : ctxSelectedId;
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Coupon form state
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    min_order: "0",
    max_uses: "",
    max_uses_per_user: "",
    applies_to: "total",
    is_active: true,
    show_in_menu: true,
    expires_at: null as Date | null,
  });

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!ctxRestaurantId) {
        setLoading(false);
        return;
      }

      setRestaurantId(ctxRestaurantId);

      const { data: couponsData } = await supabase
        .from("coupons")
        .select("*")
        .eq("restaurant_id", ctxRestaurantId)
        .order("created_at", { ascending: false });

      setCoupons(couponsData || []);
    } catch (error) {
      logger.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCoupon = async () => {
    if (!restaurantId || !couponForm.code.trim() || !couponForm.discount_value) {
      toast({ title: "Erro", description: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    setSaving(true);
    const couponData = {
      restaurant_id: restaurantId,
      code: couponForm.code.toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: parseFloat(couponForm.discount_value),
      min_order: parseFloat(couponForm.min_order) || 0,
      max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
      max_uses_per_user: couponForm.max_uses_per_user ? parseInt(couponForm.max_uses_per_user) : null,
      applies_to: couponForm.applies_to,
      is_active: couponForm.is_active,
      show_in_menu: couponForm.show_in_menu,
      expires_at: couponForm.expires_at ? couponForm.expires_at.toISOString() : null,
    } as any;

    try {
      if (editingCoupon) {
        const { error } = await supabase
          .from("coupons")
          .update(couponData)
          .eq("id", editingCoupon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(couponData);
        if (error) throw error;
      }
      toast({ title: editingCoupon ? "Cupom atualizado!" : "Cupom criado!" });
      setCouponDialogOpen(false);
      resetCouponForm();
      fetchData();
    } catch (error) {
      logger.error("Error saving coupon:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom?")) return;
    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Cupom excluído!" });
      fetchData();
    } catch (error) {
      logger.error("Error deleting coupon:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: !coupon.is_active })
        .eq("id", coupon.id);
      if (error) throw error;
      toast({ title: coupon.is_active ? "Cupom desativado" : "Cupom ativado" });
      fetchData();
    } catch (error) {
      logger.error("Error toggling coupon:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const resetCouponForm = () => {
    setCouponForm({
      code: "",
      discount_type: "percentage",
      discount_value: "",
      min_order: "0",
      max_uses: "",
      max_uses_per_user: "",
      applies_to: "total",
      is_active: true,
      show_in_menu: true,
      expires_at: null,
    });
    setEditingCoupon(null);
  };

  const openEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      min_order: coupon.min_order.toString(),
      max_uses: coupon.max_uses?.toString() || "",
      max_uses_per_user: coupon.max_uses_per_user?.toString() || "",
      applies_to: coupon.applies_to || "total",
      is_active: coupon.is_active,
      show_in_menu: coupon.show_in_menu ?? true,
      expires_at: coupon.expires_at ? new Date(coupon.expires_at) : null,
    });
    setCouponDialogOpen(true);
  };

  // Calculate stats
  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const totalUsage = coupons.reduce((acc, c) => acc + c.used_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promos & Cupons</h1>
        <p className="text-muted-foreground">
          Gerencie promoções, kits e cupons de desconto
        </p>
      </div>

      <Tabs defaultValue="kits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="kits">Kits & Promos</TabsTrigger>
          <TabsTrigger value="auto">Automáticas</TabsTrigger>
          <TabsTrigger value="cupons">Cupons de Desconto</TabsTrigger>
        </TabsList>

        <TabsContent value="kits">
          {restaurantId && <PromoKitsSection restaurantId={restaurantId} />}
        </TabsContent>

        <TabsContent value="auto">
          {restaurantId && <AutoPromosSection restaurantId={restaurantId} />}
        </TabsContent>

        <TabsContent value="cupons">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Cupons de Desconto</h2>
          <p className="text-muted-foreground text-sm">
            Crie e gerencie cupons promocionais
          </p>
        </div>
        <Dialog
          open={couponDialogOpen}
          onOpenChange={(open) => {
            setCouponDialogOpen(open);
            if (!open) resetCouponForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? "Editar Cupom" : "Criar Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Código do cupom *</Label>
                <Input
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ex: PROMO10"
                  className="font-mono text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  O código será convertido para maiúsculas automaticamente
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de desconto</Label>
                  <Select
                    value={couponForm.discount_type}
                    onValueChange={(value) =>
                      setCouponForm({ ...couponForm, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          Porcentagem
                        </div>
                      </SelectItem>
                      <SelectItem value="fixed">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Valor fixo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Valor {couponForm.discount_type === "percentage" ? "(%)" : "(R$)"}
                  </Label>
                  {couponForm.discount_type === "fixed" ? (
                    <CurrencyInput
                      value={typeof couponForm.discount_value === 'string' ? parseFloat(couponForm.discount_value) || 0 : couponForm.discount_value}
                      onChange={(value) =>
                        setCouponForm({
                          ...couponForm,
                          discount_value: value,
                        })
                      }
                      placeholder="0,00"
                    />
                  ) : (
                    <Input
                      type="number"
                      value={couponForm.discount_value}
                      onChange={(e) =>
                        setCouponForm({
                          ...couponForm,
                          discount_value: e.target.value,
                        })
                      }
                      placeholder="0"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pedido mínimo (R$)</Label>
                  <CurrencyInput
                    value={typeof couponForm.min_order === 'string' ? parseFloat(couponForm.min_order) || 0 : couponForm.min_order}
                    onChange={(value) =>
                      setCouponForm({
                        ...couponForm,
                        min_order: value,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de cupons</Label>
                  <Input
                    type="number"
                    value={couponForm.max_uses}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        max_uses: e.target.value,
                      })
                    }
                    placeholder="Ilimitado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Quantos cupons estão disponíveis no total
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Limite por usuário</Label>
                  <Input
                    type="number"
                    value={couponForm.max_uses_per_user}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        max_uses_per_user: e.target.value,
                      })
                    }
                    placeholder="Ilimitado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vezes que cada cliente pode usar
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Aplica-se a</Label>
                  <Select
                    value={couponForm.applies_to}
                    onValueChange={(value) =>
                      setCouponForm({ ...couponForm, applies_to: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          Pedido total
                        </div>
                      </SelectItem>
                      <SelectItem value="products_only">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" />
                          Somente produtos
                        </div>
                      </SelectItem>
                      <SelectItem value="shipping">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Frete
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Onde o desconto será aplicado
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data de validade</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !couponForm.expires_at && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {couponForm.expires_at
                          ? format(couponForm.expires_at, "dd/MM/yyyy", { locale: ptBR })
                          : "Sem validade"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={couponForm.expires_at || undefined}
                        onSelect={(date) => setCouponForm({ ...couponForm, expires_at: date || null })}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {couponForm.expires_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setCouponForm({ ...couponForm, expires_at: null })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Após essa data o cupom não poderá mais ser utilizado
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Cupom ativo</p>
                  <p className="text-sm text-muted-foreground">
                    Desative para pausar o uso do cupom
                  </p>
                </div>
                <Switch
                  checked={couponForm.is_active}
                  onCheckedChange={(checked) =>
                    setCouponForm({ ...couponForm, is_active: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Exibir no cardápio</p>
                  <p className="text-sm text-muted-foreground">
                    Mostrar na aba "Promos" do cardápio digital
                  </p>
                </div>
                <Switch
                  checked={couponForm.show_in_menu}
                  onCheckedChange={(checked) =>
                    setCouponForm({ ...couponForm, show_in_menu: checked })
                  }
                />
              </div>
              <Button onClick={handleSaveCoupon} className="w-full" size="lg" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingCoupon ? "Salvar Alterações" : "Criar Cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cupons</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coupons.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cupons Ativos</CardTitle>
            <Tag className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCoupons}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons List */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Cupons</CardTitle>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
              <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                Nenhum cupom cadastrado ainda
              </p>
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro cupom para atrair mais clientes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex items-center justify-between p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        coupon.is_active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {coupon.discount_type === "percentage" ? (
                        <Percent className="w-6 h-6" />
                      ) : (
                        <DollarSign className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">
                          {coupon.code}
                        </span>
                        {!coupon.is_active && (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                        {coupon.is_active && !(coupon as any).show_in_menu && (
                          <Badge variant="outline" className="text-xs">Oculto no cardápio</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}% de desconto`
                          : `R$ ${coupon.discount_value.toFixed(2)} de desconto`}
                        {coupon.min_order > 0 &&
                          ` • Mínimo R$ ${coupon.min_order.toFixed(2)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Usado {coupon.used_count} vez(es)
                        {coupon.max_uses && ` de ${coupon.max_uses}`}
                        {coupon.expires_at && ` • Válido até ${format(new Date(coupon.expires_at), "dd/MM/yyyy", { locale: ptBR })}`}
                        {coupon.expires_at && new Date(coupon.expires_at) < new Date() && (
                          <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">Expirado</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={() => handleToggleActive(coupon)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditCoupon(coupon)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCoupon(coupon.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
