-- Create function to get user by email from auth.users
CREATE OR REPLACE FUNCTION public.get_user_by_email(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Query auth.users for the email
  SELECT id, email, created_at INTO v_user_id, v_user_email, v_created_at
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;
  
  RETURN json_build_object(
    'found', true,
    'id', v_user_id,
    'email', v_user_email,
    'created_at', v_created_at
  );
END;
$$;

-- Create function to get all master users with their details
CREATE OR REPLACE FUNCTION public.get_master_users()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Query user_roles joined with profiles and auth.users
  SELECT json_agg(
    json_build_object(
      'id', ur.user_id,
      'email', au.email,
      'full_name', p.full_name,
      'created_at', au.created_at
    )
  ) INTO v_result
  FROM user_roles ur
  INNER JOIN profiles p ON p.id = ur.user_id
  INNER JOIN auth.users au ON au.id = ur.user_id
  WHERE ur.role = 'master';
  
  RETURN json_build_object('users', COALESCE(v_result, '[]'::json));
END;
$$;

-- Create function to get all users with their roles
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Query all users with their roles, profiles, and auth.users data
  SELECT json_agg(
    json_build_object(
      'id', au.id,
      'email', au.email,
      'full_name', p.full_name,
      'role', COALESCE(ur.role, 'none'),
      'created_at', au.created_at,
      'subscription_status', p.subscription_status
    )
  ) INTO v_result
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  LEFT JOIN user_roles ur ON ur.user_id = au.id;
  
  RETURN json_build_object('users', COALESCE(v_result, '[]'::json));
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_master_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_with_roles TO authenticated;
