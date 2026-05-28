
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_greeting_message text DEFAULT 'Olá! 👋 Bem-vindo ao nosso restaurante! Confira nosso cardápio completo:',
ADD COLUMN IF NOT EXISTS bot_order_updates boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS bot_feedback_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS google_review_link text DEFAULT NULL;
