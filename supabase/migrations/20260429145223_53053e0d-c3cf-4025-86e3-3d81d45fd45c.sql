-- Tabela de integrações Lá Vem Entregas (1 por restaurante)
CREATE TABLE public.lavem_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  store_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  dispatch_mode TEXT NOT NULL DEFAULT 'manual', -- 'auto' | 'manual'
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lavem_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage lavem integration"
ON public.lavem_integrations FOR ALL TO authenticated
USING (is_restaurant_owner(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_owner(restaurant_id, auth.uid()));

CREATE POLICY "Collaborators can manage lavem integration"
ON public.lavem_integrations FOR ALL TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

CREATE POLICY "Masters can manage all lavem integrations"
ON public.lavem_integrations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER update_lavem_integrations_updated_at
BEFORE UPDATE ON public.lavem_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas em orders para rastrear entregas Lá Vem
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lavem_delivery_id TEXT,
  ADD COLUMN IF NOT EXISTS lavem_status TEXT,
  ADD COLUMN IF NOT EXISTS lavem_tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS lavem_driver_name TEXT,
  ADD COLUMN IF NOT EXISTS lavem_driver_phone TEXT,
  ADD COLUMN IF NOT EXISTS lavem_fee NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_lavem_delivery_id ON public.orders(lavem_delivery_id) WHERE lavem_delivery_id IS NOT NULL;