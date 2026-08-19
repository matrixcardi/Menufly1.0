-- Billing da plataforma (assinatura MenuFly) — Stripe e HyperCash convivendo
--
-- Clientes antigos continuam sendo cobrados pelo Stripe (recorrência automática);
-- clientes novos entram pela HyperCash (ciclos avulsos de 30 dias). Nenhuma
-- assinatura Stripe nova é criada — o gateway fica somente-leitura sobre a base
-- existente e ela só encolhe.
--
-- `profiles.subscription_plan` / `subscription_status` continuam sendo o read model
-- consumido pelo app (usePlan, useCurrentPlan, useSubscriptionPlan, MasterAccounts).
-- Estas tabelas guardam o detalhe de cobrança: ciclo, renovação e auditoria.

-- ---------------------------------------------------------------------------
-- platform_subscriptions: uma linha por usuário assinante
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('start', 'elite', 'assessoria')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
  gateway TEXT NOT NULL CHECK (gateway IN ('hypercash', 'mercadopago', 'stripe')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Stripe renova sozinho; HyperCash e PIX dependem de ação do cliente. É esta
  -- diferença que decide quem recebe aviso de vencimento e quem não recebe.
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  -- Só faz sentido para gateway = 'stripe': assinatura marcada para encerrar no
  -- fim do ciclo. É o único caso em que um cliente Stripe deve ver o banner.
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  hypercash_customer_id TEXT,
  -- Vínculo explícito com o Stripe. O código antigo redescobria o cliente por
  -- `customers.list({ email })` a cada chamada; guardar os ids elimina isso.
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  last_transaction_id TEXT,
  renewal_attempts INTEGER NOT NULL DEFAULT 0,
  last_renewal_notice_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_period_end
  ON public.platform_subscriptions (current_period_end);
-- Sustenta a varredura do cron de renovação, que filtra por gateway.
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_renewal
  ON public.platform_subscriptions (gateway, status, auto_renew, current_period_end);
-- O sync do Stripe reconcilia por customer id.
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_stripe_customer
  ON public.platform_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own platform subscription"
  ON public.platform_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Masters can view all platform subscriptions"
  ON public.platform_subscriptions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));

-- Escrita apenas pelas edge functions (service_role). O cliente nunca ativa
-- a própria assinatura: isso só acontece após verificação server-side no gateway.
CREATE POLICY "Service role can manage platform subscriptions"
  ON public.platform_subscriptions
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE TRIGGER set_platform_subscriptions_updated_at
  BEFORE UPDATE ON public.platform_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- platform_transactions: auditoria de toda cobrança de assinatura
-- O UNIQUE em gateway_transaction_id é o que dá idempotência ao webhook.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('hypercash', 'mercadopago')),
  gateway_transaction_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  plan TEXT,
  payment_method TEXT,
  include_implementation BOOLEAN NOT NULL DEFAULT false,
  raw JSONB,
  -- Marca que esta transação já estendeu o período da assinatura. O webhook e o
  -- polling do checkout podem confirmar o mesmo pagamento ao mesmo tempo; quem
  -- consegue virar este campo de NULL para now() é quem ativa. Sem isso, os dois
  -- somariam 30 dias cada.
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_transactions_user
  ON public.platform_transactions (user_id, created_at DESC);

ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own platform transactions"
  ON public.platform_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Masters can view all platform transactions"
  ON public.platform_transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Service role can manage platform transactions"
  ON public.platform_transactions
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE TRIGGER set_platform_transactions_updated_at
  BEFORE UPDATE ON public.platform_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Backfill da base existente
--
-- Todo assinante ativo hoje é cobrado pelo Stripe ou pagou PIX, e nenhum pode
-- perder acesso ao passar a depender desta tabela. Cada um ganha uma linha
-- `gateway = 'stripe'` com `auto_renew = true`, porque assinatura Stripe renova
-- sozinha.
--
-- `current_period_end` aqui é PROVISÓRIO: não sabemos a data real de renovação
-- sem consultar o Stripe. Os 30 dias servem só para cobrir o intervalo até o
-- primeiro `sync-stripe-subscriptions`, que sobrescreve com o valor verdadeiro
-- junto de stripe_customer_id, stripe_subscription_id e cancel_at_period_end.
--
-- >>> Rodar `sync-stripe-subscriptions` logo depois de aplicar esta migração.
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_subscriptions (
  user_id, plan, status, gateway, current_period_start, current_period_end, auto_renew
)
SELECT
  p.id,
  CASE WHEN p.subscription_plan IN ('start', 'elite', 'assessoria')
       THEN p.subscription_plan ELSE 'start' END,
  'active',
  'stripe',
  now(),
  now() + INTERVAL '30 days',
  true
FROM public.profiles p
WHERE p.subscription_status = 'active'
  AND p.subscription_plan IS NOT NULL
  AND p.subscription_plan <> 'none'
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE public.platform_subscriptions IS
  'Ciclo de cobrança da assinatura da plataforma. profiles.subscription_* continua sendo o read model do app.';
COMMENT ON COLUMN public.platform_subscriptions.gateway IS
  'stripe = base legada com recorrência automática (nunca recebe assinatura nova). hypercash/mercadopago = ciclos avulsos de 30 dias.';
COMMENT ON COLUMN public.platform_subscriptions.auto_renew IS
  'Stripe: sempre true (o gateway renova). HyperCash/PIX: indica que o cliente deve ser avisado antes do vencimento.';
COMMENT ON TABLE public.platform_transactions IS
  'Auditoria de cobranças da plataforma. UNIQUE(gateway, gateway_transaction_id) garante idempotência do webhook.';
