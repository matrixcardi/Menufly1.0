
-- Function to auto-cancel stale orders (pending or awaiting_payment for 30+ minutes)
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cancel orders that are still 'pending' (not accepted by admin) for 30+ minutes
  UPDATE orders
  SET status = 'cancelled',
      cancellation_reason = 'Pedido não foi aceito dentro do prazo de 30 minutos',
      updated_at = now()
  WHERE status = 'pending'
    AND payment_status = 'paid'
    AND created_at < now() - interval '30 minutes';

  -- Cancel orders that are still 'pending' with cash/card payment for 30+ minutes
  UPDATE orders
  SET status = 'cancelled',
      cancellation_reason = 'Pedido não foi aceito dentro do prazo de 30 minutos',
      updated_at = now()
  WHERE status = 'pending'
    AND payment_status = 'pending'
    AND payment_method IN ('cash', 'card')
    AND created_at < now() - interval '30 minutes';

  -- Cancel orders with awaiting_payment (PIX not completed) for 30+ minutes
  UPDATE orders
  SET status = 'cancelled',
      payment_status = 'expired',
      cancellation_reason = 'Tempo para pagamento PIX expirado',
      updated_at = now()
  WHERE status = 'pending'
    AND payment_status = 'awaiting_payment'
    AND created_at < now() - interval '30 minutes';
END;
$$;
