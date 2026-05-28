
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT true;
