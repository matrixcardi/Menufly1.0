-- Add scheduling columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS scheduling_type text CHECK (scheduling_type IN ('delivery', 'retirada'));

-- Create scheduling_config table
CREATE TABLE IF NOT EXISTS public.scheduling_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled_delivery boolean NOT NULL DEFAULT false,
  enabled_pickup boolean NOT NULL DEFAULT false,
  min_advance_minutes int NOT NULL DEFAULT 120,
  slot_interval_minutes int NOT NULL DEFAULT 30,
  max_orders_per_slot int NOT NULL DEFAULT 5,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)
);

-- Create scheduling_blocked_slots table
CREATE TABLE IF NOT EXISTS public.scheduling_blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  blocked_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on scheduling_config
ALTER TABLE public.scheduling_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduling_config
CREATE POLICY "Users can view their own restaurant scheduling config"
  ON public.scheduling_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = scheduling_config.restaurant_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own restaurant scheduling config"
  ON public.scheduling_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = scheduling_config.restaurant_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own restaurant scheduling config"
  ON public.scheduling_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = scheduling_config.restaurant_id 
      AND user_id = auth.uid()
    )
  );

-- Enable RLS on scheduling_blocked_slots
ALTER TABLE public.scheduling_blocked_slots ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduling_blocked_slots
CREATE POLICY "Users can view their own restaurant blocked slots"
  ON public.scheduling_blocked_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = scheduling_blocked_slots.restaurant_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own restaurant blocked slots"
  ON public.scheduling_blocked_slots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = scheduling_blocked_slots.restaurant_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own restaurant blocked slots"
  ON public.scheduling_blocked_slots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = scheduling_blocked_slots.restaurant_id 
      AND user_id = auth.uid()
    )
  );

-- Create index on scheduling_config restaurant_id
CREATE INDEX IF NOT EXISTS idx_scheduling_config_restaurant_id ON public.scheduling_config(restaurant_id);

-- Create index on scheduling_blocked_slots restaurant_id
CREATE INDEX IF NOT EXISTS idx_scheduling_blocked_slots_restaurant_id ON public.scheduling_blocked_slots(restaurant_id);

-- Create index on scheduling_blocked_slots blocked_at
CREATE INDEX IF NOT EXISTS idx_scheduling_blocked_slots_blocked_at ON public.scheduling_blocked_slots(blocked_at);

-- Create index on orders scheduled_at
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_at ON public.orders(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Create index on orders scheduling_type
CREATE INDEX IF NOT EXISTS idx_orders_scheduling_type ON public.orders(scheduling_type) WHERE scheduling_type IS NOT NULL;

-- Add comment to schedule column for documentation
COMMENT ON COLUMN public.scheduling_config.schedule IS 'JSON object with daily schedule configuration. Example: {"monday": {"enabled": true, "start": "10:00", "end": "22:00"}, "tuesday": {"enabled": true, "start": "10:00", "end": "22:00"}, ...}';
