-- Auto Stock Deduction on Order Confirmation
-- Automatically deduct stock when order status changes to 'confirmed' or 'preparing'

-- Function to handle stock deduction when order is confirmed
CREATE OR REPLACE FUNCTION public.handle_order_stock_deduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_recipe_item RECORD;
  v_product_id UUID;
  v_item_quantity NUMERIC;
  v_ingredient_id UUID;
  v_quantity_needed NUMERIC;
  v_stock_level RECORD;
  v_new_quantity NUMERIC;
BEGIN
  -- Only trigger when status changes to 'confirmed' or 'preparing'
  -- and it wasn't already in one of those states (to avoid double deduction)
  IF (
    (NEW.status IN ('confirmed', 'preparing')) AND
    (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'preparing'))
  ) THEN
    -- Iterate through each item in the order
    FOR v_item IN
      SELECT 
        (item->>'productId')::UUID as product_id,
        (item->>'quantity')::NUMERIC as quantity
      FROM jsonb_array_elements(NEW.items) AS item
      WHERE (item->>'productId') IS NOT NULL
    LOOP
      v_product_id := v_item.product_id;
      v_item_quantity := v_item.quantity;

      -- Get recipe items for this product
      FOR v_recipe_item IN
        SELECT ingredient_id, quantity_used, waste_factor
        FROM public.recipe_items
        WHERE product_id = v_product_id
      LOOP
        v_ingredient_id := v_recipe_item.ingredient_id;
        
        -- Calculate quantity needed: item quantity × recipe quantity × waste_factor
        v_quantity_needed := v_item_quantity * v_recipe_item.quantity_used * COALESCE(v_recipe_item.waste_factor, 1.0);

        -- Get current stock level
        SELECT * INTO v_stock_level
        FROM public.stock_levels
        WHERE restaurant_id = NEW.restaurant_id AND ingredient_id = v_ingredient_id;

        -- If stock level exists, deduct the quantity
        IF FOUND THEN
          v_new_quantity := v_stock_level.current_quantity - v_quantity_needed;
          
          -- Update stock level
          UPDATE public.stock_levels
          SET current_quantity = v_new_quantity,
              updated_at = now()
          WHERE id = v_stock_level.id;

          -- Create stock movement record
          INSERT INTO public.stock_movements (
            restaurant_id,
            ingredient_id,
            type,
            quantity,
            reason,
            order_id,
            created_by
          ) VALUES (
            NEW.restaurant_id,
            v_ingredient_id,
            'saida',
            v_quantity_needed,
            'Baixa automática por pedido #' || COALESCE(NEW.daily_number::TEXT, NEW.order_number),
            NEW.id,
            NULL
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_order_stock_deduction ON public.orders;

CREATE TRIGGER trigger_order_stock_deduction
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_stock_deduction();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_order_stock_deduction() IS 'Automatically deducts stock when order status changes to confirmed or preparing';
COMMENT ON TRIGGER trigger_order_stock_deduction ON public.orders IS 'Triggers stock deduction when order is confirmed';
