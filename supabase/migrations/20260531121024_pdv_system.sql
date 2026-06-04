-- Adiciona coluna de origem à tabela de pedidos
ALTER TABLE orders 
ADD COLUMN origin TEXT DEFAULT 'online' NOT NULL;

-- Adiciona restrição de verificação para os valores de origem
ALTER TABLE orders 
ADD CONSTRAINT orders_origin_check 
CHECK (origin IN ('online', 'pdv', 'ifood', '99food'));

-- Cria tabela de mesas do PDV
CREATE TABLE pdv_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'free' NOT NULL,
    current_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adiciona restrição de verificação para o status das mesas
ALTER TABLE pdv_tables 
ADD CONSTRAINT pdv_tables_status_check 
CHECK (status IN ('free', 'occupied', 'bill_requested'));

-- Cria índice em restaurant_id para mesas
CREATE INDEX pdv_tables_restaurant_id_idx ON pdv_tables(restaurant_id);
CREATE INDEX pdv_tables_current_order_id_idx ON pdv_tables(current_order_id);

-- Cria tabela de sessões do PDV
CREATE TABLE pdv_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    opening_amount NUMERIC DEFAULT 0,
    closing_amount NUMERIC,
    total_sales NUMERIC DEFAULT 0,
    total_cash NUMERIC DEFAULT 0,
    total_card NUMERIC DEFAULT 0,
    total_pix NUMERIC DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'open' NOT NULL
);

-- Adiciona restrição de verificação para o status das sessões
ALTER TABLE pdv_sessions 
ADD CONSTRAINT pdv_sessions_status_check 
CHECK (status IN ('open', 'closed'));

-- Cria índices para sessões do PDV
CREATE INDEX pdv_sessions_restaurant_id_idx ON pdv_sessions(restaurant_id);
CREATE INDEX pdv_sessions_opened_by_idx ON pdv_sessions(opened_by);
CREATE INDEX pdv_sessions_status_idx ON pdv_sessions(status);

-- Habilita RLS (Row Level Security) na tabela de mesas
ALTER TABLE pdv_tables ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mesas do PDV
CREATE POLICY "Usuários podem visualizar mesas do seu restaurante" 
ON pdv_tables FOR SELECT 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuários podem inserir mesas no seu restaurante" 
ON pdv_tables FOR INSERT 
WITH CHECK (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuários podem atualizar mesas do seu restaurante" 
ON pdv_tables FOR UPDATE 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuários podem excluir mesas do seu restaurante" 
ON pdv_tables FOR DELETE 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

-- Habilita RLS na tabela de sessões do PDV
ALTER TABLE pdv_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sessões do PDV
CREATE POLICY "Usuários podem visualizar sessões do seu restaurante" 
ON pdv_sessions FOR SELECT 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuários podem inserir sessões no seu restaurante" 
ON pdv_sessions FOR INSERT 
WITH CHECK (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuários podem atualizar sessões do seu restaurante" 
ON pdv_sessions FOR UPDATE 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuários podem excluir sessões do seu restaurante" 
ON pdv_sessions FOR DELETE 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants 
        WHERE user_id = auth.uid()
        OR id IN (
            SELECT restaurant_id FROM restaurant_collaborators 
            WHERE user_id = auth.uid()
        )
    )
);