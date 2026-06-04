-- Check for restaurants with NULL user_id
-- This migration helps identify and fix restaurants that don't have a user_id set

-- First, let's check which restaurants have NULL user_id
SELECT id, name, slug, user_id, created_at 
FROM restaurants 
WHERE user_id IS NULL;

-- If there are restaurants with NULL user_id, we need to identify which user should own them
-- This is a diagnostic query - run it manually to see the results

-- To fix restaurants with NULL user_id, you would need to:
-- 1. Identify the correct user_id for each restaurant
-- 2. Run an UPDATE statement like:
-- UPDATE restaurants SET user_id = 'correct-user-id' WHERE id = 'restaurant-id';

-- Example fix (replace with actual user_id and restaurant_id):
-- UPDATE restaurants SET user_id = 'auth-user-id-here' WHERE id = 'restaurant-id-here';

-- Also check if there are users without restaurants
SELECT id, email FROM auth.users 
WHERE id NOT IN (SELECT DISTINCT user_id FROM restaurants WHERE user_id IS NOT NULL);
