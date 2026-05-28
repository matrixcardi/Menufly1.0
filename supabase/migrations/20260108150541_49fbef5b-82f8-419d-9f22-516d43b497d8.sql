-- Add marketing/ads columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN meta_pixel_id TEXT,
ADD COLUMN gtm_container_id TEXT,
ADD COLUMN ga_measurement_id TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.restaurants.meta_pixel_id IS 'Meta (Facebook) Pixel ID';
COMMENT ON COLUMN public.restaurants.gtm_container_id IS 'Google Tag Manager Container ID (GTM-XXXXX)';
COMMENT ON COLUMN public.restaurants.ga_measurement_id IS 'Google Analytics Measurement ID (G-XXXXX)';