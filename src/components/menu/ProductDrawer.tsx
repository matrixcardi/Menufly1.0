import { useState, useMemo, useEffect } from "react";
import { X, Plus, Minus, ShoppingCart } from "lucide-react";
import { Product } from "@/data/menu-data";
import { useAddonGroups, AddonGroupWithItems } from "@/hooks/useAddonGroups";
import { toast } from "sonner";
import { trackViewContent } from "@/lib/meta-pixel";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface ProductDrawerProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart?: (product: Product, quantity: number, addons: SelectedAddons, addonsTotal: number, notes?: string, addonNames?: Record<string, string>) => void;
  onOpenCart?: () => void;
  restaurantId?: string;
}

export type SelectedAddons = Record<string, Record<string, number>>;

export function ProductDrawer({ product, open, onOpenChange, onAddToCart, onOpenCart, restaurantId }: ProductDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddons>({});
  const [notes, setNotes] = useState("");

  const { addonGroups } = useAddonGroups(restaurantId, product?.id);

  // Fire ViewContent when product drawer opens
  useEffect(() => {
    if (open && product) {
      trackViewContent(product.name, product.id, product.price, restaurantId, product.category);
    }
  }, [open, product?.id]);

  const addonSections = addonGroups;

  const addonsTotal = useMemo(() => {
    let total = 0;
    addonSections.forEach((section) => {
      const selected = selectedAddons[section.id] || {};
      Object.entries(selected).forEach(([itemId, qty]) => {
        const item = section.items.find((i) => i.id === itemId);
        if (item && qty > 0) total += item.price * qty;
      });
    });
    return total;
  }, [addonSections, selectedAddons]);

  const totalPrice = useMemo(() => {
    if (!product) return 0;
    return (product.price + addonsTotal) * quantity;
  }, [product, addonsTotal, quantity]);

  const handleAddonToggle = (sectionId: string, itemId: string, section: AddonGroupWithItems, delta: number = 1) => {
    setSelectedAddons((prev) => {
      const current = prev[sectionId] || {};

      // Calculate total quantity in this group
      const totalQty = Object.values(current).reduce((sum, qty) => sum + qty, 0);

      if (section.type === "single") {
        // Radio behavior - toggle off if already selected
        if (current[itemId] && current[itemId] > 0) {
          return { ...prev, [sectionId]: {} };
        }
        return { ...prev, [sectionId]: { [itemId]: 1 } };
      }

      // Checkbox behavior with quantity
      const newQty = (current[itemId] || 0) + delta;

      if (newQty <= 0) {
        // Remove item if quantity goes to 0
        const { [itemId]: _, ...rest } = current;
        return { ...prev, [sectionId]: rest };
      }

      // Check maxSelect (rule B: sum of quantities)
      if (section.max_select && section.max_select > 0 && totalQty + delta > section.max_select) {
        toast.error(`Máximo de ${section.max_select} opções neste grupo`);
        return prev;
      }

      return { ...prev, [sectionId]: { ...current, [itemId]: newQty } };
    });
  };

  const handleAddToCart = () => {
    // Validate required addon groups and min_select
    for (const section of addonSections) {
      const selected = selectedAddons[section.id] || {};
      const totalQty = Object.values(selected).reduce((sum, qty) => sum + qty, 0);
      const min = section.min_select && section.min_select > 0
        ? section.min_select
        : (section.required ? 1 : 0);
      if (min > 0 && totalQty < min) {
        toast.error(
          min === 1
            ? `Selecione uma opção em "${section.name}"`
            : `Selecione ao menos ${min} opções em "${section.name}"`
        );
        return;
      }
    }

    if (product && onAddToCart) {
      // Build addon names map from current addon sections
      const addonNamesMap: Record<string, string> = {};
      addonSections.forEach((section) => {
        const selected = selectedAddons[section.id] || {};
        Object.entries(selected).forEach(([itemId, qty]) => {
          if (qty > 0) {
            const item = section.items.find((i) => i.id === itemId);
            if (item) addonNamesMap[itemId] = item.name;
          }
        });
      });
      console.log('[PEDIDO] addons:', selectedAddons);
      onAddToCart(product, quantity, selectedAddons, addonsTotal, notes.trim() || undefined, addonNamesMap);
    }
    // Reset state
    setQuantity(1);
    setSelectedAddons({});
    setNotes("");
    onOpenChange(false);

    // Open cart automatically after adding (small delay so the product drawer can close first)
    setTimeout(() => {
      onOpenCart?.();
    }, 250);
  };

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace(".", ",")}`;

  if (!product) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent hideHandle className="max-h-[95vh] max-w-md mx-auto !rounded-none !border-0 overflow-hidden">
        {/* Close button - fixed position */}
        <DrawerClose asChild>
          <button className="fixed top-4 right-4 z-50 p-2 bg-card/90 rounded-full shadow-lg">
            <X className="w-5 h-5" />
          </button>
        </DrawerClose>

        {/* Scrollable container */}
        <div className="overflow-y-auto max-h-[calc(95vh-6rem)]">
          {/* Product Image - 1:1 aspect ratio, sticky background */}
          <div className="relative w-full aspect-square">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {product.cashback && (
              <span className="absolute bottom-4 left-4 bg-cashback text-cashback-foreground text-sm font-semibold px-3 py-1 rounded-lg">
                {product.cashback}% cashback
              </span>
            )}
          </div>

          {/* Content that scrolls over the image */}
          <div className="relative bg-card -mt-6 rounded-t-3xl z-10">
            <DrawerHeader className="text-left px-4 pt-6 pb-2">
              <DrawerTitle className="text-xl font-bold">{product.name}</DrawerTitle>
              <p className="text-muted-foreground text-sm mt-1">{product.description}</p>
              <p className="text-lg font-bold text-primary mt-2">{formatPrice(product.price)}</p>
            </DrawerHeader>

            {/* Add-on Sections */}
            <div className="px-4 pb-4 space-y-4">
              {addonSections.map((section) => (
                <AddonSectionComponent
                  key={section.id}
                  section={section}
                  selectedItems={selectedAddons[section.id] || {}}
                  onToggle={(itemId, delta) => handleAddonToggle(section.id, itemId, section, delta)}
                />
              ))}

              {/* Observação */}
              <div className="bg-secondary/50 rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-2">Alguma observação?</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: sem cebola, bem passado..."
                  className="w-full bg-card rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground border-0 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={2}
                  maxLength={200}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="border-t border-border p-4 bg-card safe-area-bottom">
          <div className="flex items-center gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center gap-3 bg-secondary rounded-xl p-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                disabled={quantity <= 1}
              >
                <Minus className={cn("w-5 h-5", quantity <= 1 && "text-muted-foreground")} />
              </button>
              <span className="w-8 text-center font-bold text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              className="flex-1 h-12 text-base font-bold bg-primary hover:bg-primary/90"
            >
              Adicionar • {formatPrice(totalPrice)}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface AddonSectionComponentProps {
  section: AddonGroupWithItems;
  selectedItems: Record<string, number>;
  onToggle: (itemId: string, delta: number) => void;
}

function AddonSectionComponent({ section, selectedItems, onToggle }: AddonSectionComponentProps) {
  const formatPrice = (price: number) =>
    price === 0 ? "Grátis" : `+ R$ ${price.toFixed(2).replace(".", ",")}`;

  // Calculate total quantity in this group for max_select validation
  const totalQty = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  const isMaxReached = section.max_select && section.max_select > 0 && totalQty >= section.max_select;

  return (
    <div className="bg-secondary/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{section.name}</h3>
          {section.description && (
            <p className="text-xs text-muted-foreground">{section.description}</p>
          )}
        </div>
        {section.required && (
          <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-1 rounded">
            Obrigatório
          </span>
        )}
        {section.max_select && (
          <span className="text-xs text-muted-foreground">
            Máx. {section.max_select}
          </span>
        )}
      </div>

      {section.type === "single" ? (
        <RadioGroup
          value={Object.keys(selectedItems).find(id => selectedItems[id] > 0) || ""}
          onValueChange={(value) => onToggle(value, 1)}
          className="space-y-2"
        >
          {section.items.map((item) => (
            <label
              key={item.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg bg-card cursor-pointer transition-all",
                selectedItems[item.id] > 0 && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={item.id} className="border-primary" />
                <div>
                  <span className="font-medium text-sm">{item.name}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatPrice(item.price)}
              </span>
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="space-y-2">
          {section.items.map((item) => {
            const qty = selectedItems[item.id] || 0;
            const isSelected = qty > 0;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg bg-card transition-all",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="cursor-pointer"
                    onClick={() => onToggle(item.id, 1)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="border-primary data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onToggle(item.id, 1)}
                  >
                    <span className="font-medium text-sm">{item.name}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary">
                    {formatPrice(item.price)}
                  </span>
                  {isSelected ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggle(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-secondary hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-semibold text-sm">{qty}</span>
                      <button
                        onClick={() => onToggle(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-secondary hover:bg-muted flex items-center justify-center transition-colors"
                        disabled={isMaxReached}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onToggle(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-secondary hover:bg-muted flex items-center justify-center transition-colors"
                      disabled={isMaxReached}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
