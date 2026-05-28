-- Add is_archived column to orders table
ALTER TABLE public.orders
ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Create function to archive delivered orders when restaurant opens
CREATE OR REPLACE FUNCTION public.archive_orders_on_open()
RETURNS TRIGGER AS $$
BEGIN
  -- When restaurant changes from closed to open, archive all delivered orders
  IF NEW.is_open = true AND (OLD.is_open = false OR OLD.is_open IS NULL) THEN
    UPDATE public.orders
    SET is_archived = true
    WHERE restaurant_id = NEW.id
      AND status = 'delivered'
      AND is_archived = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run when restaurant is_open changes
CREATE TRIGGER archive_orders_on_restaurant_open
  AFTER UPDATE OF is_open ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_orders_on_open();