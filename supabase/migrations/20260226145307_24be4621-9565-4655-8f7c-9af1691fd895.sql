
-- Junction table: links addon groups to specific products
CREATE TABLE public.product_addon_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  addon_group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, addon_group_id)
);

-- RLS
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;

-- Public read (for menu)
CREATE POLICY "Public can view product addon links"
ON public.product_addon_groups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM products p WHERE p.id = product_addon_groups.product_id AND p.is_active = true
));

-- Admin manage
CREATE POLICY "Users can manage their product addon links"
ON public.product_addon_groups FOR ALL
USING (EXISTS (
  SELECT 1 FROM products p JOIN restaurants r ON r.id = p.restaurant_id
  WHERE p.id = product_addon_groups.product_id AND r.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM products p JOIN restaurants r ON r.id = p.restaurant_id
  WHERE p.id = product_addon_groups.product_id AND r.user_id = auth.uid()
));
