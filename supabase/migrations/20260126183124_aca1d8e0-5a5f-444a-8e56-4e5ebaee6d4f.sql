-- Add slug column to restaurants for friendly URLs
ALTER TABLE public.restaurants ADD COLUMN slug TEXT UNIQUE;

-- Create function to generate slug from restaurant name
CREATE OR REPLACE FUNCTION public.generate_restaurant_slug(restaurant_name TEXT, restaurant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces and special chars with hyphens
  base_slug := LOWER(TRIM(restaurant_name));
  base_slug := REGEXP_REPLACE(base_slug, '[àáâãäå]', 'a', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '[èéêë]', 'e', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '[ìíîï]', 'i', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '[òóôõö]', 'o', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '[ùúûü]', 'u', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '[ç]', 'c', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '[^a-z0-9\-]', '-', 'g');
  base_slug := REGEXP_REPLACE(base_slug, '-+', '-', 'g');
  base_slug := TRIM(BOTH '-' FROM base_slug);
  
  -- Ensure it's not empty
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'restaurante';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM restaurants WHERE slug = final_slug AND id != restaurant_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Generate slugs for existing restaurants
UPDATE public.restaurants
SET slug = generate_restaurant_slug(name, id)
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE public.restaurants ALTER COLUMN slug SET NOT NULL;

-- Create trigger to auto-generate slug on insert if not provided
CREATE OR REPLACE FUNCTION public.set_restaurant_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_restaurant_slug(NEW.name, COALESCE(NEW.id, gen_random_uuid()));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_restaurant_slug
BEFORE INSERT ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.set_restaurant_slug();

-- Create index for faster slug lookups
CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);