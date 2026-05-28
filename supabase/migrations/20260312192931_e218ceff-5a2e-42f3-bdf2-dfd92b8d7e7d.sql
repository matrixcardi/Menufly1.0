
-- Add subscription_plan column to profiles to track which plan the user is on
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'start';

-- Update existing active users to 'elite' (they were on the old Pro plan)
UPDATE public.profiles SET subscription_plan = 'elite' WHERE subscription_status = 'active';
