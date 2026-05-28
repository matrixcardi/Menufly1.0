import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsappCredits {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

export function useWhatsappCredits(restaurantId: string | null) {
  const [credits, setCredits] = useState<WhatsappCredits>({ balance: 0, totalPurchased: 0, totalUsed: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return; }

    const { data } = await supabase
      .from("whatsapp_credits" as any)
      .select("balance, total_purchased, total_used")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (data) {
      setCredits({
        balance: (data as any).balance || 0,
        totalPurchased: (data as any).total_purchased || 0,
        totalUsed: (data as any).total_used || 0,
      });
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  return { credits, loading, refetch: fetchCredits };
}
