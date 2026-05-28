-- Fix: Remove the permissive INSERT policy on orders table
-- Orders should ONLY be created through the submit_order() RPC function which uses SECURITY DEFINER
-- This prevents attackers from bypassing validation by directly inserting to the orders table

DROP POLICY IF EXISTS "Public can create orders" ON public.orders;