-- ============================================
-- FIX 1: Remove permissive INSERT policy on orders
-- Force all orders through validated submit_order() RPC
-- ============================================

DROP POLICY IF EXISTS "Public can create orders" ON public.orders;

-- ============================================
-- FIX 2: Add public SELECT policies for menu data
-- Allow customers to view restaurant menus
-- ============================================

-- Allow public to view active restaurants
CREATE POLICY "Public can view active restaurants" 
ON public.restaurants
FOR SELECT 
TO anon, authenticated
USING (is_open = true);

-- Allow public to view categories from active restaurants
CREATE POLICY "Public can view restaurant categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = categories.restaurant_id 
    AND restaurants.is_open = true
  )
);

-- Allow public to view active products from active restaurants
CREATE POLICY "Public can view active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  is_active = true AND
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = products.restaurant_id 
    AND restaurants.is_open = true
  )
);

-- Allow public to validate coupons (read-only for validation)
CREATE POLICY "Public can view active coupons for validation"
ON public.coupons
FOR SELECT
TO anon, authenticated
USING (
  is_active = true AND
  (expires_at IS NULL OR expires_at > NOW()) AND
  (max_uses IS NULL OR used_count < max_uses)
);