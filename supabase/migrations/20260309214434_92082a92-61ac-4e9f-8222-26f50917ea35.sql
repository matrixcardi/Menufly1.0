
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cash_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_on_delivery_enabled boolean NOT NULL DEFAULT true;
