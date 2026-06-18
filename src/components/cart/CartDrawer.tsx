import { useState } from "react";
import { X, Minus, Plus, Trash2, Pencil, Tag, ChevronRight, ShoppingBag, Clock, Zap, Truck, Percent, Gift } from "lucide-react";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import { Product as MenuProduct } from "@/data/menu-data";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CouponSelector } from "./CouponSelector";
import { CrossSellSection } from "./CrossSellSection";
import { CheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductClick?: (product: MenuProduct) => void;
  onEditItem?: (item: CartItem) => void;
  restaurantId?: string;
  restaurantIsOpen?: boolean;
  restaurantSlug?: string;
  dbProducts?: Array<{ id: string; name: string; description: string | null; price: number; image_url: string | null; category_id: string | null; cashback: number | null; is_popular: boolean | null; is_active: boolean | null }>;
}

export function CartDrawer({ open, onOpenChange, onProductClick, onEditItem, restaurantId, restaurantIsOpen, restaurantSlug, dbProducts }: CartDrawerProps) {
  const { items, subtotal, discount, total, coupon, updateQuantity, removeItem, activeBenefits, hasFreeShipping, autoPromoDiscount } = useCart();
  const { restaurant, isCurrentlyOpen, loading } = useRestaurantStatus(restaurantId);
  const resolvedRestaurantId = restaurantId || restaurant?.id;
  const isOpen = restaurantIsOpen ?? (loading ? true : isCurrentlyOpen);
  const [couponOpen, setCouponOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace(".", ",")}`;

  // Get cross-sell products from real DB products (not in cart)
  const cartProductIds = items.map((item) => item.product.id);
  const crossSellProducts: MenuProduct[] = (dbProducts || [])
    .filter((p) => !cartProductIds.includes(p.id) && p.image_url)
    .slice(0, 6)
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: p.price,
      image: p.image_url || "",
      category: p.category_id || "",
      cashback: p.cashback || undefined,
      isPopular: p.is_popular || undefined,
    }));

  const handleCrossSellClick = (product: MenuProduct) => {
    onOpenChange(false);
    setTimeout(() => {
      onProductClick?.(product);
    }, 300);
  };

  const canCheckout = isOpen && items.length > 0;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh] max-w-md mx-auto flex flex-col">
          <DrawerHeader className="border-b border-border px-4 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Seu Carrinho
              </DrawerTitle>
              <DrawerClose asChild>
                <button className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <ShoppingBag className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Carrinho vazio</h3>
              <p className="text-muted-foreground text-sm text-center">
                Adicione itens deliciosos ao seu pedido!
              </p>
              <Button
                onClick={() => onOpenChange(false)}
                className="mt-6 bg-primary hover:bg-primary/90"
              >
                Ver cardápio
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 overflow-hidden">
                {/* Closed Warning */}
                {!isOpen && (
                  <div className="mx-4 mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">
                          Estamos fechados
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Não é possível finalizar pedidos no momento.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cart Items */}
                <div className="p-4 space-y-3">
                {items.map((item) => {
                    // Get all selected addons with quantities
                    const selectedAddons = Object.entries(item.addons || {}).flatMap(([sectionId, addonQtyMap]) => {
                      if (!addonQtyMap) return [];
                      return Object.entries(addonQtyMap).map(([addonId, qty]) => ({ addonId, qty }));
                    }).filter(({ qty }) => qty > 0);

                    return (
                      <div
                        key={item.id}
                        className="flex gap-3 p-3 bg-secondary/50 rounded-xl animate-fade-in"
                      >
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">
                            {item.product.name}
                          </h4>

                          {/* Display selected addons with quantities */}
                          {selectedAddons.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {selectedAddons.map(({ addonId, qty }) => (
                                <p key={addonId} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="text-primary">+</span>
                                  <span>{qty > 1 ? `${qty}x ` : ""}{item.addonNames?.[addonId] || addonId}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Display notes */}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              📝 {item.notes}
                            </p>
                          )}
                          
                          <p className="text-primary font-bold text-sm mt-1">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 bg-card rounded-lg">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-6 text-center font-bold text-sm">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onEditItem?.(item)}
                                aria-label="Editar item"
                                className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeItem(item.id)}
                                aria-label="Remover item"
                                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Auto Promo Benefits */}
                {activeBenefits.length > 0 && (
                  <div className="px-4 pb-3 space-y-2">
                    {activeBenefits.map((b) => (
                      <div key={b.promoId} className="flex items-center gap-2.5 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          {b.benefitType === "free_shipping" && <Truck className="w-4 h-4 text-primary" />}
                          {b.benefitType === "percentage_discount" && <Percent className="w-4 h-4 text-primary" />}
                          {b.benefitType === "fixed_discount" && <Zap className="w-4 h-4 text-primary" />}
                          {b.benefitType === "free_product" && <Gift className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-primary">{b.promoName}</p>
                          {b.promoDescription && (
                            <p className="text-[10px] text-muted-foreground">{b.promoDescription}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Coupon Section - Highlighted */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setCouponOpen(true)}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-dashed border-primary/30 rounded-xl hover:border-primary/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <Tag className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        {coupon ? (
                          <>
                            <p className="font-bold text-primary text-sm">
                              {coupon.code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {coupon.description}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-sm">Adicionar cupom</p>
                            <p className="text-xs text-muted-foreground">
                              Tem um código promocional?
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Cross-sell Section */}
                {crossSellProducts.length > 0 && (
                  <CrossSellSection
                    products={crossSellProducts}
                    onProductClick={handleCrossSellClick}
                  />
                )}
              </ScrollArea>

              {/* Fixed Footer with Total */}
              <div className="border-t border-border p-4 bg-card space-y-3 safe-area-bottom shrink-0">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {hasFreeShipping && (
                    <div className="flex justify-between text-primary">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        Frete grátis
                      </span>
                      <span className="font-medium">Aplicado ✓</span>
                    </div>
                  )}
                  {autoPromoDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Desconto automático
                      </span>
                      <span>-{formatPrice(autoPromoDiscount)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-cashback">
                      <span>Desconto</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(total)}</span>
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    onOpenChange(false);
                    setTimeout(() => setCheckoutOpen(true), 300);
                  }}
                  disabled={!canCheckout}
                  className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {isOpen ? (
                    <>Continuar • {formatPrice(total)}</>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Fechado no momento
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <CouponSelector open={couponOpen} onOpenChange={setCouponOpen} restaurantId={restaurant?.id} />
      
      <CheckoutDrawer 
        open={checkoutOpen} 
        onOpenChange={setCheckoutOpen}
        onBack={() => onOpenChange(true)}
        restaurantId={resolvedRestaurantId}
        restaurantSlug={restaurantSlug}
      />
    </>
  );
}
