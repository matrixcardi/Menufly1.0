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

        // Show alert logic:
        // - Trial: always show banner (we want them to convert)
        // - PIX (send_invoice): always show because it doesn't auto-renew
        // - Card (charge_automatically): only show if cancelled (cancel_at_period_end = true)
        const isPix = result.collection_method === "send_invoice";
        const isCancelled = result.cancel_at_period_end === true;
        const shouldShow = isTrial
          ? daysRemaining >= 0
          : (isPix || isCancelled) && daysRemaining <= 7 && daysRemaining >= 0;

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
