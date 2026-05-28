
-- Table to store push notification device tokens
CREATE TABLE public.device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can insert their own tokens"
  ON public.device_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tokens"
  ON public.device_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.device_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.device_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role needs to read tokens by restaurant owner (for edge function)
-- We'll use SECURITY DEFINER function for that
CREATE OR REPLACE FUNCTION public.get_device_tokens_for_restaurant(_restaurant_id UUID)
RETURNS TABLE(token TEXT, platform TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dt.token, dt.platform
  FROM device_tokens dt
  JOIN restaurants r ON r.user_id = dt.user_id
  WHERE r.id = _restaurant_id
  UNION
  SELECT dt.token, dt.platform
  FROM device_tokens dt
  JOIN restaurant_collaborators rc ON rc.user_id = dt.user_id
  WHERE rc.restaurant_id = _restaurant_id;
$$;
