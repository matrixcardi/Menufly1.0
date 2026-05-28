-- Enable RLS on the views and add policies to restrict access to masters only
ALTER VIEW public.all_restaurants SET (security_invoker = on);
ALTER VIEW public.all_orders SET (security_invoker = on);

-- Drop the views and recreate with proper security
DROP VIEW IF EXISTS public.all_orders;
DROP VIEW IF EXISTS public.all_restaurants;

-- Recreate views with security_invoker=on (respects caller's permissions)
CREATE OR REPLACE VIEW public.all_restaurants
WITH (security_invoker = on)
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
LEFT JOIN public.profiles p ON r.user_id = p.id
WHERE public.has_role(auth.uid(), 'master');

CREATE OR REPLACE VIEW public.all_orders
WITH (security_invoker = on)
AS SELECT 
  o.*,
  r.name as restaurant_name
FROM public.orders o
JOIN public.restaurants r ON o.restaurant_id = r.id
WHERE public.has_role(auth.uid(), 'master');

-- Grant access
GRANT SELECT ON public.all_restaurants TO authenticated;
GRANT SELECT ON public.all_orders TO authenticated;