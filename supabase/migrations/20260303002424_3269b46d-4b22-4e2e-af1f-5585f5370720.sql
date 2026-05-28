-- Add Meta Conversions API access token column to restaurants
ALTER TABLE public.restaurants ADD COLUMN meta_access_token TEXT DEFAULT NULL;