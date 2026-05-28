-- Add description field to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Add a check constraint for max 300 characters
ALTER TABLE public.restaurants 
ADD CONSTRAINT restaurants_description_max_length 
CHECK (description IS NULL OR LENGTH(description) <= 300);