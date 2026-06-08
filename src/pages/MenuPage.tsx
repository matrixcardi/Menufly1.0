import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantHeader } from "@/components/menu/RestaurantHeader";
import { ClosingSoonBanner } from "@/components/menu/ClosingSoonBanner";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { PopularSection } from "@/components/menu/PopularSection";
import { ProductList } from "@/components/menu/ProductList";
import { BottomNav } from "@/components/menu/BottomNav";
import { useCart } from "@/contexts/CartContext";
import type { SelectedAddons } from "@/contexts/CartContext";
import { useRestaurantBySlug, Product } from "@/hooks/useRestaurantBySlug";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded: not needed for first paint of the menu list
const TrackingScripts = lazy(() =>
  import("@/components/menu/TrackingScripts").then((m) => ({ default: m.TrackingScripts }))
);
const MenuHighlightsBanner = lazy(() =>
  import("@/components/menu/MenuHighlightsBanner").then((m) => ({ default: m.MenuHighlightsBanner }))
);
const ProductDrawer = lazy(() =>
  import("@/components/menu/ProductDrawer").then((m) => ({ default: m.ProductDrawer }))
);
const PromoDetailDrawer = lazy(() =>
  import("@/components/menu/PromoDetailDrawer").then((m) => ({ default: m.PromoDetailDrawer }))
);
const CartDrawer = lazy(() =>
  import("@/components/cart/CartDrawer").then((m) => ({ default: m.CartDrawer }))
);
const PromosSection = lazy(() =>
  import("@/components/promos/PromosSection").then((m) => ({ default: m.PromosSection }))
);
const OrdersTab = lazy(() =>
  import("@/components/orders/OrdersTab").then((m) => ({ default: m.OrdersTab }))
);

interface PromoKitSummary {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  promo_type: string;
  price: number | null;
  discount_value: number | null;
  discount_type: string | null;
}

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const MenuPage = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [userClickedCategory, setUserClickedCategory] = useState(false);
  const [activeTab, setActiveTab] = useState("inicio");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<PromoKitSummary | null>(null);
  const [promoDrawerOpen, setPromoDrawerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [showStickyCategories, setShowStickyCategories] = useState(false);
  const [deferredReady, setDeferredReady] = useState(false);
  // Mount-once flags: lazy-load on first open, but keep mounted afterwards
  // so nested drawers (Checkout inside Cart, Cart inside Product) don't unmount mid-flow.
  const [cartMounted, setCartMounted] = useState(false);
  const [productMounted, setProductMounted] = useState(false);

  useEffect(() => {
    if (cartOpen) setCartMounted(true);
  }, [cartOpen]);
  useEffect(() => {
    if (drawerOpen) setProductMounted(true);
  }, [drawerOpen]);
  
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const initialIsOpenRef = useRef<boolean>(false);

  const { addItem, setRestaurantId, setRestaurantSlug } = useCart();
  const { restaurant, isClosingSoon, minutesUntilClose, menuTheme, categories, products, productCategoryLinks, loading, notFound } = useRestaurantBySlug(slug);

  // Store initial restaurant status for polling comparison
  useEffect(() => {
    if (restaurant?.is_open !== undefined) {
      initialIsOpenRef.current = restaurant.is_open;
    }
  }, [restaurant?.is_open]);

  // Poll restaurant status every 30 seconds and reload if changed
  useEffect(() => {
    if (!slug || !restaurant?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: restaurantData } = await supabase
          .from("restaurants")
          .select("is_open")
          .eq("slug", slug)
          .maybeSingle();

        if (restaurantData && restaurantData.is_open !== initialIsOpenRef.current) {
          // Status changed, reload the page
          window.location.reload();
        }
      } catch (error) {
        console.error("Error polling restaurant status:", error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, [slug, restaurant?.id]);

  // Defer non-critical work (tracking + highlights banner + drawer prefetch) until idle
  useEffect(() => {
    if (!restaurant?.id) return;
    const w = window as WindowWithIdleCallback;
    const schedule = w.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));
    const handle = schedule(() => setDeferredReady(true));
    return () => {
      if (w.cancelIdleCallback && typeof handle === "number") w.cancelIdleCallback(handle);
    };
  }, [restaurant?.id]);

  // Set restaurant ID in cart context for server-side tracking
  useEffect(() => {
    if (restaurant?.id) {
      setRestaurantId(restaurant.id);
    }
  }, [restaurant?.id, setRestaurantId]);

  // Set restaurant slug in cart context for localStorage persistence
  useEffect(() => {
    if (slug) {
      setRestaurantSlug(slug);
    }
  }, [slug, setRestaurantSlug]);

  // Set first category as active when categories load
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Detect when to show sticky categories
  useEffect(() => {
    const handleScroll = () => {
      if (categoryTabsRef.current) {
        const rect = categoryTabsRef.current.getBoundingClientRect();
        setShowStickyCategories(rect.bottom < 0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    setUserClickedCategory(true);
    const sectionId = `category-${categoryId}`;

    requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        window.history.replaceState(null, "", `#${sectionId}`);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setTimeout(() => setUserClickedCategory(false), 900);
    });
  };

  const handleVisibleCategoryChange = (categoryId: string) => {
    if (!userClickedCategory) {
      setActiveCategory(categoryId);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
  };

  const handleAddToCart = (product: Product, quantity: number, addons: SelectedAddons, addonsTotal: number, notes?: string, addonNames?: Record<string, string>) => {
    const cartProduct = {
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      image: product.image_url || "",
      category: product.category_id || "",
      cashback: product.cashback || undefined,
      isPopular: product.is_popular || undefined,
    };
    addItem(cartProduct, quantity, addons, addonsTotal, notes, addonNames);
  };

  const handleOpenCart = () => {
    setCartOpen(true);
  };

  // Map categories to the format expected by CategoryTabs
  const mappedCategories = categories.map(c => ({ id: c.id, name: c.name }));

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-background">
        <Skeleton className="h-32 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-24 mx-auto rounded-full" />
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound || !restaurant) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-4">🍔</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Cardápio não encontrado</h1>
        <p className="text-muted-foreground">
          O restaurante que você está procurando não existe ou está temporariamente indisponível.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background text-foreground" data-theme={menuTheme}>
      {deferredReady && (
        <Suspense fallback={null}>
          <TrackingScripts
            metaPixelId={restaurant.meta_pixel_id}
            gtmContainerId={restaurant.gtm_container_id}
            gaMeasurementId={restaurant.ga_measurement_id}
            restaurantId={restaurant.id}
          />
        </Suspense>
      )}
      {/* Sticky header categories */}
      {showStickyCategories && activeTab === "inicio" && mappedCategories.length > 0 && (
        <CategoryTabs
          categories={mappedCategories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryClick}
          isSticky
        />
      )}
      
      <RestaurantHeader 
        restaurant={restaurant} 
        isCurrentlyOpen={restaurant.is_open}
      />
      
      {activeTab === "inicio" && (
        <>
          <ClosingSoonBanner 
            isClosingSoon={isClosingSoon} 
            minutesUntilClose={minutesUntilClose} 
          />
          {deferredReady && (
            <Suspense fallback={null}>
              <MenuHighlightsBanner restaurantId={restaurant.id} />
            </Suspense>
          )}
          
          {mappedCategories.length > 0 && (
            <div ref={categoryTabsRef}>
              <CategoryTabs
                categories={mappedCategories}
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryClick}
              />
            </div>
          )}
          
          <PopularSection 
            products={products} 
            onProductClick={handleProductClick} 
          />
          <ProductList
            activeCategory={activeCategory}
            categories={categories}
            products={products}
            productCategoryLinks={productCategoryLinks}
            onProductClick={handleProductClick}
            onVisibleCategoryChange={handleVisibleCategoryChange}
          />
        </>
      )}

      {activeTab === "promos" && (
        <Suspense fallback={<div className="p-4"><Skeleton className="h-32 w-full rounded-xl" /></div>}>
          <PromosSection
            restaurantId={restaurant?.id}
            onAddPromoToCart={(promo) => {
              setSelectedPromo(promo);
              setPromoDrawerOpen(true);
            }}
            onOpenCart={handleOpenCart}
          />
        </Suspense>
      )}

      {activeTab === "pedidos" && (
        <Suspense fallback={<div className="p-4"><Skeleton className="h-32 w-full rounded-xl" /></div>}>
          <OrdersTab />
        </Suspense>
      )}

      {restaurant && promoDrawerOpen && (
        <Suspense fallback={null}>
          <PromoDetailDrawer
            open={promoDrawerOpen}
            onOpenChange={setPromoDrawerOpen}
            promo={selectedPromo}
            restaurantId={restaurant.id}
            onOpenCart={handleOpenCart}
          />
        </Suspense>
      )}

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCartClick={handleOpenCart}
      />

      {productMounted && (
        <Suspense fallback={null}>
          <ProductDrawer
            product={selectedProduct ? {
              id: selectedProduct.id,
              name: selectedProduct.name,
              description: selectedProduct.description || "",
              price: selectedProduct.price,
              image: selectedProduct.image_url || "",
              category: selectedProduct.category_id || "",
              cashback: selectedProduct.cashback || undefined,
              isPopular: selectedProduct.is_popular || undefined,
            } : null}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onAddToCart={(product, quantity, addons, addonsTotal, notes, addonNames) => {
              if (selectedProduct) {
                handleAddToCart(selectedProduct, quantity, addons, addonsTotal, notes, addonNames);
              }
            }}
            onOpenCart={handleOpenCart}
            restaurantId={restaurant?.id}
          />
        </Suspense>
      )}

      {cartMounted && (
        <Suspense fallback={null}>
          <CartDrawer
            open={cartOpen}
            onOpenChange={setCartOpen}
            restaurantId={restaurant?.id}
            restaurantIsOpen={restaurant.is_open}
            restaurantSlug={slug}
            dbProducts={products}
            onProductClick={(product) => {
              const dbProduct: Product = {
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                image_url: product.image,
                category_id: product.category,
                cashback: product.cashback || null,
                is_popular: product.isPopular || null,
                is_active: true,
              };
              handleProductClick(dbProduct);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default MenuPage;
