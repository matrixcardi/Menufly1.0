-- Remove unique constraint to allow multiple time slots per day
ALTER TABLE public.business_hours DROP CONSTRAINT IF EXISTS business_hours_restaurant_id_day_of_week_key;

-- Add a sort order to organize multiple periods
ALTER TABLE public.business_hours ADD COLUMN IF NOT EXISTS period_order INTEGER NOT NULL DEFAULT 1;