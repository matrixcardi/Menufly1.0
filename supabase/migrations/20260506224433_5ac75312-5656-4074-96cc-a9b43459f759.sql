
-- Add tracking column
ALTER TABLE public.whatsapp_credits
  ADD COLUMN IF NOT EXISTS last_monthly_recharge_at timestamptz;

-- Helper: monthly credit amount per plan
CREATE OR REPLACE FUNCTION public.monthly_credits_for_plan(p_plan text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_plan = 'assessoria' THEN 5000
    WHEN p_plan = 'elite' THEN 1000
    ELSE 0
  END;
$$;

-- Master-only RPC: update plan + status, and top-up credits when applicable
CREATE OR REPLACE FUNCTION public.master_update_account(
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_subscription_active boolean DEFAULT NULL,
  p_trial_ends_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly integer;
  v_rest record;
BEGIN
  IF NOT has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Only master can update accounts';
  END IF;

  IF p_plan NOT IN ('start','elite','assessoria') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  IF p_status NOT IN ('active','trial','expired','cancelled','inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.profiles
     SET subscription_plan = p_plan,
         subscription_status = p_status,
         updated_at = now()
   WHERE id = p_user_id;

  -- Sync subscription_active across all restaurants of this user
  UPDATE public.restaurants
     SET subscription_active = COALESCE(
           p_subscription_active,
           CASE WHEN p_status IN ('active','trial') THEN true ELSE false END
         ),
         trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
         updated_at = now()
   WHERE user_id = p_user_id;

  -- Top-up monthly credits for elite/assessoria immediately on plan change
  v_monthly := monthly_credits_for_plan(p_plan);
  IF v_monthly > 0 AND p_status IN ('active','trial') THEN
    FOR v_rest IN SELECT id FROM public.restaurants WHERE user_id = p_user_id LOOP
      INSERT INTO public.whatsapp_credits (restaurant_id, balance, total_purchased, last_monthly_recharge_at)
      VALUES (v_rest.id, v_monthly, v_monthly, now())
      ON CONFLICT (restaurant_id) DO UPDATE
        SET balance = whatsapp_credits.balance + v_monthly,
            total_purchased = whatsapp_credits.total_purchased + v_monthly,
            last_monthly_recharge_at = now(),
            updated_at = now();

      INSERT INTO public.ai_credit_transactions (restaurant_id, amount, type, description)
      VALUES (v_rest.id, v_monthly, 'bonus', 'Recarga mensal - plano ' || p_plan)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- Cron RPC: top-up monthly credits for all eligible accounts
CREATE OR REPLACE FUNCTION public.recharge_monthly_whatsapp_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
  v_monthly integer;
BEGIN
  FOR v_rec IN
    SELECT r.id AS restaurant_id, p.subscription_plan
      FROM public.restaurants r
      JOIN public.profiles p ON p.id = r.user_id
     WHERE p.subscription_plan IN ('elite','assessoria')
       AND p.subscription_status IN ('active','trial')
       AND r.subscription_active = true
  LOOP
    v_monthly := monthly_credits_for_plan(v_rec.subscription_plan);
    IF v_monthly <= 0 THEN CONTINUE; END IF;

    -- Skip if recharged within the last 30 days
    IF EXISTS (
      SELECT 1 FROM public.whatsapp_credits wc
      WHERE wc.restaurant_id = v_rec.restaurant_id
        AND wc.last_monthly_recharge_at IS NOT NULL
        AND wc.last_monthly_recharge_at > (now() - interval '30 days')
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.whatsapp_credits (restaurant_id, balance, total_purchased, last_monthly_recharge_at)
    VALUES (v_rec.restaurant_id, v_monthly, v_monthly, now())
    ON CONFLICT (restaurant_id) DO UPDATE
      SET balance = whatsapp_credits.balance + v_monthly,
          total_purchased = whatsapp_credits.total_purchased + v_monthly,
          last_monthly_recharge_at = now(),
          updated_at = now();

    INSERT INTO public.ai_credit_transactions (restaurant_id, amount, type, description)
    VALUES (v_rec.restaurant_id, v_monthly, 'bonus', 'Recarga mensal automática - plano ' || v_rec.subscription_plan);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
