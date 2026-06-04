-- Auto-create restaurant record when a new user signs up
-- This ensures new admin users always have a restaurant record

-- Function to create a default restaurant for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  restaurant_slug TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  -- Generate a unique slug based on email
  restaurant_slug := lower(regexp_replace(user_email, '[^a-zA-Z0-9]', '', 'g'));
  
  -- Insert default restaurant record
  INSERT INTO public.restaurants (
    user_id,
    name,
    slug,
    is_open,
    operation_mode,
    notification_sound,
    default_delivery_time_min,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'Meu Restaurante',
    restaurant_slug,
    false,
    'delivery',
    'medium',
    30,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also handle the case where a user is created via admin role assignment
-- This ensures users added as admins also get a default restaurant
CREATE OR REPLACE FUNCTION public.handle_user_role_assignment()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_exists BOOLEAN;
BEGIN
  -- Check if user already has a restaurant
  SELECT EXISTS(
    SELECT 1 FROM public.restaurants WHERE user_id = NEW.user_id
  ) INTO restaurant_exists;
  
  -- Only create if user doesn't have a restaurant yet
  IF NOT restaurant_exists THEN
    INSERT INTO public.restaurants (
      user_id,
      name,
      slug,
      is_open,
      operation_mode,
      notification_sound,
      default_delivery_time_min,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      'Meu Restaurante',
      'restaurante-' || substr(NEW.user_id::text, 1, 8),
      false,
      'delivery',
      'medium',
      30,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for user_roles table
DROP TRIGGER IF EXISTS on_user_role_created ON public.user_roles;

CREATE TRIGGER on_user_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION public.handle_user_role_assignment();
