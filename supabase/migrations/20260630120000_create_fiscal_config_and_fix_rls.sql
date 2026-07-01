-- =====================================================
-- INTEGRAÇÃO FISCAL SPEDY (NFC-e)
-- =====================================================
-- Cria fiscal_config (dados não sensíveis, lidos pelo client) e
-- fiscal_secrets (API Key da Spedy, nunca lida pelo client).
-- Corrige RLS pré-existente de fiscal_invoices, que filtrava por
-- restaurants.owner_id (coluna inexistente — a coluna real é user_id),
-- e a alinha ao padrão multi-tenant (dono + colaborador ativo) via
-- public.get_user_restaurant_ids(), já usado pelas demais tabelas.

-- 1) fiscal_config
CREATE TABLE IF NOT EXISTS public.fiscal_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'spedy',
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'development')),
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  inscricao_estadual TEXT NOT NULL,
  regime_tributario TEXT NOT NULL DEFAULT 'simples_nacional'
    CHECK (regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real')),
  cep TEXT NOT NULL,
  logradouro TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  default_ncm TEXT NOT NULL DEFAULT '21069090',
  default_cfop TEXT NOT NULL DEFAULT '5102',
  auto_issue_mode TEXT NOT NULL DEFAULT 'manual' CHECK (auto_issue_mode IN ('manual', 'automatic')),
  webhook_id TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_config_restaurant_id ON public.fiscal_config(restaurant_id);

ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and collaborators can view fiscal config" ON public.fiscal_config;
CREATE POLICY "Owners and collaborators can view fiscal config"
  ON public.fiscal_config FOR SELECT
  TO authenticated
  USING (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())));

-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated: essa tabela só é
-- escrita pelas Edge Functions (spedy-save-config, spedy-register-webhook) via
-- Service Role Key, que ignora RLS.

-- 2) fiscal_secrets — API Key da Spedy, jamais exposta ao client
CREATE TABLE IF NOT EXISTS public.fiscal_secrets (
  restaurant_id UUID PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  spedy_api_key TEXT NOT NULL,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fiscal_secrets ENABLE ROW LEVEL SECURITY;
-- Propositalmente sem nenhuma CREATE POLICY: authenticated/anon não têm acesso
-- algum a esta tabela. Somente a Service Role Key (Edge Functions) a acessa,
-- pois ela ignora RLS por completo.

-- 3) Corrigir fiscal_invoices (bug pré-existente: policy referenciava
-- restaurants.owner_id, que não existe) e restringir escrita ao backend.
ALTER TABLE public.fiscal_invoices ADD COLUMN IF NOT EXISTS justification TEXT;

DROP POLICY IF EXISTS "Restaurant owners can manage their invoices" ON public.fiscal_invoices;

CREATE POLICY "Owners and collaborators can view invoices"
  ON public.fiscal_invoices FOR SELECT
  TO authenticated
  USING (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())));

-- Sem policy de INSERT/UPDATE para authenticated: antes, o client (EmitirNFeButton.tsx)
-- gravava fiscal_invoices diretamente, permitindo que qualquer usuário autenticado
-- inserisse uma linha 'authorized' falsa. A partir de agora, só as Edge Functions
-- (service role) inserem/atualizam essa tabela.

-- Evita duas notas ativas simultâneas para o mesmo pedido (idempotência local,
-- complementar ao integrationId da Spedy que já evita duplicidade do lado deles).
DROP INDEX IF EXISTS fiscal_invoices_order_unique_active;
CREATE UNIQUE INDEX fiscal_invoices_order_unique_active
  ON public.fiscal_invoices(order_id)
  WHERE status IN ('pending', 'processing', 'authorized');
