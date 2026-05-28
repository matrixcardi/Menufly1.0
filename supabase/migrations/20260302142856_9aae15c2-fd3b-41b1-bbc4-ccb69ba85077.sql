
ALTER TABLE public.restaurants 
ADD COLUMN operation_mode text NOT NULL DEFAULT 'automatic';

COMMENT ON COLUMN public.restaurants.operation_mode 
IS 'manual = only admin toggle controls open/close. automatic = follows business hours but manual override takes priority';
