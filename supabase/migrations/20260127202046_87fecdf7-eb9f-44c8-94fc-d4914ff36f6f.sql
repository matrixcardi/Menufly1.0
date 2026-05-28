-- Add max_uses_per_user column to coupons table
-- This limits how many times a single user (by phone number) can use the same coupon
ALTER TABLE public.coupons 
ADD COLUMN max_uses_per_user integer DEFAULT NULL;

COMMENT ON COLUMN public.coupons.max_uses_per_user IS 'Maximum times a single user can use this coupon (NULL = unlimited)';