import { useState } from "react";
import {
  FileText, FileX, CheckCircle, XCircle,
  AlertCircle, Loader2
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmitirNFeButtonProps {
  orderId: string;
  orderTotal: number;
  orderNumber?: string;
  restaurantId: string;
  fiscalActive: boolean;
  fiscalConfigured: boolean;
  fiscalProvider?: string;
  fiscalEnvironment?: string;
  existingInvoice?: {
    id: string;
    status: string;
    nfe_number?: string;
  };
  onInvoiceUpdate?: (invoice: any) => void;
}

export default function EmitirNFeButton({
  orderId,
  orderTotal,
  orderNumber,
  restaurantId,
  fiscalActive,
  fiscalConfigured,
  fiscalProvider,
  fiscalEnvironment,
  existingInvoice,
  onInvoiceUpdate,
}: EmitirNFeButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const providerName = fiscalProvider === "focus_nfe" ? "Focus NFe" : "SpeedNFe";
  const environmentLabel = fiscalEnvironment === "homologation" ? "Homologação" : "Produção";
  const displayOrderNumber = orderNumber || orderId.slice(0, 8);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleEmitir = async () => {
    if (!fiscalProvider) return;

    setLoading(true);
    try {
      // 1. INSERT fiscal_invoices status = 'processing'
      const { data: invoice, error: insertError } = await supabase
        .from("fiscal_invoices")
        .insert({
          restaurant_id: restaurantId,
          order_id: orderId,
          provider: fiscalProvider,
          status: "processing",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Atualiza estado local imediatamente
      onInvoiceUpdate?.({ ...invoice, status: "processing" });

      // 3. Toast + log
      toast({ title: "Processando nota fiscal..." });
      console.log("[FISCAL] Emitindo NFe para pedido:", orderId);

      // 4. Simula delay da API (2 segundos)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 5. UPDATE para authorized
      const nfeNumber = `NFe-MOCK-${Date.now().toString().slice(-6)}`;
      const { error: updateError } = await supabase
        .from("fiscal_invoices")
        .update({
          status: "authorized",
          nfe_number: nfeNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      // 6. Atualiza estado local
      onInvoiceUpdate?.({ ...invoice, status: "authorized", nfe_number: nfeNumber });

      // 7. Toast sucesso + log
      toast({
        title: "✓ NFe emitida com sucesso!",
        description: `Número: ${nfeNumber} (Simulação)`,
        variant: "default",
      });
      console.log("[FISCAL] NFe emitida (mock):", { orderId, nfe_number: nfeNumber });
    } catch (error: any) {
      console.error("[FISCAL] Erro:", error);

      // Tratamento de erro
      if (existingInvoice?.id) {
        await supabase
          .from("fiscal_invoices")
          .update({
            status: "error",
            error_message: error.message,
          })
          .eq("id", existingInvoice.id);
      }

      onInvoiceUpdate?.({ status: "error", error_message: error.message });
      toast({
        title: "Erro ao emitir NFe",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Estado 1: NÃO configurado
  if (!fiscalConfigured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" disabled className="h-8">
              <FileX className="w-3 h-3 mr-1" />
              NFe
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Configure o módulo fiscal primeiro</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Estado 2: Configurado mas INATIVO
  if (!fiscalActive) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" disabled className="h-8">
              <FileX className="w-3 h-3 mr-1" />
              NFe
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Emissão fiscal desativada</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Estado 4: ATIVO + status 'processing'
  if (existingInvoice?.status === "processing") {
    return (
      <Button variant="secondary" size="sm" disabled className="h-8 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Emitindo...
      </Button>
    );
  }

  // Estado 5: ATIVO + status 'authorized'
  if (existingInvoice?.status === "authorized") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" disabled className="h-8 bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="w-3 h-3 mr-1" />
              NFe Emitida
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Nota nº {existingInvoice.nfe_number}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Estado 6: ATIVO + status 'error'
  if (existingInvoice?.status === "error") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="h-8" disabled={loading}>
            <AlertCircle className="w-3 h-3 mr-1" />
            Tentar novamente
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir Nota Fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>Pedido: #{displayOrderNumber}</p>
                <p>Valor: {formatCurrency(orderTotal)}</p>
                <div className="pt-2 border-t">
                  <p>Provedor: {providerName}</p>
                  <Badge
                    variant={fiscalEnvironment === "homologation" ? "secondary" : "default"}
                    className={`mt-1 ${
                      fiscalEnvironment === "production"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-orange-500 hover:bg-orange-600"
                    }`}
                  >
                    {environmentLabel}
                  </Badge>
                </div>
                {fiscalEnvironment === "homologation" && (
                  <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
                    ⚠️ Nota emitida em ambiente de teste
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmitir} disabled={loading}>
              {loading ? "Emitindo..." : "Emitir NFe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Estado 7: ATIVO + status 'cancelled'
  if (existingInvoice?.status === "cancelled") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="secondary" size="sm" className="h-8 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700" disabled={loading}>
            <XCircle className="w-3 h-3 mr-1" />
            Reemitir NFe
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir Nota Fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>Pedido: #{displayOrderNumber}</p>
                <p>Valor: {formatCurrency(orderTotal)}</p>
                <div className="pt-2 border-t">
                  <p>Provedor: {providerName}</p>
                  <Badge
                    variant={fiscalEnvironment === "homologation" ? "secondary" : "default"}
                    className={`mt-1 ${
                      fiscalEnvironment === "production"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-orange-500 hover:bg-orange-600"
                    }`}
                  >
                    {environmentLabel}
                  </Badge>
                </div>
                {fiscalEnvironment === "homologation" && (
                  <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
                    ⚠️ Nota emitida em ambiente de teste
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmitir} disabled={loading}>
              {loading ? "Emitindo..." : "Emitir NFe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Estado 3: ATIVO + sem nota
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" disabled={loading}>
          <FileText className="w-3 h-3 mr-1" />
          Emitir NFe
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Emitir Nota Fiscal?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>Pedido: #{displayOrderNumber}</p>
              <p>Valor: {formatCurrency(orderTotal)}</p>
              <div className="pt-2 border-t">
                <p>Provedor: {providerName}</p>
                <Badge
                  variant={fiscalEnvironment === "homologation" ? "secondary" : "default"}
                  className={`mt-1 ${
                    fiscalEnvironment === "production"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {environmentLabel}
                </Badge>
              </div>
              {fiscalEnvironment === "homologation" && (
                <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
                  ⚠️ Nota emitida em ambiente de teste
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleEmitir} disabled={loading}>
            {loading ? "Emitindo..." : "Emitir NFe"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
