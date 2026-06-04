-- Add subscription fields to profiles table for better Stripe subscription management
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_period_end ON public.profiles(subscription_period_end);
CREATE INDEX IF NOT EXISTS idx_profiles_cancel_at_period_end ON public.profiles(cancel_at_period_end);

-- Add comment
COMMENT ON COLUMN public.profiles.subscription_period_end IS 'End date of current subscription period from Stripe';
COMMENT ON COLUMN public.profiles.subscription_period_start IS 'Start date of current subscription period from Stripe';
COMMENT ON COLUMN public.profiles.cancel_at_period_end IS 'Whether subscription will cancel at period end (Stripe flag)';
