
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pix_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_gateway text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pix_gateway_token text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_gateway text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_gateway_token text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text DEFAULT NULL;
