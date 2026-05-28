-- Create orders table for persisting orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  delivery_type TEXT NOT NULL DEFAULT 'delivery',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  coupon_code TEXT,
  items JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for orders - restaurant owners can view their orders
CREATE POLICY "Restaurant owners can view their orders" 
ON public.orders FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = orders.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

-- Allow public to insert orders (customers placing orders)
CREATE POLICY "Public can create orders" 
ON public.orders FOR INSERT 
WITH CHECK (true);

-- Restaurant owners can update order status
CREATE POLICY "Restaurant owners can update orders" 
ON public.orders FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM restaurants 
  WHERE restaurants.id = orders.restaurant_id 
  AND restaurants.user_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to validate and apply coupon server-side
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_coupon_code TEXT,
  p_restaurant_id UUID,
  p_subtotal DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount DECIMAL;
BEGIN
  -- Fetch and validate coupon
  SELECT * INTO v_coupon
  FROM coupons
  WHERE LOWER(code) = LOWER(p_coupon_code)
    AND restaurant_id = p_restaurant_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR used_count < max_uses)
    AND (min_order IS NULL OR p_subtotal >= min_order);
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Cupom inválido, expirado ou não atinge o valor mínimo');
  END IF;
  
  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := p_subtotal * (v_coupon.discount_value / 100);
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_subtotal);
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'discount', v_discount,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'description', CASE 
      WHEN v_coupon.discount_type = 'percentage' THEN v_coupon.discount_value || '% OFF'
      ELSE 'R$ ' || v_coupon.discount_value || ' OFF'
    END
  );
END;
$$;

-- Create function to submit order with server-side validation
CREATE OR REPLACE FUNCTION public.submit_order(
  p_restaurant_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_delivery_type TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_coupon_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal DECIMAL := 0;
  v_discount DECIMAL := 0;
  v_delivery_fee DECIMAL := 0;
  v_total DECIMAL;
  v_order_number TEXT;
  v_order_id UUID;
  v_item RECORD;
  v_coupon_result JSON;
BEGIN
  -- Calculate subtotal from items (server-side calculation)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + ((v_item.value->>'price')::DECIMAL * (v_item.value->>'quantity')::INTEGER);
    -- Add addons total if present
    IF v_item.value->>'addonsTotal' IS NOT NULL THEN
      v_subtotal := v_subtotal + ((v_item.value->>'addonsTotal')::DECIMAL * (v_item.value->>'quantity')::INTEGER);
    END IF;
  END LOOP;

  -- Validate coupon if provided
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    v_coupon_result := validate_coupon(p_coupon_code, p_restaurant_id, v_subtotal);
    IF (v_coupon_result->>'valid')::BOOLEAN THEN
      v_discount := (v_coupon_result->>'discount')::DECIMAL;
      -- Increment coupon usage
      UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 
      WHERE LOWER(code) = LOWER(p_coupon_code) AND restaurant_id = p_restaurant_id;
    END IF;
  END IF;

  -- Set delivery fee (could be based on restaurant settings)
  IF p_delivery_type = 'delivery' THEN
    v_delivery_fee := 5.00; -- Default delivery fee
  END IF;

  -- Calculate total
  v_total := v_subtotal - v_discount + v_delivery_fee;
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Generate order number (simple format: timestamp-based)
  v_order_number := TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- Insert order
  INSERT INTO orders (
    restaurant_id, order_number, customer_name, customer_phone, customer_address,
    delivery_type, payment_method, subtotal, discount, delivery_fee, total,
    coupon_code, items, notes
  ) VALUES (
    p_restaurant_id, v_order_number, p_customer_name, p_customer_phone, p_customer_address,
    p_delivery_type, p_payment_method, v_subtotal, v_discount, v_delivery_fee, v_total,
    p_coupon_code, p_items, p_notes
  )
  RETURNING id INTO v_order_id;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Allow anon/public to call these functions
GRANT EXECUTE ON FUNCTION public.validate_coupon TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order TO anon, authenticated;