
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS bot_auto_reply_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.whatsapp_bot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  last_bot_reply_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, phone)
);

ALTER TABLE public.whatsapp_bot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/collabs/master can view bot conversations"
  ON public.whatsapp_bot_conversations FOR SELECT
  USING (
    public.is_restaurant_owner(restaurant_id, auth.uid())
    OR public.is_restaurant_collaborator(restaurant_id, auth.uid())
    OR public.has_role(auth.uid(), 'master'::app_role)
  );
