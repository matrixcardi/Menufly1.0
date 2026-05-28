
-- Allow collaborators to manage ingredients
CREATE POLICY "Collaborators can manage ingredients" ON public.ingredients
  FOR ALL TO authenticated
  USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
  WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));
