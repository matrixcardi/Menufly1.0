-- Adicionar status 'reserved' ao enum de status das mesas
ALTER TYPE pdv_table_status ADD VALUE IF NOT EXISTS 'reserved';

-- Criar tabela de reservas de mesas
CREATE TABLE IF NOT EXISTS table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES pdv_tables(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    number_of_people INTEGER NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS table_reservations_restaurant_id_idx ON table_reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS table_reservations_table_id_idx ON table_reservations(table_id);
CREATE INDEX IF NOT EXISTS table_reservations_date_idx ON table_reservations(reservation_date);
CREATE INDEX IF NOT EXISTS table_reservations_status_idx ON table_reservations(status);

-- Habilitar RLS
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para reservas
CREATE POLICY "Usuários podem visualizar reservas do seu restaurante"
ON table_reservations FOR SELECT
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

CREATE POLICY "Usuários podem inserir reservas no seu restaurante"
ON table_reservations FOR INSERT
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

CREATE POLICY "Usuários podem atualizar reservas do seu restaurante"
ON table_reservations FOR UPDATE
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

CREATE POLICY "Usuários podem excluir reservas do seu restaurante"
ON table_reservations FOR DELETE
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

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_table_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER table_reservations_updated_at_trigger
BEFORE UPDATE ON table_reservations
FOR EACH ROW
EXECUTE FUNCTION update_table_reservations_updated_at();
