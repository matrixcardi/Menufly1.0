
-- Remove the trigger first (correct name)
DROP TRIGGER IF EXISTS archive_orders_on_restaurant_open ON public.restaurants;

-- Now remove the function
DROP FUNCTION IF EXISTS public.archive_orders_on_open();
