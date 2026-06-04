-- ============================================================
-- Fix 1: pdv_tables status constraint
-- A migration anterior tentou ALTER TYPE pdv_table_status
-- mas a coluna usa TEXT + CHECK, não um ENUM.
-- Precisamos apenas expandir a constraint de CHECK para incluir 'reserved'.
-- ============================================================

ALTER TABLE pdv_tables
DROP CONSTRAINT IF EXISTS pdv_tables_status_check;

ALTER TABLE pdv_tables
ADD CONSTRAINT pdv_tables_status_check
CHECK (status IN ('free', 'occupied', 'bill_requested', 'reserved'));

-- ============================================================
-- Fix 2: Adicionar coluna table_id na tabela orders (se não existir)
-- O AdminSalao e AdminPDV tentam salvar table_id no pedido.
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES pdv_tables(id) ON DELETE SET NULL;

-- Índice para buscas por mesa
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
