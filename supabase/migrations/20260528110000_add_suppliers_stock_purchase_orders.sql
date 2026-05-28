-- Suppliers + Stock + Purchase Orders
-- Adds supplier management and inventory tracking tables with RLS.

-- 1) suppliers (fornecedores)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  cnpj text,
  payment_terms text,
  delivery_days int,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant_id ON public.suppliers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(active) WHERE active = true;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage suppliers"
  ON public.suppliers
  FOR ALL TO authenticated
  USING (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  )
  WITH CHECK (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

CREATE POLICY "Collaborators can view suppliers"
  ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    public.is_restaurant_collaborator(restaurant_id, auth.uid())
    OR public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

-- 2) ingredient_suppliers (relação ingrediente ↔ fornecedor)
CREATE TABLE IF NOT EXISTS public.ingredient_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  unit_cost numeric,
  is_preferred boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredient_suppliers_ingredient_supplier
  ON public.ingredient_suppliers(ingredient_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_suppliers_ingredient_id ON public.ingredient_suppliers(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_suppliers_supplier_id ON public.ingredient_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_suppliers_is_preferred ON public.ingredient_suppliers(is_preferred) WHERE is_preferred = true;

ALTER TABLE public.ingredient_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage ingredient suppliers"
  ON public.ingredient_suppliers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ingredients i
      JOIN public.suppliers s ON s.id = ingredient_suppliers.supplier_id
      WHERE i.id = ingredient_suppliers.ingredient_id
        AND i.restaurant_id = s.restaurant_id
        AND (
          public.is_restaurant_owner(i.restaurant_id, auth.uid())
          OR public.has_role(auth.uid(), 'master'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ingredients i
      JOIN public.suppliers s ON s.id = ingredient_suppliers.supplier_id
      WHERE i.id = ingredient_suppliers.ingredient_id
        AND i.restaurant_id = s.restaurant_id
        AND (
          public.is_restaurant_owner(i.restaurant_id, auth.uid())
          OR public.has_role(auth.uid(), 'master'::public.app_role)
        )
    )
  );

CREATE POLICY "Collaborators can view ingredient suppliers"
  ON public.ingredient_suppliers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ingredients i
      JOIN public.suppliers s ON s.id = ingredient_suppliers.supplier_id
      WHERE i.id = ingredient_suppliers.ingredient_id
        AND i.restaurant_id = s.restaurant_id
        AND (
          public.is_restaurant_collaborator(i.restaurant_id, auth.uid())
          OR public.is_restaurant_owner(i.restaurant_id, auth.uid())
          OR public.has_role(auth.uid(), 'master'::public.app_role)
        )
    )
  );

-- 3) stock_levels (saldo atual por ingrediente)
CREATE TABLE IF NOT EXISTS public.stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  current_quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  unit text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_restaurant_id ON public.stock_levels(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_ingredient_id ON public.stock_levels(ingredient_id);

CREATE TRIGGER update_stock_levels_updated_at
  BEFORE UPDATE ON public.stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage stock levels"
  ON public.stock_levels
  FOR ALL TO authenticated
  USING (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  )
  WITH CHECK (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

CREATE POLICY "Collaborators can view stock levels"
  ON public.stock_levels
  FOR SELECT TO authenticated
  USING (
    public.is_restaurant_collaborator(restaurant_id, auth.uid())
    OR public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

-- 4) stock_movements (histórico de movimentações)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste')),
  quantity numeric NOT NULL,
  reason text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  purchase_order_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_restaurant_id ON public.stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient_id ON public.stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_purchase_order_id ON public.stock_movements(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage stock movements"
  ON public.stock_movements
  FOR ALL TO authenticated
  USING (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  )
  WITH CHECK (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

CREATE POLICY "Collaborators can view stock movements"
  ON public.stock_movements
  FOR SELECT TO authenticated
  USING (
    public.is_restaurant_collaborator(restaurant_id, auth.uid())
    OR public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

-- 5) purchase_orders (pedidos de compra)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('rascunho', 'enviado', 'recebido', 'cancelado')),
  notes text,
  total_value numeric,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_restaurant_id ON public.purchase_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage purchase orders"
  ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  )
  WITH CHECK (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

CREATE POLICY "Collaborators can view purchase orders"
  ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.is_restaurant_collaborator(restaurant_id, auth.uid())
    OR public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::public.app_role)
  );

-- Link stock movements to purchase orders (table exists now)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_stock_movements_purchase_order'
      AND conrelid = 'public.stock_movements'::regclass
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT fk_stock_movements_purchase_order
      FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6) purchase_order_items (itens do pedido de compra)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity_ordered numeric NOT NULL,
  quantity_received numeric,
  unit_cost numeric,
  total_cost numeric
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_purchase_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_ingredient_id ON public.purchase_order_items(ingredient_id);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage purchase order items"
  ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND (
          public.is_restaurant_owner(po.restaurant_id, auth.uid())
          OR public.has_role(auth.uid(), 'master'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND (
          public.is_restaurant_owner(po.restaurant_id, auth.uid())
          OR public.has_role(auth.uid(), 'master'::public.app_role)
        )
    )
  );

CREATE POLICY "Collaborators can view purchase order items"
  ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND (
          public.is_restaurant_collaborator(po.restaurant_id, auth.uid())
          OR public.is_restaurant_owner(po.restaurant_id, auth.uid())
          OR public.has_role(auth.uid(), 'master'::public.app_role)
        )
    )
  );

