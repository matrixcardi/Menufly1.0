
-- 1. Create ingredients table (banco de ingredientes do restaurante)
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'g',
  cost_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage ingredients" ON public.ingredients
  FOR ALL TO authenticated
  USING (is_restaurant_owner(restaurant_id, auth.uid()))
  WITH CHECK (is_restaurant_owner(restaurant_id, auth.uid()));

CREATE POLICY "Collaborators can view ingredients" ON public.ingredients
  FOR SELECT TO authenticated
  USING (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- 2. Create recipe_items table (ficha técnica)
CREATE TABLE public.recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_used numeric NOT NULL DEFAULT 0,
  waste_factor numeric NOT NULL DEFAULT 1.00,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage recipe items" ON public.recipe_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p JOIN restaurants r ON r.id = p.restaurant_id
    WHERE p.id = recipe_items.product_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p JOIN restaurants r ON r.id = p.restaurant_id
    WHERE p.id = recipe_items.product_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Collaborators can view recipe items" ON public.recipe_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = recipe_items.product_id AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
  ));

-- 3. Add range columns to cmv_settings
ALTER TABLE public.cmv_settings
  ADD COLUMN IF NOT EXISTS optimal_max numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS warning_max numeric NOT NULL DEFAULT 45;
