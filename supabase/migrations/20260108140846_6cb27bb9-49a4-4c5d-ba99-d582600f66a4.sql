-- Add length validation to validate_coupon function
CREATE OR REPLACE FUNCTION public.validate_coupon(p_coupon_code TEXT, p_restaurant_id UUID, p_subtotal DECIMAL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount DECIMAL;
  v_clean_code TEXT;
BEGIN
  -- Validate and sanitize coupon code
  v_clean_code := TRIM(p_coupon_code);
  
  IF v_clean_code IS NULL OR LENGTH(v_clean_code) = 0 THEN
    RETURN json_build_object('valid', false, 'error', 'Código do cupom é obrigatório');
  END IF;
  
  -- Length validation to prevent abuse
  IF LENGTH(v_clean_code) > 50 THEN
    RETURN json_build_object('valid', false, 'error', 'Cupom inválido');
  END IF;
  
  -- Validate restaurant_id format
  IF p_restaurant_id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Restaurante não identificado');
  END IF;

  -- Fetch and validate coupon
  SELECT * INTO v_coupon
  FROM coupons
  WHERE LOWER(code) = LOWER(v_clean_code)
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