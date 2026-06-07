-- =====================================================
-- REFORMULAÇÃO DO SISTEMA DE COLABORADORES
-- =====================================================

-- 1.1 Garantir estrutura da tabela restaurant_collaborators
CREATE TABLE IF NOT EXISTS public.restaurant_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator' 
    CHECK (role IN ('collaborator', 'waiter', 'cook', 'cashier', 'delivery', 'manager')),
  permissions JSONB DEFAULT '{}'::jsonb,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'pending', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);

-- Adicionar colunas que possam estar faltando (se a tabela já existir)
ALTER TABLE public.restaurant_collaborators 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'collaborator';
ALTER TABLE public.restaurant_collaborators 
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.restaurant_collaborators 
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.restaurant_collaborators 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.restaurant_collaborators 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Garantir constraint UNIQUE
ALTER TABLE public.restaurant_collaborators 
  DROP CONSTRAINT IF EXISTS restaurant_collaborators_restaurant_user_unique;
ALTER TABLE public.restaurant_collaborators 
  ADD CONSTRAINT restaurant_collaborators_restaurant_user_unique 
  UNIQUE (restaurant_id, user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_collab_restaurant ON public.restaurant_collaborators(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_collab_user ON public.restaurant_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_status ON public.restaurant_collaborators(status);

-- 1.2 Criar função helper para identificar restaurantes do usuário
CREATE OR REPLACE FUNCTION public.get_user_restaurant_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Restaurantes onde é dono
  SELECT id FROM public.restaurants WHERE user_id = p_user_id
  UNION
  -- Restaurantes onde é colaborador ativo
  SELECT restaurant_id FROM public.restaurant_collaborators 
  WHERE user_id = p_user_id AND status = 'active';
$$;

-- Função booleana para checar acesso (útil em policies)
CREATE OR REPLACE FUNCTION public.user_has_access_to_restaurant(
  p_user_id UUID, 
  p_restaurant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = p_restaurant_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM public.restaurant_collaborators 
    WHERE restaurant_id = p_restaurant_id 
      AND user_id = p_user_id 
      AND status = 'active'
  );
$$;

-- 1.3 Atualizar RLS policies das tabelas críticas
-- =====================================================
-- Aplicar RLS em TODAS as tabelas que devem ser isoladas
-- =====================================================

-- Helper macro: usar essa lógica em todas as tabelas com restaurant_id
DO $$
DECLARE
  tbl TEXT;
  tables_to_update TEXT[] := ARRAY[
    'orders', 'products', 'categories', 'pdv_tables', 
    'reservations', 'customers', 'campaigns', 'coupons',
    'promos', 'auto_promos', 'addon_groups', 'cash_registers',
    'pdv_sessions', 'menu_highlights', 'delivery_zones', 'drivers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_update LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    
    -- Drop policies antigas que possam existir
    EXECUTE format('DROP POLICY IF EXISTS "Restaurant access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Owners and collaborators access" ON public.%I;', tbl);
    
    -- Policy unificada: dono OU colaborador ativo
    EXECUTE format($f$
      CREATE POLICY "Owners and collaborators access"
      ON public.%I
      FOR ALL
      TO authenticated
      USING (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())))
      WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())));
    $f$, tbl);
  END LOOP;
END $$;

-- RLS específico para restaurant_collaborators
ALTER TABLE public.restaurant_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage collaborators" ON public.restaurant_collaborators;
CREATE POLICY "Owners manage collaborators"
ON public.restaurant_collaborators
FOR ALL
TO authenticated
USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
)
WITH CHECK (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Collaborators see own membership" ON public.restaurant_collaborators;
CREATE POLICY "Collaborators see own membership"
ON public.restaurant_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 1.4 Função RPC para listar colaboradores com dados completos
CREATE OR REPLACE FUNCTION public.list_restaurant_collaborators(p_restaurant_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  status TEXT,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    rc.id,
    rc.user_id,
    COALESCE(p.email, u.email) as email,
    COALESCE(p.full_name, split_part(u.email, '@', 1)) as full_name,
    rc.role,
    rc.status,
    rc.permissions,
    rc.created_at,
    inviter.full_name as invited_by_name
  FROM public.restaurant_collaborators rc
  LEFT JOIN auth.users u ON u.id = rc.user_id
  LEFT JOIN public.profiles p ON p.id = rc.user_id
  LEFT JOIN public.profiles inviter ON inviter.id = rc.invited_by
  WHERE rc.restaurant_id = p_restaurant_id
    AND rc.status != 'removed'
  ORDER BY rc.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_restaurant_collaborators(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
