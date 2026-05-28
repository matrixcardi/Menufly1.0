
-- Create drivers table
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add driver_id to orders
ALTER TABLE public.orders ADD COLUMN driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN driver_name text;

-- Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- RLS policies for drivers
CREATE POLICY "Users can manage their restaurant drivers"
  ON public.drivers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = drivers.restaurant_id AND restaurants.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = drivers.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can view their restaurant drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = drivers.restaurant_id AND restaurants.user_id = auth.uid()));
