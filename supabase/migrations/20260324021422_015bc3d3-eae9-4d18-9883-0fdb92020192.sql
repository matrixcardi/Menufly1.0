
-- WhatsApp message credits per restaurant
CREATE TABLE public.whatsapp_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

ALTER TABLE public.whatsapp_credits ENABLE ROW LEVEL SECURITY;

-- Owners can manage their credits
CREATE POLICY "Owners can manage whatsapp credits" ON public.whatsapp_credits
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = whatsapp_credits.restaurant_id AND restaurants.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = whatsapp_credits.restaurant_id AND restaurants.user_id = auth.uid()));

-- Collaborators can view
CREATE POLICY "Collaborators can view whatsapp credits" ON public.whatsapp_credits
  FOR SELECT TO authenticated
  USING (is_restaurant_collaborator(restaurant_id, auth.uid()));

-- Masters can view all
CREATE POLICY "Masters can view all whatsapp credits" ON public.whatsapp_credits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));

-- Transaction history
CREATE TABLE public.whatsapp_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'usage',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view whatsapp credit transactions" ON public.whatsapp_credit_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = whatsapp_credit_transactions.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Collaborators can view whatsapp credit transactions" ON public.whatsapp_credit_transactions
  FOR SELECT TO authenticated
  USING (is_restaurant_collaborator(restaurant_id, auth.uid()));

CREATE POLICY "Service role can manage whatsapp credit transactions" ON public.whatsapp_credit_transactions
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
