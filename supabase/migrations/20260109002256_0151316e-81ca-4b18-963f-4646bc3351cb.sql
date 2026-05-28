-- Create delivery_zones table for managing delivery fees by neighborhood or radius
CREATE TABLE public.delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('neighborhood', 'radius')),
  name TEXT NOT NULL, -- Neighborhood name or radius description (e.g., "Até 3km")
  fee NUMERIC NOT NULL DEFAULT 0,
  min_radius_km NUMERIC, -- For radius type: starting distance
  max_radius_km NUMERIC, -- For radius type: ending distance
  estimated_time_min INTEGER, -- Optional: estimated delivery time in minutes
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add delivery settings columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'neighborhood' CHECK (delivery_method IN ('neighborhood', 'radius')),
ADD COLUMN IF NOT EXISTS default_delivery_time_min INTEGER,
ADD COLUMN IF NOT EXISTS restaurant_lat NUMERIC,
ADD COLUMN IF NOT EXISTS restaurant_lng NUMERIC;

-- Enable RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_zones
CREATE POLICY "Users can view their restaurant delivery zones"
ON public.delivery_zones FOR SELECT
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = delivery_zones.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can create delivery zones for their restaurant"
ON public.delivery_zones FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = delivery_zones.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can update their restaurant delivery zones"
ON public.delivery_zones FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = delivery_zones.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can delete their restaurant delivery zones"
ON public.delivery_zones FOR DELETE
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = delivery_zones.restaurant_id
  AND restaurants.user_id = auth.uid()
));

-- Public can view active delivery zones for open restaurants
CREATE POLICY "Public can view active delivery zones"
ON public.delivery_zones FOR SELECT
USING (
  is_active = true AND
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = delivery_zones.restaurant_id
    AND restaurants.is_open = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_delivery_zones_updated_at
BEFORE UPDATE ON public.delivery_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();