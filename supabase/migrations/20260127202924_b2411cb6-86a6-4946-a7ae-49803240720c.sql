-- Create table for menu highlights
CREATE TABLE public.menu_highlights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  highlight_type text NOT NULL CHECK (highlight_type IN ('coupon', 'product', 'custom')),
  -- For coupon type
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  -- For product type
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  -- For custom type
  custom_title text,
  custom_description text,
  -- Common fields
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.menu_highlights IS 'Stores up to 3 highlight banners for the digital menu';

-- Create index for faster lookups
CREATE INDEX idx_menu_highlights_restaurant ON public.menu_highlights(restaurant_id);

-- Enable RLS
ALTER TABLE public.menu_highlights ENABLE ROW LEVEL SECURITY;

-- RLS policies for owners
CREATE POLICY "Users can view their restaurant highlights" 
ON public.menu_highlights 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = menu_highlights.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can create highlights for their restaurant" 
ON public.menu_highlights 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = menu_highlights.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can update their restaurant highlights" 
ON public.menu_highlights 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = menu_highlights.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

CREATE POLICY "Users can delete their restaurant highlights" 
ON public.menu_highlights 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = menu_highlights.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

-- Public access for menu display
CREATE POLICY "Public can view active highlights" 
ON public.menu_highlights 
FOR SELECT 
USING (
  is_active = true 
  AND EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = menu_highlights.restaurant_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_menu_highlights_updated_at
BEFORE UPDATE ON public.menu_highlights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();