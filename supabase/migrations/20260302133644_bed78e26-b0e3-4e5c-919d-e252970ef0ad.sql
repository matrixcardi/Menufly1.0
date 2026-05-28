-- Allow masters to view all profiles (needed for all_restaurants view)
CREATE POLICY "Masters can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'master'::app_role));