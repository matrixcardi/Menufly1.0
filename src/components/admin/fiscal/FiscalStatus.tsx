import { useState } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Check, X, FileText, RefreshCcw } from "lucide-react";
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

  const handleToggleActive = async (newValue: boolean) => {
    if (newValue === false) {
      setShowDeactivateConfirm(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("fiscal_config")
        .update({ is_active: true })
        .eq("restaurant_id", config.restaurant_id);

      if (error) throw error;

      console.log("[FISCAL] is_active alterado para:", true);
      toast({ title: "✓ Emissão fiscal ativada" });
      onRefresh();
    } catch (error) {
      console.error("[FISCAL] Erro ao ativar:", error);
      toast({ title: "Erro ao ativar emissão fiscal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    setShowDeactivateConfirm(false);
    setLoading(true);
    try {
      const { error } = await supabase
        .from("fiscal_config")
        .update({ is_active: false })
        .eq("restaurant_id", config.restaurant_id);

      if (error) throw error;

      console.log("[FISCAL] is_active alterado para:", false);
      toast({ title: "Emissão fiscal desativada" });
      onRefresh();
    } catch (error) {
      console.error("[FISCAL] Erro ao desativar:", error);
      toast({ title: "Erro ao desativar emissão fiscal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    console.log("[FISCAL] Editar configurações");
    onEdit();
  };

  const handleUpdateCertificate = () => {
    console.log("[FISCAL] Atualizar certificado");
    onEdit();
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
              <p className="text-muted-foreground">Sua emissão de NFCe está configurada</p>
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

            {/* Column 2: Statistics & Certificate */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Estatísticas</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Notas emitidas hoje:</span>
                  <p className="font-medium text-2xl">0</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Notas emitidas no mês:</span>
                  <p className="font-medium text-2xl">0</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Última emissão:</span>
                  <p className="font-medium text-muted-foreground">Nenhuma ainda</p>
                </div>
              </div>

              <h3 className="font-semibold text-lg pt-4">Certificado Digital</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Arquivo:</span>
                  <p className="font-medium text-sm">{config.certificado_nome_arquivo || "certificado.pfx"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {(() => {
                    if (!config.certificado_valido_ate) {
                      return <Badge variant="secondary" className="ml-2">Aguardando validação</Badge>;
                    }
                    
                    const validUntil = new Date(config.certificado_valido_ate);
                    const today = new Date();
                    const daysUntilExpiry = Math.ceil((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysUntilExpiry < 0) {
                      return <Badge variant="destructive" className="ml-2">VENCIDO</Badge>;
                    } else if (daysUntilExpiry < 30) {
                      return <Badge className="ml-2 bg-orange-500 hover:bg-orange-600">Vence em {daysUntilExpiry} dias</Badge>;
                    } else {
                      return <Badge className="ml-2 bg-green-600 hover:bg-green-700">Válido até {validUntil.toLocaleDateString('pt-BR')}</Badge>;
                    }
                  })()}
                </div>
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
                  ? "As notas serão emitidas automaticamente"
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
              <span>Quando ATIVO, os botões 'Emitir NFe' nos pedidos ficam habilitados</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5" />
              <span>As notas são emitidas automaticamente conforme o pedido é finalizado</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5" />
              <span>Você pode emitir individualmente ou em lote pela tela de Pedidos</span>
            </li>
            <li className="flex items-start gap-2">
              <X className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span>Quando INATIVO, nenhuma nota é emitida (botões aparecem desabilitados)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Actions Section */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleEdit} variant="outline" className="flex-1 min-w-[200px]" disabled={loading}>
          <FileText className="w-4 h-4 mr-2" />
          Editar Dados
        </Button>
        <Button onClick={handleUpdateCertificate} variant="outline" className="flex-1 min-w-[200px]" disabled={loading}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Atualizar Certificado
        </Button>
      </div>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar emissão fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Os botões 'Emitir NFe' ficarão desabilitados e nenhuma nota será emitida automaticamente.
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
