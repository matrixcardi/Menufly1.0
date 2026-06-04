import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { trackAddToCart } from "@/lib/meta-pixel";
import { Product } from "@/data/menu-data";
import { SelectedAddons } from "@/components/menu/ProductDrawer";
import { useAutoPromos, evaluateAutoPromos, ActiveBenefit, AutoPromo } from "@/hooks/useAutoPromos";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  addons: SelectedAddons;
  addonNames?: Record<string, string>;
  unitPrice: number;
  notes?: string;
  promoId?: string;
}

export interface Coupon {
  code: string;
  discount: number;
  type: "percentage" | "fixed";
  description: string;
}

interface CartContextType {
  items: CartItem[];
  coupon: Coupon | null;
  restaurantId: string | null;
  restaurantSlug: string | null;
  addItem: (product: Product, quantity: number, addons: SelectedAddons, addonsTotal: number, notes?: string, addonNames?: Record<string, string>, promoId?: string) => void;
  activePromoId: string | null;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  applyCoupon: (coupon: Coupon | null) => void;
  setRestaurantId: (id: string) => void;
  setRestaurantSlug: (slug: string) => void;
  clearCart: () => void;
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  activeBenefits: ActiveBenefit[];
  hasFreeShipping: boolean;
  autoPromoDiscount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [productCategories, setProductCategories] = useState<Record<string, string[]>>({});

  const autoPromos = useAutoPromos(restaurantId);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!restaurantSlug) return;
    
    const cartData = {
      items,
      coupon,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(`cart_${restaurantSlug}`, JSON.stringify(cartData));
  }, [items, coupon, restaurantSlug]);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (!restaurantSlug) return;

    const savedCart = localStorage.getItem(`cart_${restaurantSlug}`);
    if (!savedCart) return;

    try {
      const cartData = JSON.parse(savedCart);
      
      // Check if cart is older than 24 hours
      const CART_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - cartData.timestamp > CART_EXPIRATION_MS) {
        localStorage.removeItem(`cart_${restaurantSlug}`);
        return;
      }

      // Validate products still exist and are active
      const validateAndRestoreCart = async () => {
        if (!restaurantId) return;

        const productIds = cartData.items.map((item: CartItem) => item.product.id);
        
        const { data: products } = await supabase
          .from("products")
          .select("id, is_active")
          .in("id", productIds);

        if (!products) return;

        const activeProductIds = new Set(
          products.filter((p: any) => p.is_active).map((p: any) => p.id)
        );

        // Filter out items with inactive or deleted products
        const validItems = cartData.items.filter((item: CartItem) =>
          activeProductIds.has(item.product.id)
        );

        if (validItems.length > 0) {
          setItems(validItems);
          if (cartData.coupon) {
            setCoupon(cartData.coupon);
          }
        }
      };

      validateAndRestoreCart();
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
      localStorage.removeItem(`cart_${restaurantSlug}`);
    }
  }, [restaurantSlug, restaurantId]);

  // Fetch product-category mappings when items change
  useEffect(() => {
    const productIds = items.map((i) => i.product.id);
    if (productIds.length === 0) {
      setProductCategories({});
      return;
    }

    supabase
      .from("product_categories")
      .select("product_id, category_id")
      .in("product_id", productIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string[]> = {};
        for (const row of data) {
          if (!map[row.product_id]) map[row.product_id] = [];
          map[row.product_id].push(row.category_id);
        }
        setProductCategories(map);
      });
  }, [items]);

  const addItem = (product: Product, quantity: number, addons: SelectedAddons, addonsTotal: number, notes?: string, addonNames?: Record<string, string>, promoId?: string) => {
    const id = `${product.id}-${Date.now()}`;
    const unitPrice = product.price + addonsTotal;
    
    setItems((prev) => [...prev, { id, product, quantity, addons, addonNames, unitPrice, notes, promoId }]);
    
    // Fire Meta Pixel AddToCart event (client + server)
    trackAddToCart(product.name, product.id, unitPrice, quantity, restaurantId || undefined);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const applyCoupon = (newCoupon: Coupon | null) => {
    setCoupon(newCoupon);
  };

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
  };

  const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  
  const couponDiscount = coupon
    ? coupon.type === "percentage"
      ? subtotal * (coupon.discount / 100)
      : coupon.discount
    : 0;

  // Evaluate auto promos
  const activeBenefits = useMemo(
    () => evaluateAutoPromos(autoPromos, items, subtotal, productCategories),
    [autoPromos, items, subtotal, productCategories]
  );

  const hasFreeShipping = activeBenefits.some((b) => b.freeShipping);
  const autoPromoDiscount = activeBenefits.reduce((sum, b) => sum + b.discountAmount, 0);

  const discount = couponDiscount + autoPromoDiscount;
  const total = Math.max(0, subtotal - discount);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const activePromoId = items.find(i => i.promoId)?.promoId || null;

  return (
    <CartContext.Provider
      value={{
        items,
        coupon,
        restaurantId,
        restaurantSlug,
        addItem,
        removeItem,
        updateQuantity,
        applyCoupon,
        setRestaurantId,
        setRestaurantSlug,
        clearCart,
        subtotal,
        discount,
        total,
        itemCount,
        activePromoId,
        activeBenefits,
        hasFreeShipping,
        autoPromoDiscount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
