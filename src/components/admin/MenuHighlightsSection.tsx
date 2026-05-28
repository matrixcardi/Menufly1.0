import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import {
  Plus,
  Trash2,
  Tag,
  ShoppingBag,
  FileText,
  Loader2,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Highlight {
  id: string;
  highlight_type: string;
  coupon_id: string | null;
  product_id: string | null;
  custom_title: string | null;
  custom_description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface MenuHighlightsSectionProps {
  restaurantId: string;
}

export default function MenuHighlightsSection({
  restaurantId,
}: MenuHighlightsSectionProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formType, setFormType] = useState<"coupon" | "product" | "custom">("coupon");
  const [formCouponId, setFormCouponId] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      // Fetch highlights
      const { data: highlightsData } = await supabase
        .from("menu_highlights")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order");

      if (highlightsData) {
        setHighlights(highlightsData);
      }

      // Fetch coupons for selection
      const { data: couponsData } = await supabase
        .from("coupons")
        .select("id, code, discount_type, discount_value")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

      if (couponsData) {
        setCoupons(couponsData);
      }

      // Fetch products for selection
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("name");

      if (productsData) {
        setProducts(productsData);
      }
    } catch (error) {
      logger.error("Error fetching highlights data:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormType("coupon");
    setFormCouponId("");
    setFormProductId("");
    setFormTitle("");
    setFormDescription("");
  };

  const handleAddHighlight = async () => {
    if (highlights.length >= 3) {
      toast({
        title: "Limite atingido",
        description: "Você pode ter no máximo 3 destaques.",
        variant: "destructive",
      });
      return;
    }

    // Validation
    if (formType === "coupon" && !formCouponId) {
      toast({ title: "Selecione um cupom", variant: "destructive" });
      return;
    }
    if (formType === "product" && !formProductId) {
      toast({ title: "Selecione um produto", variant: "destructive" });
      return;
    }
    if (formType === "custom" && (!formTitle.trim() || !formDescription.trim())) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const newHighlight = {
        restaurant_id: restaurantId,
        highlight_type: formType,
        coupon_id: formType === "coupon" ? formCouponId : null,
        product_id: formType === "product" ? formProductId : null,
        custom_title: formType === "custom" ? formTitle.trim() : null,
        custom_description: formType === "custom" ? formDescription.trim() : null,
        sort_order: highlights.length,
        is_active: true,
      };

      const { error } = await supabase.from("menu_highlights").insert(newHighlight);

      if (error) throw error;

      toast({ title: "Destaque adicionado!" });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      logger.error("Error adding highlight:", error);
      toast({
        title: "Erro",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHighlight = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este destaque?")) return;

    try {
      const { error } = await supabase.from("menu_highlights").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Destaque removido!" });
      fetchData();
    } catch (error) {
      logger.error("Error deleting highlight:", error);
      toast({
        title: "Erro",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (highlight: Highlight) => {
    try {
      const { error } = await supabase
        .from("menu_highlights")
        .update({ is_active: !highlight.is_active })
        .eq("id", highlight.id);

      if (error) throw error;

      toast({ title: highlight.is_active ? "Destaque desativado" : "Destaque ativado" });
      fetchData();
    } catch (error) {
      logger.error("Error toggling highlight:", error);
      toast({
        title: "Erro",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    }
  };

  const getHighlightLabel = (highlight: Highlight) => {
    switch (highlight.highlight_type) {
      case "coupon": {
        const coupon = coupons.find((c) => c.id === highlight.coupon_id);
        return coupon
          ? `Cupom: ${coupon.code} (${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `R$ ${coupon.discount_value}`})`
          : "Cupom removido";
      }
      case "product": {
        const product = products.find((p) => p.id === highlight.product_id);
        return product
          ? `Produto: ${product.name}`
          : "Produto removido";
      }
      case "custom":
        return highlight.custom_title || "Destaque personalizado";
      default:
        return "Destaque";
    }
  };

  const getHighlightIcon = (type: string) => {
    switch (type) {
      case "coupon":
        return <Tag className="w-5 h-5" />;
      case "product":
        return <ShoppingBag className="w-5 h-5" />;
      case "custom":
        return <FileText className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Destaques do Cardápio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adicione até 3 banners de destaque que aparecerão no topo do cardápio. 
          Podem ser cupons, produtos ou textos personalizados.
        </p>

        {/* Current Highlights */}
        {highlights.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum destaque configurado</p>
            <p className="text-sm text-muted-foreground">
              Adicione seu primeiro destaque para chamar atenção dos clientes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {highlights.map((highlight, index) => (
              <div
                key={highlight.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  highlight.is_active
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/50 border-muted"
                }`}
              >
                <GripVertical className="w-5 h-5 text-muted-foreground" />
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    highlight.is_active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getHighlightIcon(highlight.highlight_type)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {getHighlightLabel(highlight)}
                  </p>
                  {highlight.highlight_type === "custom" && highlight.custom_description && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {highlight.custom_description}
                    </p>
                  )}
                </div>
                <Switch
                  checked={highlight.is_active}
                  onCheckedChange={() => handleToggleActive(highlight)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteHighlight(highlight.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add Highlight Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full"
              disabled={highlights.length >= 3}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Destaque ({highlights.length}/3)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Destaque</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Type Selection */}
              <div className="space-y-2">
                <Label>Tipo de destaque</Label>
                <Select
                  value={formType}
                  onValueChange={(value: "coupon" | "product" | "custom") => setFormType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coupon">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Cupom
                      </div>
                    </SelectItem>
                    <SelectItem value="product">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Produto
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Texto personalizado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Coupon Selection */}
              {formType === "coupon" && (
                <div className="space-y-2">
                  <Label>Selecione o cupom</Label>
                  {coupons.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                      Nenhum cupom ativo. Crie um cupom na aba "Cupons".
                    </p>
                  ) : (
                    <Select value={formCouponId} onValueChange={setFormCouponId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cupom" />
                      </SelectTrigger>
                      <SelectContent>
                        {coupons.map((coupon) => (
                          <SelectItem key={coupon.id} value={coupon.id}>
                            {coupon.code} -{" "}
                            {coupon.discount_type === "percentage"
                              ? `${coupon.discount_value}% OFF`
                              : `R$ ${coupon.discount_value} OFF`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Product Selection */}
              {formType === "product" && (
                <div className="space-y-2">
                  <Label>Selecione o produto</Label>
                  {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                      Nenhum produto ativo. Crie produtos na aba "Produtos".
                    </p>
                  ) : (
                    <Select value={formProductId} onValueChange={setFormProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - R$ {product.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Custom Text */}
              {formType === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Ex: Promoção de Lançamento!"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Ex: Peça agora e ganhe 10% de desconto"
                      maxLength={100}
                    />
                  </div>
                </>
              )}

              <Button
                onClick={handleAddHighlight}
                className="w-full"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Adicionar Destaque"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
