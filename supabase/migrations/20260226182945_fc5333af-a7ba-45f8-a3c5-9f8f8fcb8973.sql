
-- 1. Add image_url to addon_items
ALTER TABLE public.addon_items ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add is_active to categories (default true so existing categories remain visible)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. Add sort_order to products for ordering within categories
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
