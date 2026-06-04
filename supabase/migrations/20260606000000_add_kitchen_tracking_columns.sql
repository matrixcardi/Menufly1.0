-- ================================================================
-- Add kitchen tracking columns to orders for Salão tabs
-- ================================================================

-- Add kitchen_status column to track order status in kitchen
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending'
CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'delivered'));

-- Add timestamps for kitchen workflow
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS sent_to_kitchen_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS marked_ready_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;

-- Add closed_at timestamp for closed orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ DEFAULT NULL;

-- Ensure payment_amount column exists (may already exist as total)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);

-- Create index for kitchen status queries
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_status 
ON public.orders(restaurant_id, kitchen_status, sent_to_kitchen_at)
WHERE sent_to_kitchen_at IS NOT NULL AND closed_at IS NULL;

-- Create index for closed orders queries
CREATE INDEX IF NOT EXISTS idx_orders_closed 
ON public.orders(restaurant_id, closed_at DESC)
WHERE closed_at IS NOT NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
