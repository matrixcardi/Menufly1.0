import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlan = "start" | "elite" | "assessoria" | null;

export function useSubscriptionPlan(userId: string | undefined) {
  const [plan, setPlan] = useState<SubscriptionPlan>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchPlan() {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("id", userId!)
        .maybeSingle();

      if (data) {
        setPlan(((data as any).subscription_plan as SubscriptionPlan) || "start");
      }
      setLoading(false);
    }

    fetchPlan();
  }, [userId]);

  // Assessoria is an internal premium plan equivalent to Elite (with higher monthly credits)
  const isElite = plan === "elite" || plan === "assessoria";
  const isAssessoria = plan === "assessoria";
  const canAccessWhatsAppBot = isElite;

  return { plan, isElite, isAssessoria, loading, canAccessWhatsAppBot };
}
