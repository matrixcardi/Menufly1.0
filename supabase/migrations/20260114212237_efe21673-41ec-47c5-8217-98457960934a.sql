-- Add theme field to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS menu_theme text DEFAULT 'dark';