import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";

export function useCurrentPlan() {
  const { user } = useRestaurantContext();

  const { data: plan, isLoading } = useQuery({
    queryKey: ["currentPlan", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("id", user.id)
        .maybeSingle();

      if (!data) return null;

      const subscriptionPlan = (data as any).subscription_plan || "start";
      
      // Define plan limits
      const planLimits: Record<string, { max_collaborators: number }> = {
        start: { max_collaborators: 1 },
        elite: { max_collaborators: 5 },
        assessoria: { max_collaborators: 10 },
      };

      return {
        plan: subscriptionPlan,
        max_collaborators: planLimits[subscriptionPlan]?.max_collaborators || 1,
      };
    },
    enabled: !!user?.id,
  });

  return { plan, isLoading };
}
