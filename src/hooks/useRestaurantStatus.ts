import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BusinessHour {
  day_of_week: number;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
  period_order: number;
}

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  is_open: boolean;
  min_order: number;
  delivery_available: boolean;
  pickup_available: boolean;
  address: string | null;
  instagram_url: string | null;
  menu_theme: string | null;
  description: string | null;
  manual_override_until: string | null;
  operation_mode: string | null;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  cashback: number | null;
  is_popular: boolean | null;
  is_active: boolean | null;
}

export interface ProductCategoryLink {
  product_id: string;
  category_id: string;
}

interface RestaurantStatus {
  restaurant: Restaurant | null;
  businessHours: BusinessHour[];
  categories: Category[];
  products: Product[];
  productCategoryLinks: ProductCategoryLink[];
  isCurrentlyOpen: boolean;
  isClosingSoon: boolean;
  minutesUntilClose: number | null;
  nextOpenTime: string | null;
  menuTheme: 'dark' | 'light';
  loading: boolean;
}

const DAYS_OF_WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function isTimeInRange(currentTime: string, openTime: string, closeTime: string): boolean {
  const [currentHour, currentMin] = currentTime.split(":").map(Number);
  const [openHour, openMin] = openTime.split(":").map(Number);
  const [closeHour, closeMin] = closeTime.split(":").map(Number);

  const current = currentHour * 60 + currentMin;
  const open = openHour * 60 + openMin;
  const close = closeHour * 60 + closeMin;

  // Handle overnight hours (e.g., 22:00 - 02:00)
  if (close < open) {
    return current >= open || current < close;
  }

  return current >= open && current < close;
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

export function useRestaurantStatus(restaurantId?: string): RestaurantStatus {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategoryLinks, setProductCategoryLinks] = useState<ProductCategoryLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      let restaurantData;
      
      if (restaurantId) {
        // Fetch specific restaurant by ID (for admin preview)
        const { data } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", restaurantId)
          .maybeSingle();
        restaurantData = data;
      } else {
        // Fetch first open restaurant (for public menu)
        const { data } = await supabase
          .from("restaurants")
          .select("*")
          .eq("is_open", true)
          .limit(1)
          .maybeSingle();
        restaurantData = data;
      }

      if (restaurantData) {
        setRestaurant(restaurantData);

        // Fetch business hours, categories, and products in parallel
        const [hoursResult, categoriesResult, productsResult, productCatsResult] = await Promise.all([
          supabase
            .from("business_hours")
            .select("day_of_week, is_open, opening_time, closing_time, period_order")
            .eq("restaurant_id", restaurantData.id)
            .order("day_of_week")
            .order("period_order"),
          supabase
            .from("categories")
            .select("id, name, sort_order")
            .eq("restaurant_id", restaurantData.id)
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("products")
            .select("id, name, description, price, image_url, category_id, cashback, is_popular, is_active")
            .eq("restaurant_id", restaurantData.id)
            .eq("is_active", true)
            .order("sort_order")
            .order("created_at", { ascending: false }),
          supabase
            .from("product_categories")
            .select("product_id, category_id"),
        ]);

        if (hoursResult.data) {
          setBusinessHours(hoursResult.data);
        }
        if (categoriesResult.data) {
          setCategories(categoriesResult.data);
        }
        if (productsResult.data) {
          setProducts(productsResult.data);
        }
        if (productCatsResult.data) {
          setProductCategoryLinks(productCatsResult.data);
        }
      }
    } catch (error) {
      console.error("Error fetching restaurant status:", error);
    } finally {
      setLoading(false);
    }
  };

  const CLOSING_SOON_THRESHOLD = 45; // minutes

  // Calculate if currently open based on business hours
  const calculateStatus = (): { isOpen: boolean; closingSoon: boolean; minutesUntilClose: number | null; nextOpen: string | null } => {
    if (!restaurant) {
      return { isOpen: false, closingSoon: false, minutesUntilClose: null, nextOpen: null };
    }

    // Manual mode: is_open is the sole source of truth
    if (restaurant.operation_mode === 'manual') {
      return { isOpen: restaurant.is_open, closingSoon: false, minutesUntilClose: null, nextOpen: null };
    }

    // Automatic mode: check for manual override first
    if (restaurant.manual_override_until) {
      const overrideEnd = new Date(restaurant.manual_override_until);
      if (overrideEnd > new Date()) {
        return { isOpen: restaurant.is_open, closingSoon: false, minutesUntilClose: null, nextOpen: null };
      }
    }

    if (!restaurant.is_open) {
      return { isOpen: false, closingSoon: false, minutesUntilClose: null, nextOpen: null };
    }

    if (businessHours.length === 0) {
      return { isOpen: restaurant.is_open, closingSoon: false, minutesUntilClose: null, nextOpen: null };
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Get today's hours
    const todayHours = businessHours.filter(h => h.day_of_week === currentDay && h.is_open);

    // Check if we're within any of today's periods
    for (const period of todayHours) {
      if (isTimeInRange(currentTime, period.opening_time, period.closing_time)) {
        // Calculate minutes until close
        const [closeHour, closeMin] = period.closing_time.split(":").map(Number);
        let closeMinutes = closeHour * 60 + closeMin;
        
        // Handle overnight hours
        if (closeMinutes < currentMinutes) {
          closeMinutes += 24 * 60;
        }
        
        const minutesUntilClose = closeMinutes - currentMinutes;
        const isClosingSoon = minutesUntilClose <= CLOSING_SOON_THRESHOLD && minutesUntilClose > 0;
        
        return { 
          isOpen: true, 
          closingSoon: isClosingSoon, 
          minutesUntilClose: minutesUntilClose,
          nextOpen: null 
        };
      }
    }

    // Not currently open, find next opening time
    // First, check if there's a later period today
    const laterToday = todayHours.find(period => {
      const [openHour, openMin] = period.opening_time.split(":").map(Number);
      const [currentHour, currentMin] = currentTime.split(":").map(Number);
      return openHour * 60 + openMin > currentHour * 60 + currentMin;
    });

    if (laterToday) {
      return { isOpen: false, closingSoon: false, minutesUntilClose: null, nextOpen: formatTime(laterToday.opening_time) };
    }

    // Check next days
    for (let i = 1; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      const dayHours = businessHours.filter(h => h.day_of_week === checkDay && h.is_open);
      
      if (dayHours.length > 0) {
        const firstPeriod = dayHours.sort((a, b) => {
          const [aHour, aMin] = a.opening_time.split(":").map(Number);
          const [bHour, bMin] = b.opening_time.split(":").map(Number);
          return (aHour * 60 + aMin) - (bHour * 60 + bMin);
        })[0];

        if (i === 1) {
          return { isOpen: false, closingSoon: false, minutesUntilClose: null, nextOpen: `amanhã às ${formatTime(firstPeriod.opening_time)}` };
        } else {
          return { isOpen: false, closingSoon: false, minutesUntilClose: null, nextOpen: `${DAYS_OF_WEEK[checkDay]} às ${formatTime(firstPeriod.opening_time)}` };
        }
      }
    }

    return { isOpen: false, closingSoon: false, minutesUntilClose: null, nextOpen: null };
  };

  const status = calculateStatus();
  const menuTheme = (restaurant?.menu_theme === 'light' ? 'light' : 'dark') as 'dark' | 'light';

  return {
    restaurant,
    businessHours,
    categories,
    products,
    productCategoryLinks,
    isCurrentlyOpen: status.isOpen,
    isClosingSoon: status.closingSoon,
    minutesUntilClose: status.minutesUntilClose,
    nextOpenTime: status.nextOpen,
    menuTheme,
    loading,
  };
}
