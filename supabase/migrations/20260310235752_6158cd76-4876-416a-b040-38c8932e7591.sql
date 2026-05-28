
-- 1. Update the archive trigger to archive ALL orders (not just delivered)
CREATE OR REPLACE FUNCTION public.archive_orders_on_open()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_open = true AND (OLD.is_open = false OR OLD.is_open IS NULL) THEN
    UPDATE public.orders
    SET is_archived = true
    WHERE restaurant_id = NEW.id
      AND is_archived = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a function for the daily 23:59 archive reset
CREATE OR REPLACE FUNCTION public.archive_all_orders_daily()
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET is_archived = true
  WHERE is_archived = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable pg_cron and schedule the daily job at 23:59 BRT (02:59 UTC)
SELECT cron.schedule(
  'archive-orders-daily',
  '59 2 * * *',
  $$SELECT public.archive_all_orders_daily()$$
);
