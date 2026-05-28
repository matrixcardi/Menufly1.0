
-- Allow collaborators to read orders of their linked restaurant
CREATE POLICY "Collaborators can view restaurant orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators rc
    WHERE rc.restaurant_id = orders.restaurant_id
    AND rc.user_id = auth.uid()
  )
);

-- Allow collaborators to update order status (but not all fields - handled in app)
CREATE POLICY "Collaborators can update restaurant orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators rc
    WHERE rc.restaurant_id = orders.restaurant_id
    AND rc.user_id = auth.uid()
  )
);

-- Allow collaborators to read products
CREATE POLICY "Collaborators can view restaurant products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators rc
    WHERE rc.restaurant_id = products.restaurant_id
    AND rc.user_id = auth.uid()
  )
);

-- Allow collaborators to read categories
CREATE POLICY "Collaborators can view restaurant categories"
ON public.categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators rc
    WHERE rc.restaurant_id = categories.restaurant_id
    AND rc.user_id = auth.uid()
  )
);

-- Allow collaborators to read customers (CRM)
CREATE POLICY "Collaborators can view restaurant customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators rc
    WHERE rc.restaurant_id = customers.restaurant_id
    AND rc.user_id = auth.uid()
  )
);

-- Allow collaborators to read business hours
CREATE POLICY "Collaborators can view restaurant hours"
ON public.business_hours
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators rc
    WHERE rc.restaurant_id = business_hours.restaurant_id
    AND rc.user_id = auth.uid()
  )
);
