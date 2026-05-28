-- Drop existing public policy and create new one that allows viewing by slug
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- Create new policy that allows viewing restaurants by slug (for menu access)
CREATE POLICY "Public can view restaurants by slug" 
ON public.restaurants 
FOR SELECT 
USING (true);

-- Update products policy to allow viewing when restaurant has slug
DROP POLICY IF EXISTS "Public can view active products" ON public.products;

CREATE POLICY "Public can view active products" 
ON public.products 
FOR SELECT 
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = products.restaurant_id
  )
);

-- Update categories policy
DROP POLICY IF EXISTS "Public can view restaurant categories" ON public.categories;

CREATE POLICY "Public can view restaurant categories" 
ON public.categories 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = categories.restaurant_id
  )
);

-- Update business_hours policy
DROP POLICY IF EXISTS "Public can view open restaurant hours" ON public.business_hours;

CREATE POLICY "Public can view restaurant hours" 
ON public.business_hours 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = business_hours.restaurant_id
  )
);

-- Update delivery_zones policy
DROP POLICY IF EXISTS "Public can view active delivery zones" ON public.delivery_zones;

CREATE POLICY "Public can view active delivery zones" 
ON public.delivery_zones 
FOR SELECT 
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = delivery_zones.restaurant_id
  )
);