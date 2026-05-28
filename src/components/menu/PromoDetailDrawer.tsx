import { useState, useEffect, useMemo } from "react";
import { Package, Check, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";
import { AddonGroupWithItems } from "@/hooks/useAddonGroups";

interface PromoKit {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  promo_type: string;
  price: number | null;
  discount_value: number | null;
  discount_type: string | null;
}

interface PromoProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  group_name: string | null;
  max_choices: number;
  is_required: boolean;
}

interface PromoDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promo: PromoKit | null;
  restaurantId: string;
  onOpenCart: () => void;
}

type SelectedAddons = Record<string, string[]>;

interface ProductCustomization {
  addons: SelectedAddons;
  addonsTotal: number;
  notes: string;
  addonNames: Record<string, string>;
}

export function PromoDetailDrawer({ open, onOpenChange, promo, restaurantId, onOpenCart }: PromoDetailDrawerProps) {
  const [promoProducts, setPromoProducts] = useState<PromoProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [productAddonGroups, setProductAddonGroups] = useState<Record<string, AddonGroupWithItems[]>>({});
  const [productCustomizations, setProductCustomizations] = useState<Record<string, ProductCustomization>>({});
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const { addItem, setRestaurantId } = useCart();

  useEffect(() => {
    if (!open || !promo) return;
    setLoading(true);
    setSelectedItems({});
    setProductCustomizations({});
    setProductAddonGroups({});
    setExpandedProduct(null);

    supabase
      .from("promo_items")
      .select("product_id, group_name, max_choices, is_required, sort_order")
      .eq("promo_id", promo.id)
      .order("sort_order")
      .then(async ({ data: items }) => {
        if (!items || items.length === 0) {
          setPromoProducts([]);
          setLoading(false);
          return;
        }

        const productIds = items.map((i) => i.product_id);
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, image_url")
          .in("id", productIds);

        const merged: PromoProduct[] = items.map((item) => {
          const product = products?.find((p) => p.id === item.product_id);
          return {
            id: item.product_id,
            name: product?.name || "Produto",
            price: product?.price || 0,
            image_url: product?.image_url || null,
            group_name: item.group_name,
            max_choices: item.max_choices || 1,
            is_required: item.is_required,
          };
        });

        setPromoProducts(merged);

        // For fixed_kit, pre-select all items
        if (promo.promo_type === "fixed_kit") {
          const initial: Record<string, boolean> = {};
          merged.forEach((p) => { initial[p.id] = true; });
          setSelectedItems(initial);
        }

        // Fetch addon groups for all products
        const { data: addonLinks } = await supabase
          .from("product_addon_groups")
          .select("product_id, addon_group_id, sort_order")
          .in("product_id", productIds)
          .order("sort_order");

        if (addonLinks && addonLinks.length > 0) {
          const allGroupIds = [...new Set(addonLinks.map((l) => l.addon_group_id))];

          const [groupsRes, itemsRes] = await Promise.all([
            supabase
              .from("addon_groups")
              .select("*")
              .in("id", allGroupIds)
              .eq("is_active", true)
              .order("sort_order"),
            supabase
              .from("addon_items")
              .select("*")
              .eq("is_active", true)
              .order("sort_order"),
          ]);

          const allAddonItems = itemsRes.data || [];
          const allGroups = (groupsRes.data || []).map((g) => ({
            ...g,
            items: allAddonItems.filter((i) => i.addon_group_id === g.id),
          })).filter((g) => g.items.length > 0);

          // Map groups per product
          const groupsByProduct: Record<string, AddonGroupWithItems[]> = {};
          productIds.forEach((pid) => {
            const linkedGroupIds = addonLinks
              .filter((l) => l.product_id === pid)
              .map((l) => l.addon_group_id);
            groupsByProduct[pid] = allGroups.filter((g) => linkedGroupIds.includes(g.id));
          });
          setProductAddonGroups(groupsByProduct);
        }

        setLoading(false);
      });
  }, [open, promo?.id]);

  if (!promo) return null;

  const isFixedKit = promo.promo_type === "fixed_kit";
  const isChoiceKit = promo.promo_type === "choice_kit";

  // Group products by group_name for choice_kit
  const groups = isChoiceKit
    ? promoProducts.reduce<Record<string, PromoProduct[]>>((acc, p) => {
        const key = p.group_name || "Itens";
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {})
    : {};

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

  const getGroupSelectedCount = (groupName: string) => {
    const groupProducts = groups[groupName] || [];
    return groupProducts.filter((p) => selectedItems[p.id]).length;
  };

  const getGroupMaxChoices = (groupName: string) => {
    const groupProducts = groups[groupName] || [];
    return groupProducts[0]?.max_choices || 1;
  };

  const toggleItem = (productId: string, groupName: string | null) => {
    if (isFixedKit) return;

    setSelectedItems((prev) => {
      const newState = { ...prev };
      if (newState[productId]) {
        delete newState[productId];
        // Clear customization when deselecting
        setProductCustomizations((c) => {
          const nc = { ...c };
          delete nc[productId];
          return nc;
        });
      } else {
        if (groupName && isChoiceKit) {
          const groupProducts = groups[groupName] || [];
          const maxChoices = groupProducts[0]?.max_choices || 1;
          const currentCount = groupProducts.filter((p) => newState[p.id]).length;
          if (currentCount >= maxChoices) {
            toast.error(`Máximo de ${maxChoices} ${maxChoices === 1 ? "item" : "itens"} neste grupo`);
            return prev;
          }
        }
        newState[productId] = true;
      }
      return newState;
    });
  };

  const updateProductAddon = (productId: string, sectionId: string, itemId: string, section: AddonGroupWithItems) => {
    setProductCustomizations((prev) => {
      const current = prev[productId] || { addons: {}, addonsTotal: 0, notes: "", addonNames: {} };
      const currentSelected = current.addons[sectionId] || [];
      let newSelected: string[];

      if (section.type === "single") {
        newSelected = currentSelected.includes(itemId) ? [] : [itemId];
      } else {
        if (currentSelected.includes(itemId)) {
          newSelected = currentSelected.filter((id) => id !== itemId);
        } else {
          if (section.max_select && section.max_select > 0 && currentSelected.length >= section.max_select) {
            toast.error(`Máximo de ${section.max_select} opções neste grupo`);
            return prev;
          }
          newSelected = [...currentSelected, itemId];
        }
      }

      const newAddons = { ...current.addons, [sectionId]: newSelected };
      const newAddonNames = { ...current.addonNames };

      // Update addon names
      section.items.forEach((item) => {
        if (newSelected.includes(item.id)) {
          newAddonNames[item.id] = item.name;
        } else {
          delete newAddonNames[item.id];
        }
      });

      // Recalculate addons total for this product
      const productGroups = productAddonGroups[productId] || [];
      let total = 0;
      productGroups.forEach((g) => {
        (newAddons[g.id] || []).forEach((aid) => {
          const addonItem = g.items.find((i) => i.id === aid);
          if (addonItem) total += addonItem.price;
        });
      });

      return {
        ...prev,
        [productId]: { addons: newAddons, addonsTotal: total, notes: current.notes, addonNames: newAddonNames },
      };
    });
  };

  const updateProductNotes = (productId: string, notes: string) => {
    setProductCustomizations((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { addons: {}, addonsTotal: 0, notes: "", addonNames: {} }),
        notes,
      },
    }));
  };

  const handleAddToCart = () => {
    const selected = promoProducts.filter((p) => selectedItems[p.id]);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um item");
      return;
    }

    if (isChoiceKit) {
      for (const [groupName, groupProducts] of Object.entries(groups)) {
        const isRequired = groupProducts[0]?.is_required;
        if (isRequired && !groupProducts.some((p) => selectedItems[p.id])) {
          toast.error(`Selecione um item em "${groupName}"`);
          return;
        }
      }
    }

    setRestaurantId(restaurantId);

    selected.forEach((product) => {
      const customization = productCustomizations[product.id];
      const cartProduct = {
        id: product.id,
        name: product.name,
        description: "",
        price: product.price,
        image: product.image_url || "",
        category: "",
      };
      addItem(
        cartProduct,
        1,
        customization?.addons || {},
        customization?.addonsTotal || 0,
        customization?.notes?.trim() || `Promo: ${promo.name}`,
        customization?.addonNames || {},
        promo.id
      );
    });

    toast.success(`${promo.name} adicionado ao carrinho!`, {
      action: {
        label: "Ver carrinho",
        onClick: () => onOpenCart(),
      },
    });
    onOpenChange(false);
  };

  const regularTotal = promoProducts
    .filter((p) => selectedItems[p.id])
    .reduce((sum, p) => sum + p.price, 0);

  const totalAddonsExtra = Object.entries(productCustomizations)
    .filter(([pid]) => selectedItems[pid])
    .reduce((sum, [, c]) => sum + c.addonsTotal, 0);

  const promoPrice = (promo.price ?? regularTotal) + totalAddonsExtra;
  const savings = regularTotal - (promo.price ?? regularTotal);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const hasAddonsOrNotes = (productId: string) => {
    return (productAddonGroups[productId] || []).length > 0;
  };

  const renderProductCard = (product: PromoProduct, isSelected: boolean, clickable: boolean, groupName?: string) => {
    const isExpanded = expandedProduct === product.id;
    const addonGroups = productAddonGroups[product.id] || [];
    const showCustomization = isSelected && addonGroups.length > 0;

    return (
      <div key={product.id} className="border-2 rounded-lg overflow-hidden transition-all border-border">
        <button
          onClick={() => clickable ? toggleItem(product.id, groupName || null) : undefined}
          className={`w-full flex items-center gap-3 p-3 transition-all text-left ${
            isSelected
              ? "border-primary bg-primary/5"
              : clickable ? "hover:border-muted-foreground/50" : ""
          }`}
          style={{ borderColor: isSelected ? "hsl(var(--primary))" : undefined }}
        >
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
          )}
          <div className="flex-1">
            <p className="font-medium text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">
              {isFixedKit ? (
                <span className="line-through">{formatCurrency(product.price)}</span>
              ) : (
                formatCurrency(product.price)
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showCustomization && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedProduct(isExpanded ? null : product.id);
                }}
                className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
              </button>
            )}
            {clickable ? (
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
              }`}>
                {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
              </div>
            ) : (
              <Check className="w-5 h-5 text-primary" />
            )}
          </div>
        </button>

        {/* Addons and notes expanded section */}
        {isSelected && isExpanded && addonGroups.length > 0 && (
          <div className="border-t border-border p-3 space-y-3 bg-muted/30">
            {addonGroups.map((section) => (
              <AddonSection
                key={section.id}
                section={section}
                selectedItems={(productCustomizations[product.id]?.addons || {})[section.id] || []}
                onToggle={(itemId) => updateProductAddon(product.id, section.id, itemId, section)}
              />
            ))}
            <div className="bg-card rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Observação</p>
              <textarea
                value={productCustomizations[product.id]?.notes || ""}
                onChange={(e) => updateProductNotes(product.id, e.target.value)}
                placeholder="Ex: sem cebola, bem passado..."
                className="w-full bg-secondary/50 rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground border-0 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                rows={2}
                maxLength={200}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Show "personalizar" hint if has addons but not expanded */}
        {isSelected && !isExpanded && addonGroups.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedProduct(product.id);
            }}
            className="w-full border-t border-border px-3 py-2 text-xs text-primary font-medium hover:bg-primary/5 transition-colors text-center"
          >
            Personalizar este item ▾
          </button>
        )}
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] max-w-md mx-auto">
        <DrawerHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <DrawerTitle className="text-lg font-bold">{promo.name}</DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {promo.image_url && (
            <img
              src={promo.image_url}
              alt={promo.name}
              className="w-full h-40 object-cover rounded-xl"
            />
          )}

          {promo.description && (
            <p className="text-sm text-muted-foreground">{promo.description}</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Fixed Kit */}
              {isFixedKit && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Itens inclusos:</p>
                  {promoProducts.map((product) =>
                    renderProductCard(product, true, false)
                  )}
                </div>
              )}

              {/* Choice Kit */}
              {isChoiceKit && Object.entries(groups).map(([groupName, groupProducts]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{groupName}</p>
                    <Badge variant="outline" className="text-xs">
                      {getGroupSelectedCount(groupName)}/{getGroupMaxChoices(groupName)}
                      {groupProducts[0]?.is_required && " • Obrigatório"}
                    </Badge>
                  </div>
                  {groupProducts.map((product) =>
                    renderProductCard(product, !!selectedItems[product.id], true, groupName)
                  )}
                </div>
              ))}

              {/* Pricing summary */}
              {promo.price != null && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  {savings > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Preço individual</span>
                      <span className="line-through">{formatCurrency(regularTotal)}</span>
                    </div>
                  )}
                  {totalAddonsExtra > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Adicionais</span>
                      <span>+ {formatCurrency(totalAddonsExtra)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(promoPrice)}</span>
                  </div>
                  {savings > 0 && (
                    <p className="text-sm text-primary font-medium text-center">
                      Você economiza {formatCurrency(savings)}! 🎉
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="p-4 border-t border-border safe-area-bottom">
            <Button
              onClick={handleAddToCart}
              className="w-full h-12 text-base font-bold gap-2"
              disabled={selectedCount === 0}
            >
              <ShoppingCart className="w-5 h-5" />
              Adicionar ao carrinho
              {promo.price != null && ` • ${formatCurrency(promoPrice)}`}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// Addon section component (mirrors ProductDrawer style)
function AddonSection({ section, selectedItems, onToggle }: {
  section: AddonGroupWithItems;
  selectedItems: string[];
  onToggle: (itemId: string) => void;
}) {
  const formatPrice = (price: number) =>
    price === 0 ? "Grátis" : `+ R$ ${price.toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{section.name}</p>
        <div className="flex gap-1">
          {section.required && (
            <span className="text-[10px] font-medium bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
              Obrigatório
            </span>
          )}
          {section.max_select && section.max_select > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Máx. {section.max_select}
            </span>
          )}
        </div>
      </div>

      {section.type === "single" ? (
        <RadioGroup
          value={selectedItems[0] || ""}
          onValueChange={(value) => onToggle(value)}
          className="space-y-1"
        >
          {section.items.map((item) => (
            <label
              key={item.id}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg bg-card cursor-pointer transition-all text-sm",
                selectedItems.includes(item.id) && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value={item.id} className="border-primary" />
                <span className="font-medium text-xs">{item.name}</span>
              </div>
              <span className="text-xs font-semibold text-primary">{formatPrice(item.price)}</span>
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="space-y-1">
          {section.items.map((item) => (
            <label
              key={item.id}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg bg-card cursor-pointer transition-all",
                selectedItems.includes(item.id) && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.includes(item.id)}
                  onCheckedChange={() => onToggle(item.id)}
                  className="border-primary data-[state=checked]:bg-primary"
                />
                <span className="font-medium text-xs">{item.name}</span>
              </div>
              <span className="text-xs font-semibold text-primary">{formatPrice(item.price)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
