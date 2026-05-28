import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbAddonGroup {
  id: string;
  name: string;
  description: string | null;
  type: string;
  required: boolean;
  min_select: number | null;
  max_select: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface DbAddonItem {
  id: string;
  addon_group_id: string;
  name: string;
  description: string | null;
  price: number;
  sort_order: number;
  is_active: boolean;
}

export interface AddonGroupWithItems extends DbAddonGroup {
  items: DbAddonItem[];
}

export function useAddonGroups(restaurantId: string | undefined, productId?: string) {
  const [addonGroups, setAddonGroups] = useState<AddonGroupWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchAddons = async () => {
      try {
        // If productId is provided, only fetch groups linked to that product
        let groupIds: string[] | null = null;

        if (productId) {
          const { data: links, error: linksError } = await supabase
            .from("product_addon_groups")
            .select("addon_group_id, sort_order")
            .eq("product_id", productId)
            .order("sort_order");

          if (linksError) throw linksError;
          if (!links || links.length === 0) {
            setAddonGroups([]);
            setLoading(false);
            return;
          }
          groupIds = links.map((l) => l.addon_group_id);
        }

        let groupsQuery = supabase
          .from("addon_groups")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .order("sort_order");

        if (groupIds) {
          groupsQuery = groupsQuery.in("id", groupIds);
        }

        const [groupsRes, itemsRes] = await Promise.all([
          groupsQuery,
          supabase
            .from("addon_items")
            .select("*")
            .eq("is_active", true)
            .order("sort_order"),
        ]);

        if (groupsRes.error) throw groupsRes.error;
        if (itemsRes.error) throw itemsRes.error;

        const allItems = itemsRes.data || [];
        const groups = (groupsRes.data || []).map((group) => ({
          ...group,
          items: allItems.filter((item) => item.addon_group_id === group.id),
        }));

        setAddonGroups(groups.filter((g) => g.items.length > 0));
      } catch (error) {
        console.error("Error fetching addon groups:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAddons();
  }, [restaurantId, productId]);

  return { addonGroups, loading };
}
