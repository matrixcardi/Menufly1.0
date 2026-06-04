-- Security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'master'
  )
$$;

-- Allow masters to update all profiles
DROP POLICY IF EXISTS "Masters can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Master can update any profile" ON public.profiles;
CREATE POLICY "Master can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

-- Allow masters to update all restaurants
DROP POLICY IF EXISTS "Masters can update all restaurants" ON public.restaurants;
CREATE POLICY "Master can update any restaurant"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

-- Allow masters to manage user_roles (including role changes)
DROP POLICY IF EXISTS "Masters can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master can manage all user_roles" ON public.user_roles;
CREATE POLICY "Master can manage all user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

-- Ensure testemaster@gmail.com has the master role
-- Note: Replace 'ID_DO_MASTER' with actual ID if known, but migration should be generic.
-- This part is usually handled via SQL editor or seed script.
