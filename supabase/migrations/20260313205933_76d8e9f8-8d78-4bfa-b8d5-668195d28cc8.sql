
-- Table to store cost breakdown per product
CREATE TABLE public.product_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

-- Owners can manage their product costs
CREATE POLICY "Owners can manage product costs"
ON public.product_costs
FOR ALL
TO authenticated
USING (is_restaurant_owner(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_owner(restaurant_id, auth.uid()));

-- Collaborators can view product costs
CREATE POLICY "Collaborators can view product costs"
ON public.product_costs
FOR SELECT
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Table to store CMV settings per restaurant (target CMV %, fixed costs etc)
CREATE TABLE public.cmv_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  target_cmv_percent NUMERIC NOT NULL DEFAULT 30,
  fixed_costs_monthly NUMERIC NOT NULL DEFAULT 0,
  packaging_cost_default NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cmv_settings ENABLE ROW LEVEL SECURITY;

-- Owners can manage CMV settings
CREATE POLICY "Owners can manage cmv settings"
ON public.cmv_settings
FOR ALL
TO authenticated
USING (is_restaurant_owner(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_owner(restaurant_id, auth.uid()));

-- Collaborators can view CMV settings
CREATE POLICY "Collaborators can view cmv settings"
ON public.cmv_settings
FOR SELECT
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()));
