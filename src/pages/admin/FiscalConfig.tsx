import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProviderSelection from "@/components/admin/fiscal/ProviderSelection";
import FiscalWizard from "@/components/admin/fiscal/FiscalWizard";
import FiscalStatus from "@/components/admin/fiscal/FiscalStatus";
import { Skeleton } from "@/components/ui/skeleton";

export default function FiscalConfig() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"focus_nfe" | "speed_nfe" | null>(null);
  const [fiscalConfig, setFiscalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get restaurant ID from localStorage or context
    const storedRestaurantId = localStorage.getItem("restaurant_id");
    if (storedRestaurantId) {
      setRestaurantId(storedRestaurantId);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchFiscalConfig = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("fiscal_config")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (error) {
          console.error("[FISCAL] Erro ao carregar config:", error);
        } else {
          setFiscalConfig(data);
          console.log("[FISCAL] Config carregada:", data);
        }
      } catch (err) {
        console.error("[FISCAL] Exception:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFiscalConfig();
  }, [restaurantId]);

  const handleProviderSelect = (provider: "focus_nfe" | "speed_nfe") => {
    setSelectedProvider(provider);
    setShowWizard(true);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setSelectedProvider(null);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    setSelectedProvider(null);
    // Refresh fiscal config after wizard completion
    const refreshConfig = async () => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("fiscal_config")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (error) throw error;
        setFiscalConfig(data);
      } catch (error) {
        console.error("[FISCAL] Erro ao buscar config:", error);
      } finally {
        setLoading(false);
      }
    };
    refreshConfig();
  };

  const handleEditConfig = () => {
    if (fiscalConfig) {
      setSelectedProvider(fiscalConfig.provider);
      setShowWizard(true);
    }
  };

  const handleRefreshConfig = () => {
    const refreshConfig = async () => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("fiscal_config")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (error) throw error;
        setFiscalConfig(data);
      } catch (error) {
        console.error("[FISCAL] Erro ao buscar config:", error);
      } finally {
        setLoading(false);
      }
    };
    refreshConfig();
  };

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {showWizard && selectedProvider ? (
        <FiscalWizard
          provider={selectedProvider}
          onCancel={handleWizardCancel}
          onComplete={handleWizardComplete}
          initialData={fiscalConfig}
        />
      ) : fiscalConfig && fiscalConfig.is_configured ? (
        <FiscalStatus
          config={fiscalConfig}
          onRefresh={handleRefreshConfig}
          onEdit={handleEditConfig}
        />
      ) : (
        <ProviderSelection onProviderSelect={handleProviderSelect} />
      )}
    </div>
  );
}
