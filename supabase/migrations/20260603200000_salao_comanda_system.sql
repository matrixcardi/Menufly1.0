-- ================================================================
-- Sistema de Comanda por Mesa — MenuFly Salão
-- ================================================================

-- 1. Adicionar 'pdv_salao' ao check de origin em orders
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_origin_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_origin_check
CHECK (origin IN ('online', 'pdv', 'pdv_salao', 'ifood', '99food'));

-- 2. Adicionar 'table' ao delivery_type (se tiver constraint)
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_delivery_type_check;

-- 3. Adicionar people_count (número de pessoas) e table_number (número da mesa) em orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS people_count INTEGER DEFAULT NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS table_number INTEGER DEFAULT NULL;

-- 4. Garantir que table_id existe
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.pdv_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);

-- 5. Garantir notes e status correto em pdv_tables
ALTER TABLE public.pdv_tables
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.pdv_tables
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.pdv_tables
ADD COLUMN IF NOT EXISTS people_count INTEGER DEFAULT NULL;

ALTER TABLE public.pdv_tables
DROP CONSTRAINT IF EXISTS pdv_tables_status_check;

ALTER TABLE public.pdv_tables
ADD CONSTRAINT pdv_tables_status_check
CHECK (status IN ('free', 'occupied', 'bill_requested', 'reserved'));

-- 6. Garantir origin existe em orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'online';
