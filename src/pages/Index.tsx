import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { RestaurantHeader } from "@/components/menu/RestaurantHeader";
import { PromoBanner } from "@/components/menu/PromoBanner";
import { ClosingSoonBanner } from "@/components/menu/ClosingSoonBanner";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { PopularSection } from "@/components/menu/PopularSection";
import { ProductList } from "@/components/menu/ProductList";
import { BottomNav } from "@/components/menu/BottomNav";
import { ProductDrawer, SelectedAddons } from "@/components/menu/ProductDrawer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PromosSection } from "@/components/promos/PromosSection";
import { OrdersTab } from "@/components/orders/OrdersTab";
import { useCart } from "@/contexts/CartContext";
import { useRestaurantStatus, Product } from "@/hooks/useRestaurantStatus";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get("r") || undefined;
  
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeTab, setActiveTab] = useState("inicio");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [showStickyCategories, setShowStickyCategories] = useState(false);
  
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  
  const { addItem } = useCart();
  const { restaurant, isCurrentlyOpen, nextOpenTime, isClosingSoon, minutesUntilClose, menuTheme, categories, products, productCategoryLinks, loading } = useRestaurantStatus(restaurantId);

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
        // Show sticky when original tabs go above viewport
        setShowStickyCategories(rect.bottom < 0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
  };

  const handleAddToCart = (product: Product, quantity: number, addons: SelectedAddons, addonsTotal: number) => {
    // Map Product from useRestaurantStatus to the format expected by cart
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
    addItem(cartProduct, quantity, addons, addonsTotal);
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
  if (!restaurant) {
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
    <div className={`min-h-screen max-w-md mx-auto ${menuTheme === 'light' ? 'bg-white text-zinc-900' : 'bg-background'}`} data-theme={menuTheme}>
      {/* Sticky header categories - only visible when scrolled past original */}
      {showStickyCategories && activeTab === "inicio" && mappedCategories.length > 0 && (
        <CategoryTabs
          categories={mappedCategories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          isSticky
        />
      )}
      
      <RestaurantHeader 
        restaurant={restaurant} 
        isCurrentlyOpen={isCurrentlyOpen}
        nextOpenTime={nextOpenTime}
      />
      
      {activeTab === "inicio" && (
        <>
          <ClosingSoonBanner 
            isClosingSoon={isClosingSoon} 
            minutesUntilClose={minutesUntilClose} 
          />
          <PromoBanner />
          
          {/* Original category tabs - not sticky */}
          {mappedCategories.length > 0 && (
            <div ref={categoryTabsRef}>
              <CategoryTabs
                categories={mappedCategories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
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
          />
        </>
      )}

      {activeTab === "promos" && <PromosSection restaurantId={restaurant?.id} />}

      {activeTab === "pedidos" && <OrdersTab />}

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCartClick={handleOpenCart}
      />

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
        onAddToCart={(product, quantity, addons, addonsTotal) => {
          if (selectedProduct) {
            handleAddToCart(selectedProduct, quantity, addons, addonsTotal);
          }
        }}
        onOpenCart={handleOpenCart}
        restaurantId={restaurant?.id}
      />

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        restaurantId={restaurant?.id}
        restaurantIsOpen={isCurrentlyOpen}
        dbProducts={products}
        onProductClick={(product) => {
          // Convert back to Product format for drawer
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
    </div>
  );
};

export default Index;
