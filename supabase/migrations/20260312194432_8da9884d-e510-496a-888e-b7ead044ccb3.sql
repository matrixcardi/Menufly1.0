-- Fix: original migration targeted subscription_status = 'active' but all users had 'trial'
-- Set all existing profiles to 'elite' since they were on the old single Pro plan
UPDATE public.profiles SET subscription_plan = 'elite' WHERE subscription_plan = 'start' OR subscription_plan IS NULL;