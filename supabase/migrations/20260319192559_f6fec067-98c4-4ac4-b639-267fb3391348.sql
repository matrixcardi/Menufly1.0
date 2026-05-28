
-- Function to allow customers to cancel their own orders (by order ID)
-- Only allows cancellation of pending/awaiting_payment orders
CREATE OR REPLACE FUNCTION public.cancel_order_by_customer(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, status, payment_status INTO v_order
  FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  IF v_order.status NOT IN ('pending') OR v_order.payment_status NOT IN ('pending', 'awaiting_payment') THEN
    RETURN json_build_object('success', false, 'error', 'Este pedido não pode mais ser cancelado');
  END IF;

  UPDATE orders
  SET status = 'cancelled',
      cancellation_reason = 'Cancelado pelo cliente',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object('success', true);
END;
$$;
