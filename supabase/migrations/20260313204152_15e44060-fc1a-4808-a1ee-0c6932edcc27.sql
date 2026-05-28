-- Allow collaborators to manage cash registers
CREATE POLICY "Collaborators can manage cash registers"
ON public.cash_registers
FOR ALL
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()))
WITH CHECK (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Allow collaborators to view cash registers
CREATE POLICY "Collaborators can view cash registers"
ON public.cash_registers
FOR SELECT
TO authenticated
USING (is_restaurant_collaborator(restaurant_id, auth.uid()));