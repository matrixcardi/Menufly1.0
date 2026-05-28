
-- Allow collaborators (linked admins) to UPDATE restaurants they are linked to
CREATE POLICY "Collaborators can update their restaurant"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (is_restaurant_collaborator(id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(id, auth.uid()));

-- Allow collaborators to manage business_hours
CREATE POLICY "Collaborators can manage business hours"
ON public.business_hours
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage delivery_zones
CREATE POLICY "Collaborators can manage delivery zones"
ON public.delivery_zones
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage categories (INSERT, UPDATE, DELETE)
CREATE POLICY "Collaborators can manage categories"
ON public.categories
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage products
CREATE POLICY "Collaborators can manage products"
ON public.products
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage coupons
CREATE POLICY "Collaborators can manage coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage campaigns
CREATE POLICY "Collaborators can manage campaigns"
ON public.campaigns
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage customers
CREATE POLICY "Collaborators can manage customers"
ON public.customers
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage menu_highlights
CREATE POLICY "Collaborators can manage menu highlights"
ON public.menu_highlights
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage addon_groups
CREATE POLICY "Collaborators can manage addon groups"
ON public.addon_groups
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage promos
CREATE POLICY "Collaborators can manage promos"
ON public.promos
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage platform_integrations
CREATE POLICY "Collaborators can manage platform integrations"
ON public.platform_integrations
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage ai_credits
CREATE POLICY "Collaborators can manage ai credits"
ON public.ai_credits
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage ai_generations
CREATE POLICY "Collaborators can manage ai generations"
ON public.ai_generations
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage ai_credit_transactions
CREATE POLICY "Collaborators can manage ai credit transactions"
ON public.ai_credit_transactions
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage product_addon_groups via product
CREATE POLICY "Collaborators can manage product addon links"
ON public.product_addon_groups
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = product_addon_groups.product_id
  AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = product_addon_groups.product_id
  AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
));

-- Allow collaborators to manage product_categories via product
CREATE POLICY "Collaborators can manage product category links"
ON public.product_categories
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = product_categories.product_id
  AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = product_categories.product_id
  AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
));

-- Allow collaborators to manage product_costs (upgrade from SELECT-only)
DROP POLICY IF EXISTS "Collaborators can view product costs" ON public.product_costs;
CREATE POLICY "Collaborators can manage product costs"
ON public.product_costs
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage cmv_settings (upgrade from SELECT-only)  
DROP POLICY IF EXISTS "Collaborators can view cmv settings" ON public.cmv_settings;
CREATE POLICY "Collaborators can manage cmv settings"
ON public.cmv_settings
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to manage promo_items via promo
CREATE POLICY "Collaborators can manage promo items"
ON public.promo_items
FOR ALL
TO authenticated
USING (promo_id IN (
  SELECT promos.id FROM promos
  WHERE is_restaurant_collaborator(promos.restaurant_id, auth.uid())
))
WITH CHECK (promo_id IN (
  SELECT promos.id FROM promos
  WHERE is_restaurant_collaborator(promos.restaurant_id, auth.uid())
));
