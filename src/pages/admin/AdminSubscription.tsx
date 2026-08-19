import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Crown, Zap, AlertTriangle, CheckCircle2, Clock, XCircle,
  MessageCircle, ArrowRightLeft, CreditCard, Loader2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SubscriptionData {
  subscribed: boolean;
  is_trial: boolean;
  trial_expired: boolean;
  subscription_end: string | null;
  plan: string | null;
  status: string | null;
  gateway: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
}

export default function AdminSubscription() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      if (result) setData(result as SubscriptionData);
    } catch {
      toast({ title: "Erro ao carregar dados da assinatura", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const handleRefresh = () => { setRefreshing(true); fetchSubscription(); };

  const goToCheckout = () => { window.location.href = "/checkout"; };

  // Só a base legada tem portal — clientes HyperCash gerenciam tudo por aqui.
  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (result?.error === "no_subscription") {
        toast({
          title: "Nenhuma assinatura encontrada",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      if (!result?.url) throw new Error("URL do portal não retornada");
      window.location.href = result.url;
    } catch {
      toast({
        title: "Não foi possível abrir o portal",
        description: "Tente novamente ou fale com o suporte.",
        variant: "destructive",
      });
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

  const isSubscribed = data?.subscribed === true;
  const isTrial = data?.is_trial === true;
  const activePlan = data?.plan;
  const endDate = data?.subscription_end ? new Date(data.subscription_end) : null;
  const now = new Date();
  const daysRemaining = endDate
    ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const formattedEnd = endDate?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const planLabel = activePlan === "elite" ? "Elite" : activePlan === "start" ? "Start" : "Ativo";
  const statusLabel = isTrial ? "Trial" : isSubscribed ? "Ativo" : "Inativo";

  // Base legada: cobrada pelo Stripe, com renovação automática. Não faz sentido
  // avisar de vencimento nem oferecer "renovar" — a cobrança acontece sozinha.
  const isLegacyStripe = data?.gateway === "stripe" && !isTrial;
  const willCancel = isLegacyStripe && data?.cancel_at_period_end === true;
  const expiringSoon = daysRemaining !== null && daysRemaining <= 7
    && (!isLegacyStripe || willCancel);

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Minha Assinatura</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu plano e renovação</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-xl gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Main Status Card */}
      <Card className="rounded-2xl border-0 shadow-lg overflow-hidden">
        <div className={`h-2 ${isSubscribed ? (expiringSoon ? "bg-amber-500" : "bg-emerald-500") : "bg-muted"}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSubscribed ? "bg-primary/10" : "bg-muted"}`}>
                {isSubscribed ? <Crown className="w-6 h-6 text-primary" /> : <XCircle className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isTrial ? "Período de Teste" : isSubscribed ? `Plano ${planLabel}` : "Sem Assinatura"}
                </CardTitle>
                <CardDescription>
                  {!isSubscribed
                    ? "Você não possui um plano ativo"
                    : isTrial
                      ? "Aproveite para testar todos os recursos"
                      : isLegacyStripe
                        ? willCancel ? "Cancelamento agendado para o fim do ciclo" : "Renovação automática mensal"
                        : "Renovação mensal"}
                </CardDescription>
              </div>
            </div>
            {isSubscribed && (
              <Badge variant={expiringSoon ? "destructive" : "default"} className="text-sm px-3 py-1 rounded-full">
                {statusLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSubscribed && expiringSoon && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {isTrial
                    ? "Seu teste está acabando"
                    : willCancel ? "Sua assinatura será encerrada" : "Sua assinatura vence em breve"}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  {isTrial
                    ? `Assine até ${formattedEnd} para não perder o acesso.`
                    : willCancel
                      ? `O cancelamento está agendado para ${formattedEnd}. Reative pelo portal para manter o acesso.`
                      : `Renove até ${formattedEnd} para manter o acesso aos recursos.`}
                </p>
              </div>
            </div>
          )}
          {isSubscribed && !expiringSoon && endDate && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Acesso liberado</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">
                  {isLegacyStripe
                    ? `Próxima cobrança automática em ${formattedEnd}.`
                    : `Seu plano está ativo até ${formattedEnd}.`}
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

      {/* Renovação */}
      {isSubscribed && endDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isTrial
                      ? "Teste termina em"
                      : isLegacyStripe && !willCancel ? "Próxima cobrança" : "Vence em"}
                  </p>
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

          <Card className="rounded-2xl">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Renovação</p>
                  <p className="font-semibold">
                    {isLegacyStripe ? "Automática no cartão" : "Cartão ou PIX"}
                  </p>
                </div>
              </div>
              {isLegacyStripe ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sua assinatura é renovada automaticamente no cartão cadastrado. Use o portal
                    para trocar de plano, atualizar o cartão ou cancelar.
                  </p>
                  <Button
                    className="w-full rounded-xl gap-2 mt-auto"
                    onClick={handleOpenPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Gerenciar assinatura
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    A renovação é feita a cada 30 dias. Você pode renovar a qualquer momento — os dias
                    restantes são somados ao novo período.
                  </p>
                  <Button className="w-full rounded-xl gap-2 mt-auto" onClick={goToCheckout}>
                    <Zap className="w-4 h-4" />
                    Renovar agora
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
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
            <Button className="w-full rounded-xl gap-2 h-12" onClick={goToCheckout}>
              <Zap className="w-4 h-4" />
              Assinar agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      {isSubscribed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Legado troca de plano dentro do Stripe; assinar aqui geraria uma
              segunda cobrança em paralelo à recorrência existente. */}
          <Button
            variant="outline"
            className="rounded-xl h-auto py-4 flex flex-col items-center gap-2"
            onClick={isLegacyStripe ? handleOpenPortal : goToCheckout}
            disabled={isLegacyStripe && portalLoading}
          >
            <ArrowRightLeft className="w-5 h-5" />
            <span className="text-xs">Trocar de Plano</span>
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
                  {isLegacyStripe
                    ? "Sua assinatura tem renovação automática. Você pode cancelá-la você mesmo pelo portal de cobrança — o acesso continua até o fim do período já pago."
                    : "Sua assinatura não renova sozinha — basta não renovar ao fim do período para encerrá-la. Se quiser cancelar agora ou tirar dúvidas, fale com nosso suporte pelo WhatsApp."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Voltar</AlertDialogCancel>
                {isLegacyStripe ? (
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90 rounded-xl gap-2"
                    onClick={handleOpenPortal}>
                    <CreditCard className="w-4 h-4" />
                    Abrir portal de cobrança
                  </AlertDialogAction>
                ) : (
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90 rounded-xl gap-2"
                    onClick={() => window.open("https://wa.me/5551995135594?text=Olá, gostaria de cancelar minha assinatura do Menufly.", "_blank")}>
                    <MessageCircle className="w-4 h-4" />
                    Falar com suporte
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
