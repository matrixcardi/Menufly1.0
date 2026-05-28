-- Add logo_url and banner_url columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS banner_url text;