
-- Table to store delivery platform integrations
CREATE TABLE public.platform_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'ifood', 'aiqfome', 'rappi', 'ubereats'
  status text NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'pending', 'connected', 'error'
  merchant_id text, -- platform-specific merchant/store ID
  api_token text, -- encrypted token for API access
  webhook_url text, -- webhook URL for receiving orders
  last_sync_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb, -- extra platform-specific config
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, platform)
);

-- Enable RLS
ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owners can view their integrations"
  ON public.platform_integrations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants WHERE restaurants.id = platform_integrations.restaurant_id AND restaurants.user_id = auth.uid()
  ));

CREATE POLICY "Owners can create integrations"
  ON public.platform_integrations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants WHERE restaurants.id = platform_integrations.restaurant_id AND restaurants.user_id = auth.uid()
  ));

CREATE POLICY "Owners can update their integrations"
  ON public.platform_integrations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants WHERE restaurants.id = platform_integrations.restaurant_id AND restaurants.user_id = auth.uid()
  ));

CREATE POLICY "Owners can delete their integrations"
  ON public.platform_integrations FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants WHERE restaurants.id = platform_integrations.restaurant_id AND restaurants.user_id = auth.uid()
  ));
