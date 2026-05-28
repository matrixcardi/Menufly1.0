
-- Create security definer functions to avoid circular RLS recursion

-- Function to check if a user owns a restaurant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_restaurant_owner(_restaurant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants
    WHERE id = _restaurant_id
      AND user_id = _user_id
  )
$$;

-- Function to check if a user is a collaborator of a restaurant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_restaurant_collaborator(_restaurant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_collaborators
    WHERE restaurant_id = _restaurant_id
      AND user_id = _user_id
  )
$$;

-- Fix restaurants table policies: replace collaborator policy that caused recursion
DROP POLICY IF EXISTS "Collaborators can view their restaurant" ON public.restaurants;
CREATE POLICY "Collaborators can view their restaurant"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (public.is_restaurant_collaborator(id, auth.uid()));

-- Fix restaurant_collaborators policies that reference restaurants
DROP POLICY IF EXISTS "Owners can manage collaborators" ON public.restaurant_collaborators;
CREATE POLICY "Owners can manage collaborators"
  ON public.restaurant_collaborators FOR ALL
  TO authenticated
  USING (public.is_restaurant_owner(restaurant_id, auth.uid()))
  WITH CHECK (public.is_restaurant_owner(restaurant_id, auth.uid()));

-- Fix other tables that have circular references through restaurants
-- Categories
DROP POLICY IF EXISTS "Collaborators can view restaurant categories" ON public.categories;
CREATE POLICY "Collaborators can view restaurant categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Products  
DROP POLICY IF EXISTS "Collaborators can view restaurant products" ON public.products;
CREATE POLICY "Collaborators can view restaurant products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Orders
DROP POLICY IF EXISTS "Collaborators can view restaurant orders" ON public.orders;
CREATE POLICY "Collaborators can view restaurant orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_restaurant_collaborator(restaurant_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can update restaurant orders" ON public.orders;
CREATE POLICY "Collaborators can update restaurant orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Customers
DROP POLICY IF EXISTS "Collaborators can view restaurant customers" ON public.customers;
CREATE POLICY "Collaborators can view restaurant customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.is_restaurant_collaborator(restaurant_id, auth.uid()));
