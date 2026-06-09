import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Plan = "start" | "elite" | null;
type Status = "active" | "trial" | "inactive" | "expired" | "cancelled" | null;

type FeatureName =
  | "nfe"
  | "whatsapp_bot"
  | "bi_financeiro"
  | "cmv_inteligente"
  | "ia_creditos_mensais"
  | "msg_whatsapp_mensais";

const FEATURE_PLANS: Record<FeatureName, Plan[]> = {
  nfe: ["elite"],
  whatsapp_bot: ["elite"],
  bi_financeiro: ["elite"],
  cmv_inteligente: ["elite"],
  ia_creditos_mensais: ["elite"],
  msg_whatsapp_mensais: ["elite"],
};

interface PlanData {
  plan: Plan;
  status: Status;
  isElite: boolean;
  isStart: boolean;
  isActive: boolean;
  isTrialing: boolean;
  loading: boolean;
  hasFeature: (feature: FeatureName) => boolean;
}

export const usePlan = (): PlanData => {
  const [plan, setPlan] = useState<Plan>(null);
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        // Obtém usuário direto do supabase
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.id) {
          setLoading(false);
          return;
        }

        // Busca plano
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_plan, subscription_status")
          .eq("id", user.id)
          .maybeSingle();

        setPlan((profile?.subscription_plan as Plan) || "start");
        setStatus((profile?.subscription_status as Status) || null);

        console.log("[PLAN] Carregado:", {
          plan: profile?.subscription_plan,
          status: profile?.subscription_status,
        });
      } catch (err) {
        console.error("[PLAN] Erro:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const isActive = status === "active" || status === "trial";
  const isTrialing = status === "trial";
  const isElite = plan === "elite" && isActive;
  const isStart = plan === "start" && isActive;

  const hasFeature = (feature: FeatureName): boolean => {
    if (!isActive) return false;
    const allowedPlans = FEATURE_PLANS[feature];
    return allowedPlans.includes(plan);
  };

  return {
    plan,
    status,
    isElite,
    isStart,
    isActive,
    isTrialing,
    loading,
    hasFeature,
  };
};
