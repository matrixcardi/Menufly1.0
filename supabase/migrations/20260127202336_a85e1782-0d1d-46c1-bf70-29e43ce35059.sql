-- Add applies_to column to coupons table
-- This determines what the coupon discount applies to: shipping, total order, or products only
ALTER TABLE public.coupons 
ADD COLUMN applies_to text NOT NULL DEFAULT 'total';

-- Add a check constraint for valid values
ALTER TABLE public.coupons 
ADD CONSTRAINT coupons_applies_to_check 
CHECK (applies_to IN ('shipping', 'total', 'products_only'));

COMMENT ON COLUMN public.coupons.applies_to IS 'What the coupon applies to: shipping (frete), total (pedido total), products_only (somente produtos)';