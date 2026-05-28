
-- Create customers table to store auto-registered customers per restaurant
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_order_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, phone)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Public can insert (upsert) customers (for checkout auto-registration)
-- We'll use a security definer function instead of direct insert

-- Restaurant owners can view their customers
CREATE POLICY "Restaurant owners can view their customers"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = customers.restaurant_id
    AND restaurants.user_id = auth.uid()
  )
);

-- Masters can view all customers
CREATE POLICY "Masters can view all customers"
ON public.customers
FOR SELECT
USING (has_role(auth.uid(), 'master'));

-- Restaurant owners can manage their customers
CREATE POLICY "Restaurant owners can manage their customers"
ON public.customers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = customers.restaurant_id
    AND restaurants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = customers.restaurant_id
    AND restaurants.user_id = auth.uid()
  )
);

-- Create a security definer function for public customer registration
CREATE OR REPLACE FUNCTION public.register_customer(
  p_restaurant_id uuid,
  p_name text,
  p_phone text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name text;
  v_clean_phone text;
  v_customer_id uuid;
BEGIN
  -- Validate inputs
  v_clean_name := TRIM(p_name);
  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Nome inválido');
  END IF;
  IF LENGTH(v_clean_name) > 100 THEN
    v_clean_name := LEFT(v_clean_name, 100);
  END IF;

  v_clean_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  IF v_clean_phone IS NULL OR LENGTH(v_clean_phone) < 10 OR LENGTH(v_clean_phone) > 11 THEN
    RETURN json_build_object('success', false, 'error', 'Telefone inválido');
  END IF;

  -- Verify restaurant exists
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RETURN json_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Upsert customer
  INSERT INTO customers (restaurant_id, name, phone)
  VALUES (p_restaurant_id, v_clean_name, v_clean_phone)
  ON CONFLICT (restaurant_id, phone)
  DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  RETURN json_build_object('success', true, 'customer_id', v_customer_id);
END;
$$;

-- Update submit_order to also update customer stats
CREATE OR REPLACE FUNCTION public.update_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
BEGIN
  v_clean_phone := REGEXP_REPLACE(NEW.customer_phone, '[^0-9]', '', 'g');
  
  -- Upsert customer with order stats
  INSERT INTO customers (restaurant_id, name, phone, total_orders, total_spent, last_order_at)
  VALUES (NEW.restaurant_id, NEW.customer_name, v_clean_phone, 1, NEW.total, NEW.created_at)
  ON CONFLICT (restaurant_id, phone)
  DO UPDATE SET
    name = EXCLUDED.name,
    total_orders = customers.total_orders + 1,
    total_spent = customers.total_spent + EXCLUDED.total_spent,
    last_order_at = GREATEST(customers.last_order_at, EXCLUDED.last_order_at),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
CREATE TRIGGER on_order_created_update_customer
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_on_order();

-- Backfill existing orders into customers table
INSERT INTO customers (restaurant_id, name, phone, total_orders, total_spent, last_order_at, created_at)
SELECT 
  o.restaurant_id,
  (array_agg(o.customer_name ORDER BY o.created_at DESC))[1] as name,
  REGEXP_REPLACE(o.customer_phone, '[^0-9]', '', 'g') as phone,
  COUNT(*) as total_orders,
  SUM(o.total) as total_spent,
  MAX(o.created_at) as last_order_at,
  MIN(o.created_at) as created_at
FROM orders o
WHERE o.status != 'cancelled'
GROUP BY o.restaurant_id, REGEXP_REPLACE(o.customer_phone, '[^0-9]', '', 'g')
ON CONFLICT (restaurant_id, phone) DO NOTHING;

-- Update timestamp trigger
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
