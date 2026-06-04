-- ================================================================
-- FIX: Colunas faltantes no módulo de Salão/Mesas
-- Erros reportados:
--   1. "Could not find the 'notes' column of 'pdv_tables'"
--   2. "Could not find the 'reservation_time' column"
--   3. "Could not find a column in orders" (table_id / subtotal / etc)
-- ================================================================

-- ----------------------------------------------------------------
-- FIX 1: Adicionar coluna 'notes' em pdv_tables
-- ----------------------------------------------------------------
ALTER TABLE public.pdv_tables
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ----------------------------------------------------------------
-- FIX 2: Corrigir constraint de status em pdv_tables para incluir
-- 'reserved'. A migration 20260602 tentou ALTER TYPE em um ENUM
-- que não existe — a coluna usa TEXT + CHECK constraint.
-- ----------------------------------------------------------------
ALTER TABLE public.pdv_tables
DROP CONSTRAINT IF EXISTS pdv_tables_status_check;

ALTER TABLE public.pdv_tables
ADD CONSTRAINT pdv_tables_status_check
CHECK (status IN ('free', 'occupied', 'bill_requested', 'reserved'));

-- ----------------------------------------------------------------
-- FIX 3: Adicionar coluna 'table_id' em orders
-- O frontend do Salão precisa vincular o pedido à mesa.
-- ----------------------------------------------------------------
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.pdv_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);

-- ----------------------------------------------------------------
-- FIX 4: Garantir que a coluna 'origin' existe em orders
-- (pode não existir se a migration do PDV não foi aplicada)
-- ----------------------------------------------------------------
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'online';

-- Só adiciona a constraint se ela ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_origin_check'
      AND table_name = 'orders'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_origin_check
    CHECK (origin IN ('online', 'pdv', 'ifood', '99food'));
  END IF;
END $$;
