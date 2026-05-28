-- Create table for business hours per day of week
CREATE TABLE public.business_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  opening_time TEXT NOT NULL DEFAULT '18:00',
  closing_time TEXT NOT NULL DEFAULT '23:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their restaurant hours"
ON public.business_hours FOR SELECT
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = business_hours.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can create hours for their restaurant"
ON public.business_hours FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = business_hours.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can update their restaurant hours"
ON public.business_hours FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = business_hours.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can delete their restaurant hours"
ON public.business_hours FOR DELETE
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = business_hours.restaurant_id
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Public can view open restaurant hours"
ON public.business_hours FOR SELECT
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = business_hours.restaurant_id
  AND restaurants.is_open = true
));

-- Create trigger for updated_at
CREATE TRIGGER update_business_hours_updated_at
BEFORE UPDATE ON public.business_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to initialize default hours for a restaurant
CREATE OR REPLACE FUNCTION public.initialize_business_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.business_hours (restaurant_id, day_of_week, is_open, opening_time, closing_time)
  VALUES
    (NEW.id, 0, false, '18:00', '23:00'), -- Domingo (fechado por padrão)
    (NEW.id, 1, true, '18:00', '23:00'),  -- Segunda
    (NEW.id, 2, true, '18:00', '23:00'),  -- Terça
    (NEW.id, 3, true, '18:00', '23:00'),  -- Quarta
    (NEW.id, 4, true, '18:00', '23:00'),  -- Quinta
    (NEW.id, 5, true, '18:00', '23:00'),  -- Sexta
    (NEW.id, 6, true, '18:00', '23:00');  -- Sábado
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to initialize hours when restaurant is created
CREATE TRIGGER on_restaurant_created_init_hours
AFTER INSERT ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.initialize_business_hours();

-- Initialize hours for existing restaurants
INSERT INTO public.business_hours (restaurant_id, day_of_week, is_open, opening_time, closing_time)
SELECT r.id, d.day, 
  CASE WHEN d.day = 0 THEN false ELSE true END,
  COALESCE(r.opening_time, '18:00'),
  COALESCE(r.closing_time, '23:00')
FROM public.restaurants r
CROSS JOIN (SELECT generate_series(0, 6) AS day) d
ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;