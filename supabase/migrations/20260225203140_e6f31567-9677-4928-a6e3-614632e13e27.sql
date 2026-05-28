
-- Addon groups (e.g., "Turbine seu Hambúrguer", "Escolha sua bebida")
CREATE TABLE public.addon_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'multiple', -- 'single' (radio) or 'multiple' (checkbox)
  required BOOLEAN NOT NULL DEFAULT false,
  min_select INTEGER DEFAULT 0,
  max_select INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Addon items within groups
CREATE TABLE public.addon_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  addon_group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;

-- RLS for addon_groups
CREATE POLICY "Users can view their restaurant addon groups"
  ON public.addon_groups FOR SELECT
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = addon_groups.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can create addon groups for their restaurant"
  ON public.addon_groups FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = addon_groups.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can update their restaurant addon groups"
  ON public.addon_groups FOR UPDATE
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = addon_groups.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can delete their restaurant addon groups"
  ON public.addon_groups FOR DELETE
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = addon_groups.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Public can view active addon groups"
  ON public.addon_groups FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = addon_groups.restaurant_id));

-- RLS for addon_items
CREATE POLICY "Users can manage their addon items"
  ON public.addon_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM addon_groups ag
    JOIN restaurants r ON r.id = ag.restaurant_id
    WHERE ag.id = addon_items.addon_group_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM addon_groups ag
    JOIN restaurants r ON r.id = ag.restaurant_id
    WHERE ag.id = addon_items.addon_group_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Public can view active addon items"
  ON public.addon_items FOR SELECT
  USING (is_active = true AND EXISTS (
    SELECT 1 FROM addon_groups ag
    WHERE ag.id = addon_items.addon_group_id AND ag.is_active = true
  ));

-- Triggers for updated_at
CREATE TRIGGER update_addon_groups_updated_at
  BEFORE UPDATE ON public.addon_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addon_items_updated_at
  BEFORE UPDATE ON public.addon_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
