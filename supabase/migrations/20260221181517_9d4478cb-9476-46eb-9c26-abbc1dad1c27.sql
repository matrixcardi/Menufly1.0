
-- Add WhatsApp instance columns to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS whatsapp_instance_name text,
ADD COLUMN IF NOT EXISTS whatsapp_connected boolean DEFAULT false;
