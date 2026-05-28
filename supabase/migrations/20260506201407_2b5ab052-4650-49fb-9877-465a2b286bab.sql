
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_d7_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_email_d3_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_email_d1_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_email_d0_sent boolean NOT NULL DEFAULT false;

-- Backfill existing restaurants with 15-day trial from now
UPDATE public.restaurants
SET trial_ends_at = now() + interval '15 days'
WHERE trial_ends_at IS NULL;

-- Trigger to auto-set trial_ends_at on new restaurants
CREATE OR REPLACE FUNCTION public.set_trial_ends_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := now() + interval '15 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_trial_ends_at ON public.restaurants;
CREATE TRIGGER trigger_set_trial_ends_at
BEFORE INSERT ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.set_trial_ends_at();
