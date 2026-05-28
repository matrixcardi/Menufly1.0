-- Allow public to view active coupons for any restaurant
CREATE POLICY "Public can view active coupons"
ON public.coupons
FOR SELECT
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);