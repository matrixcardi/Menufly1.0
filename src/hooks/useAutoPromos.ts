import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AutoPromo {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: number;
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  benefit_type: string;
  benefit_value: number | null;
  benefit_product_id: string | null;
  show_in_menu: boolean;
}

interface CartItemForEval {
  product: { id: string; categoryId?: string | null };
  quantity: number;
  unitPrice: number;
}

export interface ActiveBenefit {
  promoId: string;
  promoName: string;
  promoDescription: string | null;
  benefitType: string;
  benefitValue: number | null;
  benefitProductId: string | null;
  freeShipping: boolean;
  discountAmount: number;
}

export function useAutoPromos(restaurantId: string | null) {
  const [autoPromos, setAutoPromos] = useState<AutoPromo[]>([]);

  useEffect(() => {
    if (!restaurantId) return;

    const fetchPromos = () => {
      supabase
        .from("auto_promos")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) setAutoPromos(data as any);
        });
    };

    fetchPromos();

    // Subscribe to realtime changes so admin toggling promos reflects instantly
    const channel = supabase
      .channel(`auto_promos_${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auto_promos",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchPromos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return autoPromos;
}

export function evaluateAutoPromos(
  promos: AutoPromo[],
  items: CartItemForEval[],
  subtotal: number,
  productCategories: Record<string, string[]> // productId -> categoryIds
): ActiveBenefit[] {
  const benefits: ActiveBenefit[] = [];

  for (const promo of promos) {
    let triggered = false;

    switch (promo.trigger_type) {
      case "min_items": {
        const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
        triggered = totalItems >= promo.trigger_value;
        break;
      }
      case "min_value": {
        triggered = subtotal >= promo.trigger_value;
        break;
      }
      case "specific_product": {
        triggered = items.some((i) => i.product.id === promo.trigger_product_id);
        break;
      }
      case "specific_category": {
        const catItems = items.filter((i) => {
          const cats = productCategories[i.product.id] || [];
          return cats.includes(promo.trigger_category_id || "");
        });
        const catQty = catItems.reduce((sum, i) => sum + i.quantity, 0);
        triggered = catQty >= promo.trigger_value;
        break;
      }
    }

    if (triggered) {
      let discountAmount = 0;
      let freeShipping = false;

      switch (promo.benefit_type) {
        case "free_shipping":
          freeShipping = true;
          break;
        case "percentage_discount":
          discountAmount = subtotal * ((promo.benefit_value || 0) / 100);
          break;
        case "fixed_discount":
          discountAmount = Math.min(promo.benefit_value || 0, subtotal);
          break;
        case "free_product":
          // The free product's price is the discount
          break;
      }

      benefits.push({
        promoId: promo.id,
        promoName: promo.name,
        promoDescription: promo.description,
        benefitType: promo.benefit_type,
        benefitValue: promo.benefit_value,
        benefitProductId: promo.benefit_product_id,
        freeShipping,
        discountAmount,
      });
    }
  }

  return benefits;
}
