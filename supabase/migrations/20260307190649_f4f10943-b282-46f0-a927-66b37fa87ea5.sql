
-- Promos table supporting 3 modalities: fixed_kit, choice_kit, auto_discount
CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  promo_type text NOT NULL DEFAULT 'fixed_kit', -- fixed_kit, choice_kit, auto_discount
  price numeric, -- final price for fixed_kit/choice_kit
  discount_value numeric, -- for auto_discount
  discount_type text DEFAULT 'percentage', -- percentage or fixed
  schedule_type text NOT NULL DEFAULT 'always', -- always, weekday, specific_date, both
  schedule_days integer[] DEFAULT '{}', -- 0=Sun..6=Sat
  schedule_start_date date,
  schedule_end_date date,
  schedule_start_time time,
  schedule_end_time time,
  is_active boolean NOT NULL DEFAULT true,
  show_in_menu boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Promo items: products included in the promo
CREATE TABLE public.promo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_name text, -- for choice_kit: group label like "Escolha seu burger"
  max_choices integer DEFAULT 1, -- for choice_kit: how many can be selected in this group
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_items ENABLE ROW LEVEL SECURITY;

-- Public read for active promos (menu display)
CREATE POLICY "Public can view active promos" ON public.promos
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Owners can manage their promos
CREATE POLICY "Owners can manage promos" ON public.promos
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

-- Public read for promo items
CREATE POLICY "Public can view promo items" ON public.promo_items
  FOR SELECT TO anon, authenticated
  USING (promo_id IN (SELECT id FROM public.promos WHERE is_active = true));

-- Owners can manage promo items
CREATE POLICY "Owners can manage promo items" ON public.promo_items
  FOR ALL TO authenticated
  USING (promo_id IN (SELECT id FROM public.promos WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())))
  WITH CHECK (promo_id IN (SELECT id FROM public.promos WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())));
