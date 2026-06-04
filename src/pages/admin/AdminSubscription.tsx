import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Shield, ExternalLink, RefreshCw, Crown, Zap,
  AlertTriangle, CheckCircle2, Clock, XCircle, MessageCircle, ArrowRightLeft,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Stripe product → plan mapping
const PRODUCT_PLAN_MAP: Record<string, string> = {
  prod_UCw6a5GqQTo3Ox: "start",
  prod_UCw7hdqew8m67x: "elite",
};

interface SubscriptionData {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  cancel_at_period_end: boolean;
  collection_method: string | null;
}

interface ProfilePlan {
  subscription_plan: string | null;
  subscription_status: string | null;
}

export default function AdminSubscription() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [profilePlan, setProfilePlan] = useState<ProfilePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_plan, subscription_status")
          .eq("id", user.id)
          .maybeSingle();
        setProfilePlan(profile as ProfilePlan | null);
      }

      const { data: result } = await supabase.functions.invoke("check-subscription");
      if (result) {
        setData(result as SubscriptionData);
      }
    } catch {
      toast({ title: "Erro ao carregar dados da assinatura", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const handleRefresh = () => { setRefreshing(true); fetchSubscription(); };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) {
        console.error("[DEBUG] Erro ao invocar customer-portal:", error);
        throw new Error(error.message || "Erro ao conectar com o servidor");
      }
      
      if (result?.error === "no_subscription") {
        toast({
          title: "Sem assinatura ativa",
          description: result.message || "Assine um plano para gerenciá-lo.",
          variant: "destructive",
        });
        return;
      }
      
      if (result?.error) {
        console.error("[DEBUG] Erro retornado pela função:", result.error);
        throw new Error(result.error);
      }
      
      if (result?.url) {
        window.open(result.url, "_blank");
      } else {
        throw new Error("URL do portal não retornada pelo servidor");
      }
    } catch (err: any) {
      console.error("[DEBUG] Erro completo ao abrir portal:", err);
      const errorMessage = err?.message || "Erro ao abrir portal de pagamentos";
      
      // Mensagens específicas baseadas no erro
      if (errorMessage.includes("404") || errorMessage.includes("no_subscription")) {
        toast({
          title: "Assinatura não encontrada",
          description: "Você ainda não tem uma assinatura ativa no Stripe. Assine um plano para gerenciá-lo.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("STRIPE_SECRET_KEY")) {
        toast({
          title: "Erro de configuração",
          description: "O Stripe não está configurado corretamente. Entre em contato com o suporte.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao abrir portal",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Derive plan from Stripe product or profile
  const hasStripeSubscription = data?.subscribed === true;
  const stripePlan = data?.product_id ? PRODUCT_PLAN_MAP[data.product_id] : null;
  const planFromProfile = profilePlan?.subscription_plan;
  const activePlan = stripePlan || planFromProfile;
  const hasActivePlan = !!activePlan && activePlan !== "none";
  const isSubscribed = hasActivePlan || hasStripeSubscription;
  const isCancelled = data?.cancel_at_period_end ?? false;
  const endDate = data?.subscription_end ? new Date(data.subscription_end) : null;
  const now = new Date();
  const daysRemaining = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const formattedEnd = endDate?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const planLabel = activePlan === "elite" ? "Elite" : activePlan === "start" ? "Start" : "Ativo";
  const statusLabel = isCancelled ? "Cancelado" : profilePlan?.subscription_status === "trial" ? "Trial" : "Ativo";

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Minha Assinatura</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu plano e forma de pagamento</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-xl gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Main Status Card */}
      <Card className="rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className={`h-2 ${isSubscribed ? (isCancelled ? "bg-amber-500" : "bg-emerald-500") : "bg-muted"}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSubscribed ? "bg-primary/10" : "bg-muted"}`}>
                {isSubscribed ? <Crown className="w-6 h-6 text-primary" /> : <XCircle className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isSubscribed ? `Plano ${planLabel}` : "Sem Assinatura"}
                </CardTitle>
                <CardDescription>
                  {isSubscribed
                    ? hasStripeSubscription ? "Pagamento via Stripe" : `Status: ${statusLabel}`
                    : "Você não possui um plano ativo"}
                </CardDescription>
              </div>
            </div>
            {isSubscribed && (
              <Badge variant={isCancelled ? "destructive" : "default"} className="text-sm px-3 py-1 rounded-full">
                {statusLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSubscribed && isCancelled && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Cancelamento agendado</p>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Seu plano continuará ativo até {formattedEnd}. Após essa data, você perderá o acesso aos recursos premium.
                </p>
              </div>
            </div>
          )}
          {isSubscribed && !isCancelled && endDate && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Renovação automática</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">
                  Seu plano será renovado automaticamente em {formattedEnd}.
                </p>
              </div>
            </div>
          )}
          {!isSubscribed && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted border border-border">
              <Zap className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Assine um plano</p>
                <p className="text-sm text-muted-foreground">
                  Acesse todas as funcionalidades do Menufly com um plano ativo.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Cards */}
      {isSubscribed && endDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Próxima renovação</p>
                  <p className="font-semibold">{formattedEnd}</p>
                </div>
              </div>
              {daysRemaining !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dias restantes</span>
                    <span className={`font-bold text-lg ${daysRemaining <= 3 ? "text-destructive" : daysRemaining <= 7 ? "text-amber-600" : "text-foreground"}`}>
                      {daysRemaining}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${daysRemaining <= 3 ? "bg-destructive" : daysRemaining <= 7 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.max(5, Math.min(100, (daysRemaining / 30) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {hasStripeSubscription && (
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forma de pagamento</p>
                    <p className="font-semibold">Cartão de Crédito</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full rounded-xl gap-2"
                  onClick={handleOpenPortal} disabled={portalLoading}>
                  <CreditCard className="w-4 h-4" />
                  {portalLoading ? "Abrindo..." : "Alterar forma de pagamento"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Manage Subscription - Stripe Portal */}
      {hasStripeSubscription && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gerenciar Assinatura
            </CardTitle>
            <CardDescription>
              Acesse o portal seguro para gerenciar todos os detalhes da sua assinatura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full rounded-xl gap-2 h-12" onClick={handleOpenPortal} disabled={portalLoading}>
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? "Abrindo portal..." : "Abrir Portal de Pagamentos"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isSubscribed && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Assinar um plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full rounded-xl gap-2 h-12"
              onClick={() => window.location.href = "/checkout"}>
              <Zap className="w-4 h-4" />
              Assinar agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      {isSubscribed && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button variant="outline" className="rounded-xl h-auto py-4 flex flex-col items-center gap-2"
            onClick={hasStripeSubscription ? handleOpenPortal : () => window.location.href = "/checkout"}
            disabled={hasStripeSubscription && portalLoading}>
            <CreditCard className="w-5 h-5" />
            <span className="text-xs">Alterar Pagamento</span>
          </Button>

          <Button variant="outline" className="rounded-xl h-auto py-4 flex flex-col items-center gap-2"
            onClick={hasStripeSubscription ? handleOpenPortal : () => window.location.href = "/checkout"}
            disabled={hasStripeSubscription && portalLoading}>
            <ArrowRightLeft className="w-5 h-5" />
            <span className="text-xs">Alterar Plano</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline"
                className="rounded-xl h-auto py-4 flex flex-col items-center gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5">
                <XCircle className="w-5 h-5" />
                <span className="text-xs">Cancelar Plano</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                <AlertDialogDescription>
                  Para cancelar sua assinatura, entre em contato com nosso suporte via WhatsApp. 
                  Nossa equipe irá processar seu cancelamento de forma rápida e segura.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Voltar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 rounded-xl gap-2"
                  onClick={() => window.open("https://wa.me/5551995135594?text=Olá, gostaria de cancelar minha assinatura do Menufly.", "_blank")}>
                  <MessageCircle className="w-4 h-4" />
                  Falar com suporte
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
