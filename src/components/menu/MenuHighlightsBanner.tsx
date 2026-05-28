import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Gift, ShoppingBag, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

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
  image_url: string | null;
}

interface MenuHighlightsBannerProps {
  restaurantId: string;
}

export function MenuHighlightsBanner({ restaurantId }: MenuHighlightsBannerProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;

    async function fetchHighlights() {
      try {
        // Fetch active highlights
        const { data: highlightsData } = await supabase
          .from("menu_highlights")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .order("sort_order");

        if (highlightsData && highlightsData.length > 0) {
          setHighlights(highlightsData);

          // Fetch related coupons
          const couponIds = highlightsData
            .filter((h) => h.highlight_type === "coupon" && h.coupon_id)
            .map((h) => h.coupon_id);

          if (couponIds.length > 0) {
            const { data: couponsData } = await supabase
              .from("coupons")
              .select("id, code, discount_type, discount_value")
              .in("id", couponIds);
            if (couponsData) setCoupons(couponsData);
          }

          // Fetch related products
          const productIds = highlightsData
            .filter((h) => h.highlight_type === "product" && h.product_id)
            .map((h) => h.product_id);

          if (productIds.length > 0) {
            const { data: productsData } = await supabase
              .from("products")
              .select("id, name, price, image_url")
              .in("id", productIds);
            if (productsData) setProducts(productsData);
          }
        }
      } catch (error) {
        console.error("Error fetching highlights:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchHighlights();
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="px-4 py-2 space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (highlights.length === 0) {
    return null;
  }

  const getCoupon = (id: string | null) => coupons.find((c) => c.id === id);
  const getProduct = (id: string | null) => products.find((p) => p.id === id);

  const renderHighlight = (highlight: Highlight) => {
    switch (highlight.highlight_type) {
      case "coupon": {
        const coupon = getCoupon(highlight.coupon_id);
        if (!coupon) return null;
        
        const discountText = coupon.discount_type === "percentage"
          ? `${coupon.discount_value}% OFF`
          : `R$ ${coupon.discount_value.toFixed(2)} OFF`;

        return (
          <div
            key={highlight.id}
            className="bg-gradient-to-r from-primary to-amber-500 rounded-xl p-3 flex items-center justify-between shadow-md"
          >
            <div className="flex items-center gap-2">
              <div className="bg-primary-foreground/20 p-1.5 rounded-lg">
                <Gift className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-primary-foreground font-bold text-sm">{discountText}</p>
                <p className="text-primary-foreground/90 text-xs">
                  Use o cupom: <span className="font-mono font-bold">{coupon.code}</span>
                </p>
              </div>
            </div>
            <button 
              className="bg-primary-foreground text-primary font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-primary-foreground/90 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(coupon.code);
              }}
            >
              Copiar
            </button>
          </div>
        );
      }

      case "product": {
        const product = getProduct(highlight.product_id);
        if (!product) return null;

        return (
          <div
            key={highlight.id}
            className="bg-gradient-to-r from-secondary to-muted rounded-xl p-3 flex items-center justify-between shadow-md border border-border"
          >
            <div className="flex items-center gap-2">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="bg-primary/10 p-1.5 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <p className="text-foreground font-bold text-sm">{product.name}</p>
                <p className="text-muted-foreground text-xs">
                  A partir de R$ {product.price.toFixed(2)}
                </p>
              </div>
            </div>
            <span className="bg-primary text-primary-foreground font-semibold px-3 py-1.5 rounded-lg text-xs">
              Em destaque
            </span>
          </div>
        );
      }

      case "custom":
        return (
          <div
            key={highlight.id}
            className="bg-gradient-to-r from-primary/80 to-primary rounded-xl p-3 flex items-center justify-between shadow-md"
          >
            <div className="flex items-center gap-2">
              <div className="bg-primary-foreground/20 p-1.5 rounded-lg">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-primary-foreground font-bold text-sm">
                  {highlight.custom_title}
                </p>
                {highlight.custom_description && (
                  <p className="text-primary-foreground/90 text-xs">
                    {highlight.custom_description}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-2 animate-fade-in">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: 3000,
            stopOnInteraction: false,
            stopOnMouseEnter: true,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {highlights.map((highlight) => (
            <CarouselItem key={highlight.id} className="pl-2">
              {renderHighlight(highlight)}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {highlights.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {highlights.map((_, index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
            />
          ))}
        </div>
      )}
    </div>
  );
}
