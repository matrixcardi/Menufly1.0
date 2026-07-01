import { useState } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, FileText, Webhook } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { maskCpfCnpj } from "@/utils/cpfCnpj";

interface FiscalStatusProps {
  config: any;
  onRefresh: () => void;
  onEdit: () => void;
}

export default function FiscalStatus({ config, onRefresh, onEdit }: FiscalStatusProps) {
  const { toast } = useToast();
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const isActive = config.is_active;

  const updateSettings = async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("spedy-update-settings", {
        body: { restaurant_id: config.restaurant_id, ...payload },
      });
      if (error) throw error;
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar configuração", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (newValue: boolean) => {
    if (newValue === false) {
      setShowDeactivateConfirm(true);
      return;
    }
    await updateSettings({ is_active: true });
    toast({ title: "✓ Emissão fiscal ativada" });
  };

  const handleConfirmDeactivate = async () => {
    setShowDeactivateConfirm(false);
    await updateSettings({ is_active: false });
    toast({ title: "Emissão fiscal desativada" });
  };

  const handleAutoIssueModeChange = async (automatic: boolean) => {
    await updateSettings({ auto_issue_mode: automatic ? "automatic" : "manual" });
    toast({ title: automatic ? "Emissão automática ativada" : "Emissão manual ativada" });
  };

  const handleReconnectWebhook = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("spedy-register-webhook", {
        body: { restaurant_id: config.restaurant_id },
      });
      if (error) throw error;
      toast({ title: "✓ Webhook reconectado com a Spedy" });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao reconectar webhook", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold">🧾 Notas Fiscais Eletrônicas (NFCe)</h1>
      </div>

      {/* Main Status Card */}
      <Card className="border-2">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardHeader className="p-0 pb-2">
              <h2 className="text-2xl font-bold">Configuração Fiscal</h2>
              <p className="text-muted-foreground">Sua emissão de NFCe via Spedy está configurada</p>
            </CardHeader>
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={`text-base px-4 py-2 ${isActive ? "bg-green-600 hover:bg-green-700" : ""}`}
          >
            {isActive ? "✓ ATIVO" : "✗ INATIVO"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Column 1: Company Data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Dados da Empresa</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Razão Social:</span>
                  <p className="font-medium">{config.razao_social}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">CNPJ:</span>
                  <p className="font-medium">{maskCpfCnpj(config.cnpj)}</p>
                </div>
                {config.nome_fantasia && (
                  <div>
                    <span className="text-sm text-muted-foreground">Nome Fantasia:</span>
                    <p className="font-medium">{config.nome_fantasia}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-muted-foreground">Inscrição Estadual:</span>
                  <p className="font-medium">{config.inscricao_estadual}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Regime Tributário:</span>
                  <p className="font-medium">{config.regime_tributario?.replace(/_/g, " ").toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Endereço:</span>
                  <p className="font-medium text-sm">
                    {config.logradouro}, {config.numero} {config.complemento && `- ${config.complemento}`}<br />
                    {config.bairro} - {config.cidade}/{config.uf}
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2: Spedy connection */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Conexão com a Spedy</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Ambiente:</span>
                  <p className="font-medium">
                    {config.environment === "development" ? "Sandbox (testes)" : "Produção"}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Webhook de status:</span>
                  <p className="font-medium flex items-center gap-2">
                    {config.webhook_id ? (
                      <Badge className="bg-green-600 hover:bg-green-700">Conectado</Badge>
                    ) : (
                      <Badge variant="destructive">Não conectado</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">NCM padrão:</span>
                  <p className="font-medium">{config.default_ncm}</p>
                </div>
              </div>

              <h3 className="font-semibold text-lg pt-4">Modo de Emissão</h3>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-sm">Emissão automática</Label>
                  <p className="text-xs text-muted-foreground">
                    {config.auto_issue_mode === "automatic"
                      ? "Emite ao confirmar o pagamento"
                      : "Só emite ao clicar em 'Emitir NFe'"}
                  </p>
                </div>
                <Switch
                  checked={config.auto_issue_mode === "automatic"}
                  onCheckedChange={handleAutoIssueModeChange}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg">
            <div>
              <span className="font-medium text-lg">Emissão Ativa</span>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "O botão 'Emitir NFe' fica habilitado nos pedidos"
                  : "Nenhuma nota será emitida"}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggleActive}
              disabled={loading}
              className="scale-125"
            />
          </div>
        </CardFooter>
      </Card>

      {/* How it works Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Como funciona</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5" />
              <span>Quando ATIVO, o botão 'Emitir NFe' nos pedidos fica habilitado</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5" />
              <span>No modo automático, a nota é emitida assim que o pagamento é confirmado</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5" />
              <span>No modo manual, você emite individualmente pela tela de Pedidos</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span>Quando INATIVO, nenhuma nota é emitida (botão aparece desabilitado)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Actions Section */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={onEdit} variant="outline" className="flex-1 min-w-[200px]" disabled={loading}>
          <FileText className="w-4 h-4 mr-2" />
          Editar Dados
        </Button>
        <Button onClick={handleReconnectWebhook} variant="outline" className="flex-1 min-w-[200px]" disabled={loading}>
          <Webhook className="w-4 h-4 mr-2" />
          Reconectar Webhook
        </Button>
      </div>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar emissão fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? O botão 'Emitir NFe' ficará desabilitado e nenhuma nota será emitida automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate}>Sim, desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
