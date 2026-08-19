import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionAlertData {
  showAlert: boolean;
  daysRemaining: number | null;
  subscriptionEnd: string | null;
  isTrial: boolean;
  trialExpired: boolean;
  subscribed: boolean;
  loading: boolean;
}

export function useSubscriptionAlert(userId: string | undefined): SubscriptionAlertData {
  const [data, setData] = useState<SubscriptionAlertData>({
    showAlert: false,
    daysRemaining: null,
    subscriptionEnd: null,
    isTrial: false,
    trialExpired: false,
    subscribed: false,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    async function check() {
      try {
        const { data: result, error } = await supabase.functions.invoke("check-subscription");

        if (error || !result) {
          setData(prev => ({ ...prev, loading: false }));
          return;
        }

        const isTrial = !!result.is_trial;
        const trialExpired = !!result.trial_expired;
        const subscribed = !!result.subscribed;

        if (!result.subscription_end) {
          setData({
            showAlert: trialExpired,
            daysRemaining: trialExpired ? 0 : null,
            subscriptionEnd: null,
            isTrial,
            trialExpired,
            subscribed,
            loading: false,
          });
          return;
        }

        const endDate = new Date(result.subscription_end);
        const now = new Date();
        const diffMs = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // O aviso depende de quem renova a assinatura:
        // - Trial: sempre, para converter
        // - HyperCash / PIX: ciclos avulsos, ninguém renova pelo cliente, então
        //   avisa na última semana
        // - Stripe (base legada): a cobrança é automática. Avisar aqui só
        //   assustaria quem não precisa fazer nada — o alerta fica reservado a
        //   quem já pediu cancelamento e vai perder o acesso no fim do ciclo.
        const isLegacyStripe = result.gateway === "stripe";
        const expiringWindow = daysRemaining <= 7 && daysRemaining >= 0;

        const shouldShow = isTrial
          ? daysRemaining >= 0
          : isLegacyStripe
            ? result.cancel_at_period_end === true && expiringWindow
            : expiringWindow;

        setData({
          showAlert: shouldShow,
          daysRemaining,
          subscriptionEnd: result.subscription_end,
          isTrial,
          trialExpired,
          subscribed,
          loading: false,
        });
      } catch {
        setData(prev => ({ ...prev, loading: false }));
      }
    }

    check();
  }, [userId]);

  return data;
}
