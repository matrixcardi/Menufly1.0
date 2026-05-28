
-- Add source tracking on orders for multi-channel support
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'menufly',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_data jsonb;

-- Prevent duplicate iFood orders during polling
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_source_external
  ON public.orders (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders (source);

-- Cache iFood OAuth token per restaurant integration
ALTER TABLE public.platform_integrations
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS last_error text;
