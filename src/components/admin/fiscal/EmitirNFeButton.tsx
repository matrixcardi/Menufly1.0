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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";

const MIN_JUSTIFICATION_LENGTH = 15;

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
    pdf_url?: string;
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
  const { hasFeature, loading: planLoading } = usePlan();
  const [loading, setLoading] = useState(false);
  const [justification, setJustification] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Não mostra nada enquanto carrega o plano
  if (planLoading) return null;

  // Cliente sem feature NFe não vê o botão
  if (!hasFeature('nfe')) return null;

  const providerName = fiscalProvider === "spedy" ? "Spedy" : fiscalProvider || "";
  const environmentLabel = fiscalEnvironment === "development" ? "Sandbox" : "Produção";
  const displayOrderNumber = orderNumber || orderId.slice(0, 8);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleEmitir = async () => {
    setLoading(true);
    try {
      toast({ title: "Processando nota fiscal..." });
      onInvoiceUpdate?.({ status: "processing" });

      const { data, error } = await supabase.functions.invoke("spedy-issue-invoice", {
        body: { order_id: orderId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onInvoiceUpdate?.({ id: data.invoice_id, status: data.status ?? "processing" });

      if (data.status === "authorized") {
        toast({ title: "✓ NFe emitida com sucesso!" });
      } else {
        toast({ title: "Nota fiscal enviada", description: "Aguardando autorização da SEFAZ..." });
      }
    } catch (error: any) {
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

  const handleCancelar = async () => {
    if (justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
      toast({ title: `Justificativa deve ter no mínimo ${MIN_JUSTIFICATION_LENGTH} caracteres`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("spedy-cancel-invoice", {
        body: { order_id: orderId, justification: justification.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onInvoiceUpdate?.({ status: "cancelled" });
      toast({ title: "Nota fiscal cancelada" });
      setCancelDialogOpen(false);
      setJustification("");
    } catch (error: any) {
      toast({ title: "Erro ao cancelar NFe", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmationDialog = (triggerLabel: string, triggerClassName: string, triggerVariant: "default" | "secondary" = "default") => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" className={`h-8 ${triggerClassName}`} disabled={loading}>
          <FileText className="w-3 h-3 mr-1" />
          {triggerLabel}
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
                  variant={fiscalEnvironment === "development" ? "secondary" : "default"}
                  className={`mt-1 ${
                    fiscalEnvironment === "development"
                      ? "bg-orange-500 hover:bg-orange-600"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {environmentLabel}
                </Badge>
              </div>
              {fiscalEnvironment === "development" && (
                <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
                  ⚠️ Nota emitida em ambiente de teste (sandbox)
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

  // Estado: ATIVO + status 'processing'
  if (existingInvoice?.status === "processing") {
    return (
      <Button variant="secondary" size="sm" disabled className="h-8 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Emitindo...
      </Button>
    );
  }

  // Estado: ATIVO + status 'authorized'
  if (existingInvoice?.status === "authorized") {
    return (
      <div className="flex items-center gap-1">
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
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" disabled={loading}>
              Cancelar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Nota Fiscal?</AlertDialogTitle>
              <AlertDialogDescription>
                Cancelamento de NFC-e tem prazo legal (geralmente ~30 minutos após a autorização, varia por estado).
                Informe o motivo:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={`Justificativa (mínimo ${MIN_JUSTIFICATION_LENGTH} caracteres)`}
              rows={3}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setJustification("")}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelar} disabled={loading}>
                {loading ? "Cancelando..." : "Confirmar Cancelamento"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Estado: ATIVO + status 'error'
  if (existingInvoice?.status === "error") {
    return confirmationDialog(
      "Tentar novamente",
      "bg-transparent text-destructive border border-destructive hover:bg-destructive/10",
      "secondary"
    );
  }

  // Estado: ATIVO + status 'cancelled'
  if (existingInvoice?.status === "cancelled") {
    return confirmationDialog(
      "Reemitir NFe",
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
      "secondary"
    );
  }

  // Estado: ATIVO + sem nota
  return confirmationDialog("Emitir NFe", "bg-blue-600 hover:bg-blue-700 text-white");
}
