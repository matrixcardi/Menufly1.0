-- Remove automatic 15-day trial. Trial becomes opt-in via Master panel.
DROP TRIGGER IF EXISTS trigger_set_trial_ends_at ON public.restaurants;
DROP FUNCTION IF EXISTS public.set_trial_ends_at();

ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'inactive';