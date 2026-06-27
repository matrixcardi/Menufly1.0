import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Loader2,
  QrCode,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Wallet,
  Banknote,
  Link2,
  Unlink,
} from "lucide-react";

interface PaymentSettings {
  cash_enabled: boolean;
  card_on_delivery_enabled: boolean;
  card_online_enabled: boolean;
  pix_enabled: boolean;
  pix_on_delivery_enabled: boolean;
  pix_gateway: string | null;
  pix_gateway_token: string | null;
  mp_public_key: string | null;
}

export default function AdminPayments() {
  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = ctxSelectedId === "all" ? selectedRestaurantIds[0] : ctxSelectedId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({
    cash_enabled: true,
    card_on_delivery_enabled: true,
    card_online_enabled: false,
    pix_enabled: false,
    pix_on_delivery_enabled: true,
    pix_gateway: null,
    pix_gateway_token: null,
    mp_public_key: null,
  });
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle OAuth redirect results
  useEffect(() => {
    if (searchParams.get("mp_success") === "true") {
      toast({ title: "Mercado Pago conectado com sucesso! 🎉" });
      searchParams.delete("mp_success");
      setSearchParams(searchParams, { replace: true });
      // Reload settings
      fetchSettings();
    }
    const mpError = searchParams.get("mp_error");
    if (mpError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parâmetros ausentes no retorno do Mercado Pago.",
        config: "Configuração da plataforma incompleta.",
        token_exchange: "Falha ao obter autorização do Mercado Pago.",
        save: "Erro ao salvar dados da conexão.",
        unknown: "Erro desconhecido na conexão.",
      };
      toast({
        title: "Erro ao conectar Mercado Pago",
        description: errorMessages[mpError] || "Tente novamente.",
        variant: "destructive",
      });
      searchParams.delete("mp_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [ctxRestaurantId]);

  async function fetchSettings() {
    if (!ctxRestaurantId) return;

    const { data } = await supabase
      .from("restaurants")
      .select("id, pix_enabled, pix_gateway, pix_gateway_token, cash_enabled, card_on_delivery_enabled, card_online_enabled, mp_public_key, pix_on_delivery_enabled")
      .eq("id", ctxRestaurantId)
      .maybeSingle();

    if (data) {
      setSettings({
        cash_enabled: (data as any).cash_enabled ?? true,
        card_on_delivery_enabled: (data as any).card_on_delivery_enabled ?? true,
        card_online_enabled: (data as any).card_online_enabled ?? false,
        pix_enabled: (data as any).pix_enabled ?? false,
        pix_on_delivery_enabled: (data as any).pix_on_delivery_enabled ?? true,
        pix_gateway: (data as any).pix_gateway ?? null,
        pix_gateway_token: (data as any).pix_gateway_token ?? null,
        mp_public_key: (data as any).mp_public_key ?? null,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  const [connectingMP, setConnectingMP] = useState(false);

  const handleConnectMP = async () => {
    if (!ctxRestaurantId) return;
    setConnectingMP(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-auth-url", {
        body: { restaurant_id: ctxRestaurantId },
      });
      if (error || !data?.url) {
        toast({ title: "Erro ao gerar link de conexão", variant: "destructive" });
        return;
      }
      window.location.href = data.url;
    } catch {
      toast({ title: "Erro ao conectar", variant: "destructive" });
    } finally {
      setConnectingMP(false);
    }
  };

  const handleDisconnectMP = async () => {
    if (!ctxRestaurantId) return;
    setDisconnecting(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        pix_gateway: null,
        pix_gateway_token: null,
        pix_enabled: false,
      } as any)
      .eq("id", ctxRestaurantId);

    setDisconnecting(false);

    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
    } else {
      setSettings(s => ({ ...s, pix_gateway: null, pix_gateway_token: null, pix_enabled: false }));
      toast({ title: "Mercado Pago desconectado" });
    }
  };

  const handleSave = async () => {
    if (!ctxRestaurantId) return;
    setSaving(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        cash_enabled: settings.cash_enabled,
        card_on_delivery_enabled: settings.card_on_delivery_enabled,
        card_online_enabled: settings.card_online_enabled,
        pix_enabled: settings.pix_enabled,
        pix_on_delivery_enabled: settings.pix_on_delivery_enabled,
      } as any)
      .eq("id", ctxRestaurantId);

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações de pagamento salvas!" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = settings.pix_gateway === "mercadopago" && settings.pix_gateway_token;

  return (
    <div className="space-y-3 md:space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">
          Configure os métodos de pagamento do seu restaurante
        </p>
      </div>

      {/* Mercado Pago Connection Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Mercado Pago</CardTitle>
              <CardDescription>Conecte para receber pagamentos online com confirmação automática</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 border-t pt-4">
          {isConnected ? (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Mercado Pago conectado!
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectMP}
                disabled={disconnecting}
                className="gap-2 text-destructive hover:text-destructive"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Desconectar Mercado Pago
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                 <p className="text-sm text-blue-700 dark:text-blue-300">
                   Conecte sua conta do Mercado Pago para habilitar PIX e Cartão Online.
                 </p>
              </div>
              <Button
                onClick={handleConnectMP}
                disabled={connectingMP}
                className="gap-2 bg-[#009ee3] hover:bg-[#007eb5] text-white"
              >
                {connectingMP ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Conectar com Mercado Pago
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* PIX Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-lg">PIX Online</CardTitle>
                <CardDescription>QR Code com confirmação automática via Mercado Pago</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.pix_enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, pix_enabled: checked }))
              }
              disabled={!isConnected}
            />
          </div>
          {!isConnected && (
            <p className="text-xs text-muted-foreground mt-2 ml-[52px]">Conecte o Mercado Pago para habilitar</p>
          )}
        </CardHeader>
      </Card>

      {/* Card Online Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Cartão Online</CardTitle>
                <CardDescription>Crédito e débito online via Mercado Pago</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.card_online_enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, card_online_enabled: checked }))
              }
              disabled={!isConnected}
            />
          </div>
          {!isConnected && (
            <p className="text-xs text-muted-foreground mt-2 ml-[52px]">Conecte o Mercado Pago para habilitar</p>
          )}
        </CardHeader>
      </Card>

      {/* Cash Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Dinheiro</CardTitle>
                <CardDescription>Pagamento em espécie na entrega/retirada</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.cash_enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, cash_enabled: checked }))
              }
            />
          </div>
        </CardHeader>
      </Card>

      {/* PIX on Delivery Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-lg">PIX na Entrega</CardTitle>
                <CardDescription>Cliente paga com PIX ao receber, sem geração de QR Code automático</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.pix_on_delivery_enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, pix_on_delivery_enabled: checked }))
              }
            />
          </div>
        </CardHeader>
      </Card>

      {/* Card on Delivery Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Cartão na entrega</CardTitle>
                <CardDescription>Crédito ou débito na maquininha ao receber</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.card_on_delivery_enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, card_on_delivery_enabled: checked }))
              }
            />
          </div>
        </CardHeader>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Resumo</CardTitle>
              <CardDescription>Métodos de pagamento habilitados no checkout</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`gap-1.5 py-1.5 px-3 ${!settings.cash_enabled ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${settings.cash_enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              Dinheiro
            </Badge>
            <Badge variant="outline" className={`gap-1.5 py-1.5 px-3 ${!settings.pix_on_delivery_enabled ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${settings.pix_on_delivery_enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              PIX na Entrega
            </Badge>
            <Badge variant="outline" className={`gap-1.5 py-1.5 px-3 ${!settings.card_on_delivery_enabled ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${settings.card_on_delivery_enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              Cartão na entrega
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1.5 py-1.5 px-3 ${
                settings.pix_enabled && isConnected ? "" : "opacity-50"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.pix_enabled && isConnected ? "bg-green-500" : "bg-muted-foreground"
                }`}
              />
              PIX (Mercado Pago)
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1.5 py-1.5 px-3 ${
                settings.card_online_enabled && isConnected ? "" : "opacity-50"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.card_online_enabled && isConnected ? "bg-green-500" : "bg-muted-foreground"
                }`}
              />
              Cartão Online
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
