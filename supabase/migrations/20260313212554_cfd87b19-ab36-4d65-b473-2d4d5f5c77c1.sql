CREATE POLICY "Collaborators can manage recipe items"
ON public.recipe_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = recipe_items.product_id
      AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = recipe_items.product_id
      AND is_restaurant_collaborator(p.restaurant_id, auth.uid())
  )
);