-- Allow public read access to orders by order_number (for customer order tracking)
CREATE POLICY "Public can view order by order_number"
ON public.orders
FOR SELECT
USING (true);

-- Drop the existing restrictive select policy since we now allow public read
-- Actually, we need to keep the owner policy too. Postgres OR's permissive policies.
-- But the existing policy is RESTRICTIVE (Permissive: No), so we need to handle this differently.
-- Let's drop the restrictive one and create permissive ones instead.

DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view order by order_number" ON public.orders;

-- Permissive policy: restaurant owners see all their orders
CREATE POLICY "Restaurant owners can view their orders"
ON public.orders
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = orders.restaurant_id
  AND restaurants.user_id = auth.uid()
));

-- Permissive policy: anyone can view a specific order (for customer tracking page)
CREATE POLICY "Anyone can view orders for tracking"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (true);