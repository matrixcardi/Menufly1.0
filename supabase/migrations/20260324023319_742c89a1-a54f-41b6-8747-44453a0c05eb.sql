
CREATE TABLE public.auto_promos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger config
  trigger_type TEXT NOT NULL DEFAULT 'min_items', -- 'min_items', 'min_value', 'specific_product', 'specific_category'
  trigger_value NUMERIC NOT NULL DEFAULT 0, -- qty for min_items, amount for min_value, qty for product/category
  trigger_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  trigger_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  
  -- Benefit config
  benefit_type TEXT NOT NULL DEFAULT 'free_shipping', -- 'free_shipping', 'percentage_discount', 'fixed_discount', 'free_product'
  benefit_value NUMERIC, -- discount amount or percentage (null for free_shipping)
  benefit_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- for free_product benefit
  
  -- Scheduling (same pattern as promos)
  schedule_type TEXT NOT NULL DEFAULT 'always',
  schedule_days INTEGER[] DEFAULT '{}',
  schedule_start_date DATE,
  schedule_end_date DATE,
  schedule_start_time TIME,
  schedule_end_time TIME,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_in_menu BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_promos ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Owners can manage auto_promos" ON public.auto_promos
FOR ALL TO authenticated
USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Collaborator policies
CREATE POLICY "Collaborators can manage auto_promos" ON public.auto_promos
FOR ALL TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Public read for active promos (needed for cart evaluation)
CREATE POLICY "Public can view active auto_promos" ON public.auto_promos
FOR SELECT TO anon, authenticated
USING (is_active = true);
