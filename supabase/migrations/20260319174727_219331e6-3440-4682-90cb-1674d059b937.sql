CREATE POLICY "Collaborators can manage restaurant drivers"
ON public.drivers
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));