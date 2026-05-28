
-- Table for cash register sessions
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  opened_by text NOT NULL,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant cash registers"
ON public.cash_registers
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM restaurants WHERE restaurants.id = cash_registers.restaurant_id AND restaurants.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants WHERE restaurants.id = cash_registers.restaurant_id AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can view their restaurant cash registers"
ON public.cash_registers
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM restaurants WHERE restaurants.id = cash_registers.restaurant_id AND restaurants.user_id = auth.uid()
));
