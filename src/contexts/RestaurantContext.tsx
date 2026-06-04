import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export interface AdminRestaurant {
  id: string;
  name: string;
  logo_url: string | null;
  is_open: boolean;
  slug: string;
  whatsapp_connected: boolean | null;
  operation_mode: string;
  manual_override_until: string | null;
  notification_sound: string;
  default_delivery_time_min: number | null;
}

interface RestaurantContextType {
  user: User | null;
  restaurants: AdminRestaurant[];
  selectedRestaurantId: string | "all";
  selectedRestaurant: AdminRestaurant | null;
  selectedRestaurantIds: string[];
  setSelectedRestaurantId: (id: string | "all") => void;
  loading: boolean;
  refreshRestaurants: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType>({
  user: null,
  restaurants: [],
  selectedRestaurantId: "all",
  selectedRestaurant: null,
  selectedRestaurantIds: [],
  setSelectedRestaurantId: () => {},
  loading: true,
  refreshRestaurants: async () => {},
});

export function useRestaurantContext() {
  return useContext(RestaurantContext);
}

interface Props {
  children: ReactNode;
  user: User;
  isCollaborator: boolean;
  isMaster: boolean;
  collabRestaurantId: string | null;
}

export function RestaurantProvider({ children, user, isCollaborator, isMaster, collabRestaurantId }: Props) {
  const RESTAURANT_SELECT = "id, name, logo_url, is_open, slug, whatsapp_connected, operation_mode, manual_override_until, notification_sound, default_delivery_time_min";

  const getMasterManagedRestaurantId = () => {
    if (typeof window === "undefined") return null;
    const isMasterManaging = localStorage.getItem("masterManaging") === "true";
    if (!isMasterManaging) return null;
    const managedRestaurantId = localStorage.getItem("masterManagedRestaurantId");
    if (managedRestaurantId && managedRestaurantId !== "all") return managedRestaurantId;

    // Backward compatibility for sessions created before masterManagedRestaurantId existed.
    const legacySelectedId = localStorage.getItem("selectedRestaurantId");
    return legacySelectedId && legacySelectedId !== "all" ? legacySelectedId : null;
  };

  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);

  const fetchRestaurants = async () => {
    console.log("[RestaurantContext] fetchRestaurants called", { 
      userId: user.id, 
      isMaster, 
      isCollaborator, 
      collabRestaurantId 
    });

    if (isMaster) {
      const managedRestaurantId = getMasterManagedRestaurantId();
      const isMasterManaging = typeof window !== "undefined" && localStorage.getItem("masterManaging") === "true";

      if (isMasterManaging && !managedRestaurantId) {
        localStorage.removeItem("masterManaging");
        localStorage.removeItem("masterManagedRestaurantId");
        setRestaurants([]);
        setSelectedRestaurantId("all");
        setLoading(false);
        return;
      }

      // When master is impersonating a specific restaurant, scope to JUST that one
      if (managedRestaurantId) {
        const { data } = await supabase
          .from("restaurants")
          .select(RESTAURANT_SELECT)
          .eq("id", managedRestaurantId);

        const list = (data as AdminRestaurant[]) || [];
        setRestaurants(list);
        if (list.length > 0) {
          setSelectedRestaurantId(list[0].id);
        } else {
          // Managed restaurant no longer exists — exit impersonation
          localStorage.removeItem("masterManaging");
          localStorage.removeItem("masterManagedRestaurantId");
        }
        setLoading(false);
        return;
      }

      // Master not impersonating — sees ALL restaurants
      const { data } = await supabase
        .from("restaurants")
        .select(RESTAURANT_SELECT)
        .order("created_at", { ascending: true });

      setRestaurants((data as AdminRestaurant[]) || []);
    } else if (isCollaborator && collabRestaurantId) {
      console.log("[RestaurantContext] Fetching collaborator restaurant", { collabRestaurantId });
      const { data, error } = await supabase
        .from("restaurants")
        .select(RESTAURANT_SELECT)
        .eq("id", collabRestaurantId);
      
      if (error) {
        console.error("[RestaurantContext] Error fetching collaborator restaurant:", error);
      }
      
      const list = (data as AdminRestaurant[]) || [];
      console.log("[RestaurantContext] Collaborator restaurant found:", list.length);
      setRestaurants(list);
    } else {
      // Fetch owned restaurants
      console.log("[RestaurantContext] Fetching owned restaurants for user_id:", user.id);
      const { data: owned, error: ownedError } = await supabase
        .from("restaurants")
        .select(RESTAURANT_SELECT)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (ownedError) {
        console.error("[RestaurantContext] Error fetching owned restaurants:", ownedError);
      }

      console.log("[RestaurantContext] Owned restaurants found:", (owned || []).length);

      // Fetch linked (collaborated) restaurants
      const { data: collabLinks, error: collabError } = await supabase
        .from("restaurant_collaborators")
        .select("restaurant_id")
        .eq("user_id", user.id);

      if (collabError) {
        console.error("[RestaurantContext] Error fetching collaborator links:", collabError);
      }

      console.log("[RestaurantContext] Collaborator links found:", (collabLinks || []).length);

      let linked: AdminRestaurant[] = [];
      if (collabLinks && collabLinks.length > 0) {
        const linkedIds = collabLinks.map(c => c.restaurant_id);
        const ownedIds = (owned || []).map(r => r.id);
        const newIds = linkedIds.filter(id => !ownedIds.includes(id));

        if (newIds.length > 0) {
          const { data: linkedData } = await supabase
            .from("restaurants")
            .select(RESTAURANT_SELECT)
            .in("id", newIds)
            .order("created_at", { ascending: true });
          linked = (linkedData as AdminRestaurant[]) || [];
        }
      }

      const allRestaurants = [...(owned as AdminRestaurant[] || []), ...linked];
      console.log("[RestaurantContext] Total restaurants for user:", allRestaurants.length);
      
      if (allRestaurants.length === 0) {
        console.error("[RestaurantContext] NO RESTAURANTS FOUND FOR USER:", user.id);
        console.error("[RestaurantContext] User email:", user.email);
        console.error("[RestaurantContext] Please check if restaurants table has user_id set correctly");
      }
      
      setRestaurants(allRestaurants);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRestaurants();

    // Subscribe to restaurant changes
    const channel = supabase
      .channel("restaurant-context-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, () => {
        fetchRestaurants();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id, isCollaborator, isMaster, collabRestaurantId]);

  // Persist selection (only for non-master users to avoid cross-session issues)
  useEffect(() => {
    const managedRestaurantId = getMasterManagedRestaurantId();
    if (isMaster && managedRestaurantId) return;
    if (isMaster) return; // Don't persist for master users
    localStorage.setItem("selectedRestaurantId", selectedRestaurantId);
  }, [selectedRestaurantId, isMaster]);

  // If selected restaurant no longer exists, reset to "all" (or first)
  // Skip this check while still loading to avoid race conditions (e.g., master role not yet resolved)
  useEffect(() => {
    if (loading) return;

    const managedRestaurantId = getMasterManagedRestaurantId();
    if (isMaster && managedRestaurantId) {
      if (selectedRestaurantId !== managedRestaurantId) {
        setSelectedRestaurantId(managedRestaurantId);
      }
      return;
    }

    if (restaurants.length > 0) {
      if (selectedRestaurantId !== "all" && !restaurants.find(r => r.id === selectedRestaurantId)) {
        setSelectedRestaurantId(restaurants.length === 1 ? restaurants[0].id : "all");
      }
    }
    // If only 1 restaurant, auto-select it
    if (restaurants.length === 1 && selectedRestaurantId === "all") {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, loading, isMaster, selectedRestaurantId]);

  const selectedRestaurant = selectedRestaurantId === "all" 
    ? null 
    : restaurants.find(r => r.id === selectedRestaurantId) || null;

  const selectedRestaurantIds = selectedRestaurantId === "all"
    ? restaurants.map(r => r.id)
    : [selectedRestaurantId];

  const setScopedSelectedRestaurantId = (id: string | "all") => {
    const managedRestaurantId = getMasterManagedRestaurantId();
    if (isMaster && managedRestaurantId) {
      setSelectedRestaurantId(managedRestaurantId);
      return;
    }
    setSelectedRestaurantId(id);
  };

  return (
    <RestaurantContext.Provider value={{
      user,
      restaurants,
      selectedRestaurantId,
      selectedRestaurant,
      selectedRestaurantIds,
      setSelectedRestaurantId: setScopedSelectedRestaurantId,
      loading,
      refreshRestaurants: fetchRestaurants,
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}
