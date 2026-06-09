import { Construction, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'

// TODO: Uncomment when NFe feature is ready for launch
// import { useEffect, useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import FiscalWizard from "@/components/admin/fiscal/FiscalWizard";
// import FiscalStatus from "@/components/admin/fiscal/FiscalStatus";
// import { FiscalWelcome } from "@/components/admin/fiscal/FiscalWelcome";
// import { Skeleton } from "@/components/ui/skeleton";
// import { RequireElite } from "@/components/common/RequireElite";

const FiscalConfig = () => {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="p-12 border-2 border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="rounded-full bg-amber-500/10 p-6 relative">
            <Construction className="w-16 h-16 text-amber-600" />
            <Sparkles className="w-6 h-6 text-amber-500 absolute -top-1 -right-1" />
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-2">
              🚧 Em Breve
            </h2>
            <h3 className="text-xl font-semibold text-foreground">
              Notas Fiscais Eletrônicas (NFCe)
            </h3>
          </div>

          <p className="text-muted-foreground max-w-md text-lg">
            Estamos finalizando os últimos detalhes para que você
            possa emitir suas notas fiscais direto pelo MenuFly.
          </p>

          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 max-w-md w-full">
            <p className="text-sm text-muted-foreground">
              ✨ Em breve disponível para o plano <strong className="text-amber-600">MenuFly Elite</strong>
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Estamos trabalhando para entregar a melhor experiência possível 💪
          </p>
        </div>
      </Card>
    </div>
  )
}

export default FiscalConfig

/*
// ORIGINAL CODE - COMMENTED OUT UNTIL NFe IS READY
function FiscalConfigContent() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
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

  const handleWizardCancel = () => {
    setShowWizard(false);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
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
      setShowWizard(true);
    }
  };

  const handleConfigureNow = () => {
    setShowWizard(true);
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
      {showWizard ? (
        <FiscalWizard
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
      featureDescription="Emita NFCe diretamente pelo MenuFly, sem precisar de outras contas ou serviços externos."
      featureBullets={[
        "Emissão automática a cada pedido finalizado",
        "DANFE enviado automaticamente ao cliente",
        "Cancelamento e consulta de notas",
        "Conforme exigências da SEFAZ",
        "Suporte completo da nossa equipe",
      ]}
    >
      <FiscalConfigContent />
    </RequireElite>
  );
}
*/
