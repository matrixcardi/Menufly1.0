import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tela de retorno pós-pagamento.
 *
 * Com a HyperCash o cartão é confirmado dentro do próprio /checkout (o
 * HyperCashCardForm faz o polling e redireciona), e o PIX é confirmado no
 * SubscriptionPixDrawer — nenhum dos dois passa por aqui. A rota permanece
 * apenas como rede de segurança para sessões antigas do Stripe cujo return_url
 * ainda aponta para cá.
 *
 * Antes esta página mandava todo mundo para /criar-conta, o que jogava quem já
 * estava logado num formulário de cadastro depois de pagar.
 */
export default function CheckoutSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      navigate(data.session?.user ? "/admin" : "/criar-conta", { replace: true });
    });

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Processando seu pagamento...</p>
      </div>
    </div>
  );
}
