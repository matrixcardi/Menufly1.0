import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import {
  Plug,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  Store,
  Link2,
  Eye,
  EyeOff,
  Bike,
  Mail,
  Lock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ifoodLogo from "@/assets/ifood-logo.png";
import rappiLogo from "@/assets/rappi-logo.png";
import aiqfomeLogo from "@/assets/aiqfome-logo.png";
import ubereatsLogo from "@/assets/ubereats-logo.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlatformConfig {
  id: string;
  name: string;
  logo: string;
  logoImage?: string;
  color: string;
  description: string;
  docsUrl: string;
  steps: string[];
  comingSoon?: boolean;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "ifood",
    name: "iFood",
    logo: "🔴",
    logoImage: ifoodLogo,
    color: "from-red-500 to-red-700",
    description: "Receba pedidos do iFood diretamente no Menufly. Sincronize cardápio, pedidos e faturamento.",
    docsUrl: "https://portal.ifood.com.br",
    steps: [
      "Acesse portal.ifood.com.br e faça login com sua conta de gerente da loja",
      "No menu lateral, clique em \"Configurações\" → \"Integrações\" (ou \"Apps e integrações\")",
      "Procure por \"Menufly\" na lista de integradores e clique em \"Autorizar\"",
      "Após autorizar, copie o Merchant ID (também chamado de \"ID da Loja\" ou \"UUID da loja\") que aparece no canto superior direito do portal, ao lado do nome da loja",
      "Cole o Merchant ID no campo abaixo e clique em Conectar",
    ],
  },
  {
    id: "aiqfome",
    name: "aiqfome",
    logo: "🟣",
    logoImage: aiqfomeLogo,
    color: "from-purple-500 to-purple-700",
    description: "Integre com o aiqfome para centralizar pedidos e gerenciar tudo em um só lugar.",
    docsUrl: "https://aiqfome.com",
    steps: [
      "Entre em contato com o suporte do aiqfome solicitando acesso à API",
      "Após liberação, copie o ID da loja e o token de integração",
      "Cole as credenciais abaixo e clique em Conectar",
      "Pedidos serão sincronizados em tempo real",
    ],
    comingSoon: true,
  },
  {
    id: "rappi",
    name: "Rappi",
    logo: "🟠",
    logoImage: rappiLogo,
    color: "from-orange-500 to-orange-700",
    description: "Conecte-se ao Rappi e gerencie pedidos de delivery junto com seus outros canais.",
    docsUrl: "https://www.rappi.com.br",
    steps: [
      "Solicite acesso ao programa de parceiros Rappi",
      "Após aprovação, obtenha suas credenciais de API",
      "Configure o Merchant ID e o Token abaixo",
      "Os pedidos serão recebidos automaticamente",
    ],
    comingSoon: true,
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    logo: "🟢",
    logoImage: ubereatsLogo,
    color: "from-green-600 to-green-800",
    description: "Receba pedidos do Uber Eats no Menufly. Gerencie tudo em um painel unificado.",
    docsUrl: "https://developer.uber.com/docs/eats",
    steps: [
      "Acesse o Uber Eats Dashboard e solicite integração via API",
      "Após aprovação, copie o Store ID e o Bearer Token",
      "Cole as credenciais no formulário abaixo",
      "Pedidos e faturamento serão sincronizados",
    ],
    comingSoon: true,
  },
];

type IntegrationStatus = "disconnected" | "pending" | "connected" | "error";

interface Integration {
  id: string;
  platform: string;
  status: IntegrationStatus;
  merchant_id: string | null;
  last_sync_at: string | null;
}

const statusConfig: Record<IntegrationStatus, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  disconnected: { label: "Desconectado", icon: <XCircle className="w-3.5 h-3.5" />, variant: "secondary" },
  pending: { label: "Pendente", icon: <Clock className="w-3.5 h-3.5" />, variant: "outline" },
  connected: { label: "Conectado", icon: <CheckCircle2 className="w-3.5 h-3.5" />, variant: "default" },
  error: { label: "Erro", icon: <AlertTriangle className="w-3.5 h-3.5" />, variant: "destructive" },
};

const extractEdgeFunctionMessage = async (error: unknown) => {
  const response = (error as { context?: Response })?.context;

  if (response && typeof response.clone === "function") {
    const payload = await response.clone().json().catch(() => null);
    if (payload && typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  }

  return getUserFriendlyError(error);
};

export default function AdminIntegrations() {
  const { restaurants, refreshRestaurants, selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = ctxSelectedId === "all" ? selectedRestaurantIds[0] : ctxSelectedId;
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConfig | null>(null);
  const [merchantId, setMerchantId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Multi-restaurant linking state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkRecoveryLoading, setLinkRecoveryLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Lá Vem Entregas state
  type LavemIntegration = {
    id: string;
    account_email: string | null;
    account_password: string | null;
    store_id: string | null;
    is_active: boolean;
    dispatch_mode: "auto" | "manual";
    webhook_secret: string;
  };
  const [lavem, setLavem] = useState<LavemIntegration | null>(null);
  const [lavemEmail, setLavemEmail] = useState("");
  const [lavemPassword, setLavemPassword] = useState("");
  const [lavemMode, setLavemMode] = useState<"auto" | "manual">("manual");
  const [lavemActive, setLavemActive] = useState(true);
  const [lavemSaving, setLavemSaving] = useState(false);
  const [lavemShowPassword, setLavemShowPassword] = useState(false);

  // Generic dialogs for non-multi integrations
  const [lavemDialogOpen, setLavemDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  const fetchData = async () => {
    try {
      if (!ctxRestaurantId) return;

      setRestaurantId(ctxRestaurantId);

      const { data: integrationsData } = await supabase
        .from("platform_integrations")
        .select("id, platform, status, merchant_id, last_sync_at")
        .eq("restaurant_id", ctxRestaurantId);

      setIntegrations((integrationsData || []) as Integration[]);

      const { data: lavemData } = await supabase
        .from("lavem_integrations")
        .select("id, account_email, account_password, store_id, is_active, dispatch_mode, webhook_secret")
        .eq("restaurant_id", ctxRestaurantId)
        .maybeSingle();
      if (lavemData) {
        const li = lavemData as unknown as LavemIntegration;
        setLavem(li);
        setLavemEmail(li.account_email || "");
        setLavemPassword(li.account_password || "");
        setLavemMode((li.dispatch_mode as "auto" | "manual") || "manual");
        setLavemActive(li.is_active !== false);
      } else {
        setLavem(null);
        setLavemEmail("");
        setLavemPassword("");
        setLavemMode("manual");
        setLavemActive(true);
      }
    } catch (error) {
      logger.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIntegration = (platformId: string): Integration | undefined => {
    return integrations.find((i) => i.platform === platformId);
  };

  const handleConnect = async () => {
    if (!restaurantId || !selectedPlatform) return;
    if (!merchantId.trim()) {
      toast({ title: "Preencha o ID da loja", variant: "destructive" });
      return;
    }
    // iFood uses platform-level credentials — only merchant_id is required
    const isIfood = selectedPlatform.id === "ifood";
    if (!isIfood && !apiToken.trim()) {
      toast({ title: "Preencha o Token de API", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (isIfood) {
        const { data, error } = await supabase.functions.invoke("ifood-connect-merchant", {
          body: { restaurant_id: restaurantId, merchant_id: merchantId.trim() },
        });
        if (error) {
          const msg = await extractEdgeFunctionMessage(error);
          toast({ title: "Erro ao conectar iFood", description: msg, variant: "destructive" });
          return;
        }
        toast({
          title: `iFood conectado! 🎉`,
          description: data?.merchant_name
            ? `Loja: ${data.merchant_name}. Pedidos serão sincronizados a cada 30 segundos.`
            : "Pedidos serão sincronizados a cada 30 segundos.",
        });
        setSelectedPlatform(null);
        setMerchantId("");
        setApiToken("");
        fetchData();
        return;
      }

      const existing = getIntegration(selectedPlatform.id);

      if (existing) {
        const { error } = await supabase
          .from("platform_integrations")
          .update({
            merchant_id: merchantId.trim(),
            api_token: apiToken.trim(),
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_integrations")
          .insert({
            restaurant_id: restaurantId,
            platform: selectedPlatform.id,
            merchant_id: merchantId.trim(),
            api_token: apiToken.trim(),
            status: "pending",
          });
        if (error) throw error;
      }

      toast({ title: `${selectedPlatform.name} configurado!`, description: "A integração está pendente de validação." });
      setSelectedPlatform(null);
      setMerchantId("");
      setApiToken("");
      fetchData();
    } catch (error) {
      logger.error("Error connecting platform:", error);
      toast({ title: "Erro ao conectar", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    const integration = getIntegration(platformId);
    if (!integration) return;

    try {
      if (platformId === "ifood") {
        const { error } = await supabase.functions.invoke("ifood-disconnect", {
          body: { restaurant_id: restaurantId },
        });
        if (error) throw error;
        toast({ title: "iFood desconectado" });
        fetchData();
        return;
      }
      const { error } = await supabase
        .from("platform_integrations")
        .delete()
        .eq("id", integration.id);
      if (error) throw error;

      toast({ title: "Integração removida" });
      fetchData();
    } catch (error) {
      logger.error("Error disconnecting:", error);
      toast({ title: "Erro ao desconectar", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const handleLinkRestaurant = async () => {
    if (!linkEmail.trim() || !linkPassword.trim()) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }

    setLinkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("link-restaurant", {
        body: { email: linkEmail.trim(), password: linkPassword },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }

      toast({
        title: "Restaurante(s) vinculado(s)! 🎉",
        description: data.message,
      });
      setLinkDialogOpen(false);
      setLinkEmail("");
      setLinkPassword("");
      await refreshRestaurants();
    } catch (error) {
      logger.error("Error linking restaurant:", error);
      const description = await extractEdgeFunctionMessage(error);
      toast({ title: "Erro ao vincular", description, variant: "destructive" });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSendLinkRecovery = async () => {
    const normalizedEmail = linkEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      toast({ title: "Informe o e-mail da outra conta", variant: "destructive" });
      return;
    }

    setLinkRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Link de recuperação enviado",
        description: "Se o e-mail existir, a outra conta receberá instruções para redefinir a senha.",
      });
    } catch (error) {
      logger.error("Error sending link recovery:", error);
      toast({
        title: "Erro ao enviar recuperação",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLinkRecoveryLoading(false);
    }
  };

  const webhookUrl = restaurantId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-webhook/${restaurantId}`
    : "";

  const saveLavem = async () => {
    if (!restaurantId) return;
    if (lavemActive && (!lavemEmail.trim() || !lavemPassword.trim())) {
      toast({ title: "Informe e-mail e senha da sua conta Lá Vem Entregas", variant: "destructive" });
      return;
    }
    setLavemSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        account_email: lavemEmail.trim() || null,
        account_password: lavemPassword || null,
        is_active: lavemActive,
        dispatch_mode: lavemMode,
      };
      let error;
      if (lavem) {
        const res = await supabase.from("lavem_integrations").update(payload).eq("id", lavem.id);
        error = res.error;
      } else {
        const res = await supabase.from("lavem_integrations").insert(payload);
        error = res.error;
      }
      if (error) throw error;
      toast({
        title: lavemEmail ? "Conta vinculada!" : "Configurações atualizadas",
        description: lavemActive
          ? "Quando um pedido estiver pronto, você poderá solicitar o entregador do Lá Vem Entregas."
          : "Integração desativada.",
      });
      fetchData();
    } catch (error) {
      logger.error("Error saving Lá Vem integration:", error);
      toast({ title: "Erro ao salvar", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLavemSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="w-6 h-6" />
          Integrações
        </h1>
        <p className="text-muted-foreground">
          Conecte plataformas de delivery e gerencie múltiplos restaurantes
        </p>
      </div>

      {/* Multi-Restaurant Section */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="w-5 h-5 text-primary" />
            Multi-Restaurante
          </CardTitle>
          <CardDescription>
            Vincule outros restaurantes à sua conta e gerencie tudo em um único painel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show linked restaurants */}
          {restaurants.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Restaurantes vinculados:</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {restaurants.map((rest) => (
                  <div
                    key={rest.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                  >
                    {rest.logo_url ? (
                      <img src={rest.logo_url} alt={rest.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Store className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{rest.name}</p>
                      <p className="text-xs text-muted-foreground">/{rest.slug}</p>
                    </div>
                    <Badge variant={rest.is_open ? "default" : "secondary"} className="text-xs shrink-0">
                      {rest.is_open ? "Aberto" : "Fechado"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {restaurants.length <= 1 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Você ainda não tem restaurantes vinculados.</p>
              <p>Conecte outro restaurante para gerenciar tudo em um só lugar.</p>
            </div>
          )}

          <Button
            onClick={() => setLinkDialogOpen(true)}
            className="w-full gap-2"
            variant={restaurants.length > 1 ? "outline" : "default"}
          >
            <Link2 className="w-4 h-4" />
            Vincular Restaurante
          </Button>
        </CardContent>
      </Card>

      {/* Link Restaurant Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Vincular Restaurante
            </DialogTitle>
            <DialogDescription>
              Insira as credenciais da conta do restaurante que deseja espelhar. Os dados aparecerão no seu painel sem afetar o funcionamento original.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                <Store className="w-4 h-4 shrink-0 mt-0.5" />
                Os restaurantes da outra conta continuarão funcionando normalmente. Você terá acesso espelhado aos pedidos, CRM e relatórios no seu painel.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="linkEmail">E-mail da outra conta</Label>
                <Input
                  id="linkEmail"
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="email@restaurante.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkPassword">Senha da outra conta</Label>
                <div className="relative">
                  <Input
                    id="linkPassword"
                    type={showPassword ? "text" : "password"}
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-xs"
                  disabled={linkRecoveryLoading}
                  onClick={handleSendLinkRecovery}
                >
                  {linkRecoveryLoading ? "Enviando recuperação..." : "Não sabe a senha? Enviar recuperação"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkRestaurant} disabled={linkLoading} className="gap-2">
              {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {linkLoading ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lá Vem Entregas - Terceirização de entregadores */}
      {/* Compact integrations grid */}
      {restaurantId && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Plataformas e serviços</h2>
            <p className="text-sm text-muted-foreground">Clique em uma integração para configurar</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Lá Vem Entregas */}
            <button
              type="button"
              onClick={() => setLavemDialogOpen(true)}
              className="group text-left rounded-xl border bg-card hover:border-primary/40 hover:shadow-apple transition-all p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5 text-white" />
                </div>
                <Badge variant={lavem?.is_active && lavem?.account_email ? "default" : "secondary"} className="flex items-center gap-1 text-xs">
                  {lavem?.is_active && lavem?.account_email ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {lavem?.is_active && lavem?.account_email ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div>
                <p className="font-semibold text-sm">Lá Vem Entregas</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  Terceirize entregas e solicite entregadores diretamente do pedido.
                </p>
              </div>
            </button>

            {/* Platforms */}
            {PLATFORMS.map((platform) => {
              const integration = getIntegration(platform.id);
              const status: IntegrationStatus = (integration?.status as IntegrationStatus) || "disconnected";
              const config = statusConfig[status];
              const isComingSoon = platform.comingSoon;
              return (
                <button
                  key={platform.id}
                  type="button"
                  disabled={isComingSoon}
                  onClick={() => {
                    if (isComingSoon) return;
                    setSelectedPlatform(platform);
                    const existing = getIntegration(platform.id);
                    setMerchantId(existing?.merchant_id || "");
                    setApiToken("");
                  }}
                  className={`group text-left rounded-xl border bg-card transition-all p-4 flex flex-col gap-3 ${
                    isComingSoon
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:border-primary/40 hover:shadow-apple"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br ${platform.color} flex items-center justify-center shrink-0 text-xl ${isComingSoon ? "grayscale" : ""}`}>
                      {platform.logoImage ? (
                        <img src={platform.logoImage} alt={platform.name} className="w-full h-full object-cover" />
                      ) : (
                        platform.logo
                      )}
                    </div>
                    {isComingSoon ? (
                      <Badge variant="outline" className="text-[10px] font-semibold tracking-wider uppercase border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                        Em breve
                      </Badge>
                    ) : (
                      <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
                        {config.icon}
                        {config.label}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{platform.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{platform.description}</p>
                  </div>
                </button>
              );
            })}

            {/* Webhook URL */}
            <button
              type="button"
              onClick={() => setWebhookDialogOpen(true)}
              className="group text-left rounded-xl border border-dashed bg-card hover:border-primary/40 hover:shadow-apple transition-all p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs">Avançado</Badge>
              </div>
              <div>
                <p className="font-semibold text-sm">URL de Webhook</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  Use esta URL para plataformas que enviam pedidos via webhook.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Lá Vem Entregas Dialog */}
      <Dialog open={lavemDialogOpen} onOpenChange={setLavemDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-amber-600" />
              Lá Vem Entregas
            </DialogTitle>
            <DialogDescription>
              Terceirize as entregas do seu restaurante. Quando ativo, você pode solicitar um entregador diretamente do card do pedido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-amber-500/5 p-3 text-xs text-muted-foreground">
              A integração já está pronta. Para começar a usar, basta entrar com a conta cadastrada na plataforma{" "}
              <span className="font-medium text-foreground">Lá Vem Entregas</span>. Suas credenciais ficam protegidas e são usadas apenas para autenticar suas solicitações de entrega.
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">Integração ativa</p>
                <p className="text-xs text-muted-foreground">Quando desativada, o botão de solicitar entregador some dos pedidos</p>
              </div>
              <Switch checked={lavemActive} onCheckedChange={setLavemActive} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lavemEmail" className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> E-mail
                </Label>
                <Input
                  id="lavemEmail"
                  type="email"
                  value={lavemEmail}
                  onChange={(e) => setLavemEmail(e.target.value)}
                  placeholder="seu-email@exemplo.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lavemPass" className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Senha
                </Label>
                <div className="relative">
                  <Input
                    id="lavemPass"
                    type={lavemShowPassword ? "text" : "password"}
                    value={lavemPassword}
                    onChange={(e) => setLavemPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setLavemShowPassword(!lavemShowPassword)}
                  >
                    {lavemShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Modo de despacho</Label>
              <Select value={lavemMode} onValueChange={(v) => setLavemMode(v as "auto" | "manual")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual — eu solicito no pedido</SelectItem>
                  <SelectItem value="auto">Automático — solicita ao marcar pedido como Pronto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLavemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={async () => { await saveLavem(); setLavemDialogOpen(false); }} disabled={lavemSaving} className="gap-2">
              {lavemSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              {lavemSaving ? "Salvando..." : (lavem?.account_email ? "Salvar" : "Vincular conta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook URL Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="w-5 h-5" />
              URL de Webhook
            </DialogTitle>
            <DialogDescription>
              Algumas plataformas exigem uma URL de webhook para enviar pedidos. Use o endereço abaixo na configuração da plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted rounded px-3 py-2 text-xs break-all">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast({ title: "URL copiada!" });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setWebhookDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Dialog */}
      <Dialog open={!!selectedPlatform} onOpenChange={(open) => !open && setSelectedPlatform(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlatform?.logoImage ? (
                <img src={selectedPlatform.logoImage} alt={selectedPlatform.name} className="w-7 h-7 rounded-md object-cover" />
              ) : (
                <span className="text-2xl">{selectedPlatform?.logo}</span>
              )}
              Conectar {selectedPlatform?.name}
            </DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para configurar a integração
            </DialogDescription>
          </DialogHeader>

          {selectedPlatform && (
            <div className="space-y-4">
              {/* Steps */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Como conectar:</Label>
                <ol className="space-y-1.5">
                  {selectedPlatform.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="merchantId">ID da Loja / Merchant ID</Label>
                  <Input
                    id="merchantId"
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="Ex: 12345678"
                  />
                </div>
                {selectedPlatform.id !== "ifood" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="apiToken">Token de API</Label>
                    <Input
                      id="apiToken"
                      type="password"
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="Cole seu token aqui"
                    />
                  </div>
                )}
                {selectedPlatform.id === "ifood" && (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                      A Menufly já está homologada como integradora iFood. Você só precisa colar o <strong>Merchant ID</strong> da sua loja — não é necessário token nem senha.
                    </div>
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs space-y-1.5">
                      <p className="font-semibold text-amber-700 dark:text-amber-300">Onde encontrar o Merchant ID?</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Entre em <a href="https://portal.ifood.com.br" target="_blank" rel="noreferrer" className="underline font-medium">portal.ifood.com.br</a></li>
                        <li>No topo da página, clique no nome da sua loja</li>
                        <li>O Merchant ID é o código (UUID) que aparece logo abaixo do nome da loja — geralmente no formato <code className="bg-muted px-1 rounded">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code></li>
                        <li>Também pode ser encontrado em <strong>Configurações → Dados da loja → ID da Loja</strong></li>
                      </ol>
                      <p className="text-muted-foreground pt-1">
                        💡 Se tiver mais de uma loja, cada uma tem seu próprio Merchant ID. Conecte uma de cada vez.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
            <div className="flex gap-2">
              {selectedPlatform && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(selectedPlatform.docsUrl, "_blank")}
                  className="gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Docs
                </Button>
              )}
              {selectedPlatform && getIntegration(selectedPlatform.id) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await handleDisconnect(selectedPlatform.id);
                    setSelectedPlatform(null);
                  }}
                >
                  Desconectar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedPlatform(null)}>
                Cancelar
              </Button>
              <Button onClick={handleConnect} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}
                {saving ? "Conectando..." : "Conectar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
