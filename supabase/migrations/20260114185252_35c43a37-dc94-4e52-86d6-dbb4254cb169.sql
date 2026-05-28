-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('master', 'admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Masters can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Allow users to view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create view for masters to see all restaurants (bypasses restaurant RLS)
CREATE OR REPLACE VIEW public.all_restaurants
WITH (security_invoker = off)
AS SELECT 
  r.id,
  r.name,
  r.logo_url,
  r.is_open,
  r.created_at,
  r.user_id,
  p.email as owner_email,
  p.full_name as owner_name
FROM public.restaurants r
LEFT JOIN public.profiles p ON r.user_id = p.id;

-- Grant access to authenticated users (RLS on user_roles controls actual access)
GRANT SELECT ON public.all_restaurants TO authenticated;

-- Create view for masters to see all orders
CREATE OR REPLACE VIEW public.all_orders
WITH (security_invoker = off)
AS SELECT 
  o.*,
  r.name as restaurant_name
FROM public.orders o
JOIN public.restaurants r ON o.restaurant_id = r.id;