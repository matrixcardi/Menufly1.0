
ALTER TABLE public.drivers
ADD COLUMN per_ride_fee numeric NOT NULL DEFAULT 0,
ADD COLUMN fee_mode text NOT NULL DEFAULT 'fixed_only';
