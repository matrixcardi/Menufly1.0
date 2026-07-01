import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FiscalWizard from "@/components/admin/fiscal/FiscalWizard";
import FiscalStatus from "@/components/admin/fiscal/FiscalStatus";
import { FiscalWelcome } from "@/components/admin/fiscal/FiscalWelcome";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireElite } from "@/components/common/RequireElite";

function FiscalConfigContent() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [fiscalConfig, setFiscalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRestaurantId = localStorage.getItem("restaurant_id");
    if (storedRestaurantId) {
      setRestaurantId(storedRestaurantId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchFiscalConfig = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fiscal_config" as any)
        .select("*")
        .eq("restaurant_id", id)
        .maybeSingle();

      if (error) {
        console.error("[FISCAL] Erro ao carregar config:", error);
      } else {
        setFiscalConfig(data);
      }
    } catch (err) {
      console.error("[FISCAL] Exception:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    fetchFiscalConfig(restaurantId);
  }, [restaurantId]);

  const handleWizardCancel = () => setShowWizard(false);

  const handleWizardComplete = () => {
    setShowWizard(false);
    if (restaurantId) fetchFiscalConfig(restaurantId);
  };

  const handleEditConfig = () => {
    if (fiscalConfig) setShowWizard(true);
  };

  const handleConfigureNow = () => setShowWizard(true);

  const handleRefreshConfig = () => {
    if (restaurantId) fetchFiscalConfig(restaurantId);
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
      {showWizard ? (
        <FiscalWizard onCancel={handleWizardCancel} onComplete={handleWizardComplete} initialData={fiscalConfig} />
      ) : fiscalConfig && fiscalConfig.is_configured ? (
        <FiscalStatus config={fiscalConfig} onRefresh={handleRefreshConfig} onEdit={handleEditConfig} />
      ) : (
        <FiscalWelcome onConfigure={handleConfigureNow} />
      )}
    </div>
  );
}

export default function FiscalConfig() {
  return (
    <RequireElite
      feature="nfe"
      featureName="Notas Fiscais Eletrônicas (NFCe)"
      featureDescription="Emita NFCe diretamente pelo MenuFly através da Spedy, sem sair do painel."
      featureBullets={[
        "Emissão manual ou automática a cada pedido pago",
        "DANFE (PDF) e XML disponíveis por pedido",
        "Cancelamento de nota dentro do prazo legal",
        "Conforme exigências da SEFAZ",
      ]}
    >
      <FiscalConfigContent />
    </RequireElite>
  );
}
