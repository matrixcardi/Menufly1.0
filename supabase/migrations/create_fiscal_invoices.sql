CREATE TABLE IF NOT EXISTS fiscal_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_id TEXT,
  nfe_number TEXT,
  nfe_key TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_order_id
  ON fiscal_invoices(order_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_restaurant_id
  ON fiscal_invoices(restaurant_id);

ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage their invoices"
  ON fiscal_invoices FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );
