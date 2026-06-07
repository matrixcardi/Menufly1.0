import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";

export function useCurrentRestaurant() {
  const { user, selectedRestaurant, selectedRestaurantId } = useRestaurantContext();

  const { data, isLoading } = useQuery({
    queryKey: ["currentRestaurant", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // If a restaurant is already selected in the context, return it with access type
      if (selectedRestaurant) {
        // Check if user is owner
        const { data: owned } = await supabase
          .from("restaurants")
          .select("id")
          .eq("id", selectedRestaurant.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (owned) {
          return { ...selectedRestaurant, accessType: 'owner' as const };
        }

        // Check if user is collaborator
        const { data: collab } = await supabase
          .from("restaurant_collaborators")
          .select("role")
          .eq("restaurant_id", selectedRestaurant.id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (collab) {
          return { 
            ...selectedRestaurant, 
            accessType: 'collaborator' as const, 
            collaboratorRole: collab.role 
          };
        }

        return selectedRestaurant;
      }

      // 1. Tenta como dono
      const { data: owned } = await supabase
        .from("restaurants")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (owned) return { ...owned, accessType: 'owner' as const };

      // 2. Tenta como colaborador
      const { data: collab } = await supabase
        .from("restaurant_collaborators")
        .select(`
          role,
          restaurant:restaurants (*)
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (collab?.restaurant) {
        return { 
          ...collab.restaurant, 
          accessType: 'collaborator' as const, 
          collaboratorRole: collab.role 
        };
      }

      return null;
    },
    enabled: !!user?.id,
  });

  return { 
    restaurant: data, 
    isLoading,
    isOwner: data?.accessType === 'owner',
    isCollaborator: data?.accessType === 'collaborator',
    collaboratorRole: data?.collaboratorRole,
  };
}
