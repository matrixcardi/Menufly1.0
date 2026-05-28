
-- Create many-to-many junction table for products <-> categories
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Public can view product-category links for active products
CREATE POLICY "Public can view product category links"
ON public.product_categories FOR SELECT
USING (EXISTS (
  SELECT 1 FROM products p WHERE p.id = product_categories.product_id AND p.is_active = true
));

-- Owners can manage
CREATE POLICY "Users can manage their product category links"
ON public.product_categories FOR ALL
USING (EXISTS (
  SELECT 1 FROM products p JOIN restaurants r ON r.id = p.restaurant_id
  WHERE p.id = product_categories.product_id AND r.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM products p JOIN restaurants r ON r.id = p.restaurant_id
  WHERE p.id = product_categories.product_id AND r.user_id = auth.uid()
));

-- Migrate existing category_id data
INSERT INTO public.product_categories (product_id, category_id)
SELECT id, category_id FROM public.products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
