
CREATE OR REPLACE FUNCTION public.confirm_pix_payment(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Find the order
  SELECT id, payment_status, payment_method, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- Only allow confirming PIX orders that are awaiting payment
  IF v_order.payment_method != 'pix' THEN
    RETURN json_build_object('success', false, 'error', 'Pedido não é PIX');
  END IF;

  IF v_order.payment_status != 'awaiting_payment' THEN
    RETURN json_build_object('success', false, 'error', 'Pagamento já foi processado');
  END IF;

  -- Update payment status to paid and ensure order status is pending (visible to admin)
  UPDATE orders
  SET payment_status = 'paid',
      status = 'pending',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object('success', true);
END;
$$;
