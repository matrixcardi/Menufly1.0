-- Add order status column (separate from payment_status)
ALTER TABLE public.orders 
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.orders.status IS 'Order status: pending, confirmed, preparing, ready, delivered';