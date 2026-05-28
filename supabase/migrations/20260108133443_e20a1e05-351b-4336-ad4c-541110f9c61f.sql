-- Update submit_order function with input validation
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
  v_clean_name TEXT;
  v_clean_phone TEXT;
  v_clean_address TEXT;
  v_clean_notes TEXT;
BEGIN
  -- ===================
  -- INPUT VALIDATION
  -- ===================
  
  -- Validate and sanitize customer name
  v_clean_name := TRIM(p_customer_name);
  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Nome deve ter pelo menos 2 caracteres');
  END IF;
  IF LENGTH(v_clean_name) > 100 THEN
    RETURN json_build_object('success', false, 'error', 'Nome muito longo (máximo 100 caracteres)');
  END IF;
  
  -- Validate phone format (Brazilian phone: (XX) XXXXX-XXXX or similar)
  v_clean_phone := REGEXP_REPLACE(p_customer_phone, '[^0-9]', '', 'g');
  IF v_clean_phone IS NULL OR LENGTH(v_clean_phone) < 10 OR LENGTH(v_clean_phone) > 11 THEN
    RETURN json_build_object('success', false, 'error', 'Número de telefone inválido');
  END IF;
  
  -- Validate delivery type
  IF p_delivery_type NOT IN ('delivery', 'pickup') THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de entrega inválido');
  END IF;
  
  -- Validate address for delivery orders
  v_clean_address := TRIM(COALESCE(p_customer_address, ''));
  IF p_delivery_type = 'delivery' AND LENGTH(v_clean_address) < 5 THEN
    RETURN json_build_object('success', false, 'error', 'Endereço é obrigatório para entrega');
  END IF;
  IF LENGTH(v_clean_address) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'Endereço muito longo (máximo 500 caracteres)');
  END IF;
  
  -- Validate payment method
  IF p_payment_method NOT IN ('pix', 'cash', 'card') THEN
    RETURN json_build_object('success', false, 'error', 'Método de pagamento inválido');
  END IF;
  
  -- Validate notes length
  v_clean_notes := TRIM(COALESCE(p_notes, ''));
  IF LENGTH(v_clean_notes) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'Observações muito longas (máximo 500 caracteres)');
  END IF;
  IF LENGTH(v_clean_notes) = 0 THEN
    v_clean_notes := NULL;
  END IF;
  
  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Carrinho vazio');
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RETURN json_build_object('success', false, 'error', 'Limite de itens excedido');
  END IF;
  
  -- Validate restaurant exists
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RETURN json_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- ===================
  -- ORDER PROCESSING
  -- ===================

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
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    v_coupon_result := validate_coupon(TRIM(p_coupon_code), p_restaurant_id, v_subtotal);
    IF (v_coupon_result->>'valid')::BOOLEAN THEN
      v_discount := (v_coupon_result->>'discount')::DECIMAL;
      -- Increment coupon usage
      UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 
      WHERE LOWER(code) = LOWER(TRIM(p_coupon_code)) AND restaurant_id = p_restaurant_id;
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

  -- Insert order with sanitized values
  INSERT INTO orders (
    restaurant_id, order_number, customer_name, customer_phone, customer_address,
    delivery_type, payment_method, subtotal, discount, delivery_fee, total,
    coupon_code, items, notes
  ) VALUES (
    p_restaurant_id, v_order_number, v_clean_name, v_clean_phone, 
    CASE WHEN LENGTH(v_clean_address) > 0 THEN v_clean_address ELSE NULL END,
    p_delivery_type, p_payment_method, v_subtotal, v_discount, v_delivery_fee, v_total,
    CASE WHEN p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN TRIM(p_coupon_code) ELSE NULL END, 
    p_items, v_clean_notes
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
    RETURN json_build_object('success', false, 'error', 'Erro ao processar pedido. Tente novamente.');
END;
$$;