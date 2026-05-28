
-- Table to track AI credits balance per restaurant
CREATE TABLE public.ai_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  total_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Table to track AI credit transactions (purchases and usage)
CREATE TABLE public.ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'usage',
  description text,
  generation_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table to store generated AI content
CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  generation_type text NOT NULL,
  prompt text,
  result_url text,
  credits_used integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_credits
CREATE POLICY "Users can view their restaurant credits" ON public.ai_credits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_credits.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can insert their restaurant credits" ON public.ai_credits
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_credits.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can update their restaurant credits" ON public.ai_credits
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_credits.restaurant_id AND restaurants.user_id = auth.uid()));

-- RLS policies for ai_credit_transactions
CREATE POLICY "Users can view their restaurant transactions" ON public.ai_credit_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_credit_transactions.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can insert their restaurant transactions" ON public.ai_credit_transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_credit_transactions.restaurant_id AND restaurants.user_id = auth.uid()));

-- RLS policies for ai_generations
CREATE POLICY "Users can view their restaurant generations" ON public.ai_generations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_generations.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can insert their restaurant generations" ON public.ai_generations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_generations.restaurant_id AND restaurants.user_id = auth.uid()));

CREATE POLICY "Users can update their restaurant generations" ON public.ai_generations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ai_generations.restaurant_id AND restaurants.user_id = auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_ai_credits_updated_at BEFORE UPDATE ON public.ai_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
