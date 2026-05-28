
ALTER TABLE public.restaurants 
ADD COLUMN manual_override_until timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.manual_override_until IS 'When set and in the future, manual is_open value overrides business hours scheduling';
