
-- Add favorite_product column to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS favorite_product text;

-- Backfill favorite_product for existing customers
WITH item_counts AS (
  SELECT 
    c.id as customer_id,
    (item->>'name') as product_name,
    SUM(COALESCE((item->>'quantity')::int, 1)) as total_qty
  FROM customers c
  JOIN orders o ON o.restaurant_id = c.restaurant_id 
    AND REGEXP_REPLACE(o.customer_phone, '[^0-9]', '', 'g') = c.phone
  CROSS JOIN jsonb_array_elements(o.items) as item
  GROUP BY c.id, item->>'name'
),
ranked AS (
  SELECT customer_id, product_name,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY total_qty DESC) as rn
  FROM item_counts
)
UPDATE customers 
SET favorite_product = ranked.product_name
FROM ranked
WHERE customers.id = ranked.customer_id AND ranked.rn = 1;

-- Update the trigger function to also compute favorite_product
CREATE OR REPLACE FUNCTION public.update_customer_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clean_phone text;
  v_fav_product text;
BEGIN
  v_clean_phone := REGEXP_REPLACE(NEW.customer_phone, '[^0-9]', '', 'g');
  
  -- Upsert customer with order stats
  INSERT INTO customers (restaurant_id, name, phone, total_orders, total_spent, last_order_at)
  VALUES (NEW.restaurant_id, NEW.customer_name, v_clean_phone, 1, NEW.total, NEW.created_at)
  ON CONFLICT (restaurant_id, phone)
  DO UPDATE SET
    name = EXCLUDED.name,
    total_orders = customers.total_orders + 1,
    total_spent = customers.total_spent + EXCLUDED.total_spent,
    last_order_at = GREATEST(customers.last_order_at, EXCLUDED.last_order_at),
    updated_at = now();
  
  -- Compute favorite product across all orders for this customer
  SELECT product_name INTO v_fav_product
  FROM (
    SELECT 
      (item->>'name') as product_name,
      SUM(COALESCE((item->>'quantity')::int, 1)) as total_qty
    FROM orders o
    CROSS JOIN jsonb_array_elements(o.items) as item
    WHERE o.restaurant_id = NEW.restaurant_id
      AND REGEXP_REPLACE(o.customer_phone, '[^0-9]', '', 'g') = v_clean_phone
    GROUP BY item->>'name'
    ORDER BY total_qty DESC
    LIMIT 1
  ) sub;
  
  IF v_fav_product IS NOT NULL THEN
    UPDATE customers 
    SET favorite_product = v_fav_product
    WHERE restaurant_id = NEW.restaurant_id AND phone = v_clean_phone;
  END IF;
  
  RETURN NEW;
END;
$function$;
