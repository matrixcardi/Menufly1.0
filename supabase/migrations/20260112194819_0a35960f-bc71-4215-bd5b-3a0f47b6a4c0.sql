-- Remove public SELECT policy on coupons table to prevent coupon code enumeration
-- The validate_coupon() RPC function will handle all public coupon validation
DROP POLICY IF EXISTS "Public can view active coupons for validation" ON public.coupons;