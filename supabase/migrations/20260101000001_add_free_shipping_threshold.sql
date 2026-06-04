-- Add free_shipping_threshold to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS free_shipping_threshold DECIMAL(10,2) DEFAULT NULL;
