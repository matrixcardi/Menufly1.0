
-- Allow master users full access to auto_promos
CREATE POLICY "Masters can manage auto_promos"
ON public.auto_promos
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));
