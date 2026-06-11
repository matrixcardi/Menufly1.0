import { useState, useEffect, useCallback, useRef } from "react";

import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Shield, Loader2, CheckCircle, Zap, Clock, Users,
  CreditCard, X, Rocket, QrCode,
} from "lucide-react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import logoLight from "@/assets/logo-light.png";
import checkoutBanner from "@/assets/checkout-banner.jpg";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutAuthForm from "@/components/checkout/CheckoutAuthForm";
import { SubscriptionPixDrawer } from "@/components/checkout/SubscriptionPixDrawer";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

type PlanType = "start" | "elite";
type PaymentMethodType = "card" | "pix";

const sharedFeatures = [
  "Cardápio digital ilimitado",
  "Pedidos ilimitados",
  "Integração WhatsApp",
  "Painel administrativo completo",
  "Relatórios e métricas",
  "Suporte prioritário",
  "Cupons e promoções",
  "Gestão de entrega",
  "Pagamento Online",
  "IA Criativa",
];

const eliteExclusives = [
  "10 créditos/mês de IA Criativa",
  "1.000 mensagens/mês WhatsApp",
  "B.I. Financeira",
  "CMV Inteligente",
  "WhatsApp Bot (automação)",
];

const plans: Record<PlanType, { name: string; price: number; description: string; features: string[]; excluded: string[]; badge?: string }> = {
  start: {
    name: "MenuFly Start",
    price: 97,
    description: "Ideal para começar seu delivery digital",
    features: sharedFeatures,
    excluded: eliteExclusives,
  },
  elite: {
    name: "MenuFly Elite",
    price: 160,
    description: "Todas as funcionalidades sem limites",
    features: [...sharedFeatures, ...eliteExclusives],
    excluded: [],
    badge: "Mais Completo",
  },
};

const highlights = [
  { icon: Zap, title: "Ativação Imediata", description: "Acesso liberado em menos de 1 minuto" },
  { icon: Users, title: "Pedidos Ilimitados", description: "Sem limite de pedidos ou clientes" },
  { icon: Clock, title: "Suporte I.A e Humanizado", description: "I.A 24h e atendimento humano seg-sex, 10h às 19h" },
];

export default function Checkout() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("start");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("card");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ clientSecret: string; stripePromise: ReturnType<typeof loadStripe> } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [includeImplementation, setIncludeImplementation] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixDrawerOpen, setPixDrawerOpen] = useState(false);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const loadedPlanRef = useRef<PlanType | null>(null);

  const plan = plans[selectedPlan];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
  }, []);

  const loadCheckout = useCallback(async (planToLoad: PlanType, withImplementation: boolean) => {
    if (!isAuthenticated) return;

    setCheckoutLoading(true);
    setCheckoutError(null);
    setCheckoutData(null);
    loadedPlanRef.current = null;

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planToLoad, includeImplementation: withImplementation },
      });

      if (error) throw error;
      if (!data?.clientSecret || !data?.publishableKey) {
        throw new Error("Dados do checkout não retornados");
      }

      const stripePromise = loadStripe(data.publishableKey);
      setCheckoutData({ clientSecret: data.clientSecret, stripePromise });
      loadedPlanRef.current = planToLoad;

      setTimeout(() => {
        checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (err: any) {
      console.error("Checkout error:", err);
      setCheckoutError(err.message || "Erro ao carregar checkout.");
      toast.error(err.message || "Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  }, [isAuthenticated]);

  // Auto-load checkout when authenticated (card only)
  useEffect(() => {
    if (isAuthenticated === true && paymentMethod === "card") {
      loadCheckout(selectedPlan, includeImplementation);
    }
  }, [isAuthenticated, loadCheckout, paymentMethod]);

  // Reload checkout when plan changes
  const handlePlanChange = (newPlan: PlanType) => {
    if (newPlan === selectedPlan) return;
    setSelectedPlan(newPlan);
    if (isAuthenticated && paymentMethod === "card") {
      loadCheckout(newPlan, includeImplementation);
    }
  };

  const handleImplementationToggle = (checked: boolean) => {
    setIncludeImplementation(checked);
    if (isAuthenticated && paymentMethod === "card") {
      loadCheckout(selectedPlan, checked);
    }
  };

  const handlePaymentMethodChange = (method: PaymentMethodType) => {
    if (method === paymentMethod) return;
    setPaymentMethod(method);
    if (method === "card" && isAuthenticated) {
      loadCheckout(selectedPlan, includeImplementation);
    } else {
      // Clear embedded checkout when switching to PIX
      setCheckoutData(null);
      setCheckoutError(null);
    }
  };

  const handlePixCheckout = async () => {
    setPixDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Pagamento 100% Seguro</span>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[hsl(20,6%,7%)] via-[hsl(20,8%,12%)] to-[hsl(20,6%,7%)]">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="flex-1 text-center md:text-left space-y-2 z-10">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
              Aumente em até <span className="text-amber-400">70%</span> as vendas do seu delivery
            </h2>
            <p className="text-sm md:text-base text-white/70">
              Com estrutura própria e sem depender de marketplace
            </p>
          </div>
          <div className="w-full md:w-[340px] lg:w-[420px] shrink-0 z-10">
            <img
              src={checkoutBanner}
              alt="Painel MenuFly - sistema de gestão delivery"
              className="w-full h-auto max-h-48 md:max-h-none object-cover rounded-xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 pb-12">
        {/* Auth gate - show auth form before everything else */}
        {isAuthenticated === null && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isAuthenticated === false && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto">
            <div className="bg-card border rounded-2xl p-6">
              <h1 className="text-xl font-bold text-center mb-1">Crie sua conta para começar</h1>
              <CheckoutAuthForm onAuthenticated={() => setIsAuthenticated(true)} />
            </div>
          </motion.div>
        )}

        {isAuthenticated === true && (<>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mb-8">
          <h1 className="text-2xl font-bold text-center mb-5">Escolha seu plano</h1>
          <div className="grid grid-cols-2 gap-3">
            {(["start", "elite"] as PlanType[]).map((p) => {
              const pd = plans[p];
              const sel = selectedPlan === p;
              return (
                <button key={p} onClick={() => handlePlanChange(p)}
                  className={cn("relative p-4 rounded-xl border-2 text-left transition-all",
                    sel ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-muted-foreground/30"
                  )}>
                  {pd.badge && (
                    <Badge className="absolute -top-2.5 right-2 bg-primary text-primary-foreground text-[10px]">{pd.badge}</Badge>
                  )}
                  <p className="font-semibold text-sm">{pd.name}</p>
                  <div className="flex items-baseline gap-0.5 mt-1">
                    <span className="text-2xl font-bold">R$ {pd.price}</span>
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Plan deliverables */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="max-w-md mx-auto mb-8">
          <div className="bg-card border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                <img src={logoLight} alt="MenuFly" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{plan.name}</h2>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-3xl font-bold">R$ {plan.price}</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <ul className="space-y-2.5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
              {plan.excluded.map((f, i) => (
                <li key={`ex-${i}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="line-through">{f}</span>
                </li>
              ))}
            </ul>
            {selectedPlan === "start" && (
              <button onClick={() => handlePlanChange("elite")}
                className="mt-4 w-full text-center text-xs text-primary hover:underline">
                Quero desbloquear WhatsApp Bot → Mudar para Elite
              </button>
            )}
          </div>
        </motion.div>

        {/* Order Bump - Implementation */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="max-w-md mx-auto mb-8">
          <div className={cn(
            "border-2 rounded-2xl p-5 transition-all",
            includeImplementation ? "border-primary bg-primary/5 shadow-md" : "border-dashed border-border"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm">Implementação Completa</h3>
                    <Badge variant="secondary" className="text-[10px]">Pagamento único</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Nossa equipe configura todo o seu cardápio, categorias, produtos, fotos e integração com WhatsApp para você começar a vender imediatamente. <span className="font-semibold text-foreground">+ Call prioritária com nosso time</span> para ensinar todas as funcionalidades na prática do sistema.
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold">R$ 399,90</span>
                    <span className="text-xs text-muted-foreground">único</span>
                  </div>
                </div>
              </div>
              <Switch
                checked={includeImplementation}
                onCheckedChange={handleImplementationToggle}
                className="mt-1"
              />
            </div>
          </div>
        </motion.div>

        {/* Inline Checkout + Highlights */}
        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Checkout section */}
          <motion.div ref={checkoutRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="order-1 scroll-mt-20">
            <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="p-5 border-b">
                <h2 className="text-lg font-semibold">Finalizar Assinatura</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.name} — R$ {plan.price},00/mês · Pagamento seguro
                </p>
              </div>

              {/* Payment method selector */}
              <div className="p-5 border-b">
                <p className="text-sm font-medium mb-3">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handlePaymentMethodChange("card")}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                    Cartão
                  </button>
                  <button
                    onClick={() => handlePaymentMethodChange("pix")}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                      paymentMethod === "pix"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <QrCode className="w-4 h-4" />
                    PIX
                  </button>
                </div>
                {paymentMethod === "pix" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Pagamento mensal via PIX. Acesso liberado por 30 dias após cada pagamento.
                  </p>
                )}
              </div>

              <div className="p-5 min-h-[420px]">
                {/* Card: Loading checkout */}
                {paymentMethod === "card" && checkoutLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Carregando formulário de pagamento...</p>
                  </div>
                )}

                {/* Card: Checkout error */}
                {paymentMethod === "card" && checkoutError && !checkoutLoading && (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-sm text-destructive">{checkoutError}</p>
                    <Button variant="outline" onClick={() => loadCheckout(selectedPlan, includeImplementation)} className="rounded-xl">
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {/* Card: Embedded Stripe Checkout */}
                {paymentMethod === "card" && checkoutData && !checkoutLoading && (
                  <div className="rounded-xl">
                    <EmbeddedCheckoutProvider
                      stripe={checkoutData.stripePromise}
                      options={{ clientSecret: checkoutData.clientSecret }}
                    >
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  </div>
                )}

                {/* PIX: Checkout button */}
                {paymentMethod === "pix" && (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                      <QrCode className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-2xl font-bold mt-1">R$ {plan.price},00</p>
                      {includeImplementation && (
                        <p className="text-sm text-muted-foreground">+ R$ 399,90 (Implementação)</p>
                      )}
                    </div>
                    <Button
                      size="lg"
                      className="w-full py-6 text-base rounded-xl"
                      onClick={handlePixCheckout}
                      disabled={pixLoading}
                    >
                      {pixLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Gerando PIX...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 mr-2" />
                          Pagar com PIX
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Geramos o QR Code instantâneo. Pagamento confirmado automaticamente.
                    </p>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground mt-4">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Pagamento processado de forma segura pelo Stripe. Cancele quando quiser.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Highlights */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }} className="order-2">
            <div className="grid gap-3">
              {highlights.map((h, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <h.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{h.title}</h3>
                    <p className="text-xs text-muted-foreground">{h.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
        </>)}
      </div>
      <SubscriptionPixDrawer
        open={pixDrawerOpen}
        onOpenChange={setPixDrawerOpen}
        plan={selectedPlan}
        includeImplementation={includeImplementation}
        onActivated={() => navigate("/admin")}
      />
    </div>
  );
}
