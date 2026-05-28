DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drivers'
      AND policyname = 'Collaborators can view restaurant drivers'
  ) THEN
    CREATE POLICY "Collaborators can view restaurant drivers"
    ON public.drivers
    FOR SELECT
    TO authenticated
    USING (
      is_restaurant_collaborator(restaurant_id, auth.uid())
      OR has_role(auth.uid(), 'master'::app_role)
    );
  END IF;
END
$$;