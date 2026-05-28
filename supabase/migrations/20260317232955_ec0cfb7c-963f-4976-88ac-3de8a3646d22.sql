ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS mp_public_key text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS card_online_enabled boolean NOT NULL DEFAULT false;