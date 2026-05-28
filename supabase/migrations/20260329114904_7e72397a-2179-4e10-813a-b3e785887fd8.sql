
-- Master full access to products
CREATE POLICY "Masters can manage all products" ON public.products FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to categories
CREATE POLICY "Masters can manage all categories" ON public.categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to addon_groups
CREATE POLICY "Masters can manage all addon_groups" ON public.addon_groups FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to addon_items
CREATE POLICY "Masters can manage all addon_items" ON public.addon_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to product_addon_groups
CREATE POLICY "Masters can manage all product_addon_groups" ON public.product_addon_groups FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to product_categories
CREATE POLICY "Masters can manage all product_categories" ON public.product_categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to coupons
CREATE POLICY "Masters can manage all coupons" ON public.coupons FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to orders
CREATE POLICY "Masters can manage all orders" ON public.orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to delivery_zones
CREATE POLICY "Masters can manage all delivery_zones" ON public.delivery_zones FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to business_hours
CREATE POLICY "Masters can manage all business_hours" ON public.business_hours FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to promos
CREATE POLICY "Masters can manage all promos" ON public.promos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to promo_items
CREATE POLICY "Masters can manage all promo_items" ON public.promo_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to menu_highlights
CREATE POLICY "Masters can manage all menu_highlights" ON public.menu_highlights FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to campaigns
CREATE POLICY "Masters can manage all campaigns" ON public.campaigns FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to campaign_recipients
CREATE POLICY "Masters can manage all campaign_recipients" ON public.campaign_recipients FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to platform_integrations
CREATE POLICY "Masters can manage all platform_integrations" ON public.platform_integrations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to cmv_settings
CREATE POLICY "Masters can manage all cmv_settings" ON public.cmv_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to ingredients
CREATE POLICY "Masters can manage all ingredients" ON public.ingredients FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to product_costs
CREATE POLICY "Masters can manage all product_costs" ON public.product_costs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to recipe_items
CREATE POLICY "Masters can manage all recipe_items" ON public.recipe_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to cash_registers
CREATE POLICY "Masters can manage all cash_registers" ON public.cash_registers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to drivers
CREATE POLICY "Masters can manage all drivers" ON public.drivers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Upgrade restaurants master policy from UPDATE to ALL
DROP POLICY IF EXISTS "Masters can update any restaurant" ON public.restaurants;
CREATE POLICY "Masters can manage any restaurant" ON public.restaurants FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Upgrade customers master policy from SELECT to ALL
DROP POLICY IF EXISTS "Masters can view all customers" ON public.customers;
CREATE POLICY "Masters can manage all customers" ON public.customers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to whatsapp credits (upgrade from SELECT)
DROP POLICY IF EXISTS "Masters can view all whatsapp credits" ON public.whatsapp_credits;
CREATE POLICY "Masters can manage all whatsapp_credits" ON public.whatsapp_credits FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to ai_credits
CREATE POLICY "Masters can manage all ai_credits" ON public.ai_credits FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to ai_generations
CREATE POLICY "Masters can manage all ai_generations" ON public.ai_generations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to ai_credit_transactions
CREATE POLICY "Masters can manage all ai_credit_transactions" ON public.ai_credit_transactions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Master full access to device_tokens (view only for push)
CREATE POLICY "Masters can view all device_tokens" ON public.device_tokens FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'master'::app_role));

-- Master full access to whatsapp_credit_transactions
CREATE POLICY "Masters can manage all whatsapp_credit_transactions" ON public.whatsapp_credit_transactions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));
