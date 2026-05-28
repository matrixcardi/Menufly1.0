
-- Add 'collaborator' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collaborator';

-- Create table to link collaborators to restaurants
CREATE TABLE public.restaurant_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.restaurant_collaborators ENABLE ROW LEVEL SECURITY;

-- Restaurant owners can manage their collaborators
CREATE POLICY "Owners can manage collaborators"
ON public.restaurant_collaborators
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = restaurant_collaborators.restaurant_id
  AND restaurants.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants
  WHERE restaurants.id = restaurant_collaborators.restaurant_id
  AND restaurants.user_id = auth.uid()
));

-- Collaborators can view their own link
CREATE POLICY "Collaborators can view own link"
ON public.restaurant_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Masters can manage all collaborators
CREATE POLICY "Masters can manage all collaborators"
ON public.restaurant_collaborators
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'))
WITH CHECK (has_role(auth.uid(), 'master'));

-- Allow collaborators to read the restaurant they're linked to
CREATE POLICY "Collaborators can view their restaurant"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurant_collaborators
    WHERE restaurant_collaborators.restaurant_id = restaurants.id
    AND restaurant_collaborators.user_id = auth.uid()
  )
);
