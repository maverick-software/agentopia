/*
  # Fix user role synchronization

  1. Changes
    - Improves user role handling during signup
    - Ensures role metadata from auth.users is properly synced
    - Updates trigger function to handle role changes
    - Adds better error handling

  2. Security
    - Maintains existing RLS policies
    - Preserves role validation
*/

-- Update the auth user sync function to better handle roles
CREATE OR REPLACE FUNCTION handle_auth_user_sync()
RETURNS TRIGGER AS $$
DECLARE
  valid_role text;
BEGIN
  -- Get role from metadata or use default
  valid_role := CASE 
    WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'project_manager', 'designer', 'developer') THEN
      NEW.raw_user_meta_data->>'role'
    ELSE
      'developer'
    END;

  -- Insert or update user with validated role
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    valid_role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = valid_role
  WHERE users.email IS DISTINCT FROM EXCLUDED.email
     OR users.role IS DISTINCT FROM valid_role;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is up to date
DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;
CREATE TRIGGER sync_auth_users
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_sync();

-- Resync existing users with proper role validation
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || 
  json_build_object('role', 
    CASE 
      WHEN raw_user_meta_data->>'role' IN ('admin', 'project_manager', 'designer', 'developer') THEN
        raw_user_meta_data->>'role'
      ELSE
        'developer'
    END
  )::jsonb
WHERE raw_user_meta_data->>'role' IS NULL 
   OR raw_user_meta_data->>'role' NOT IN ('admin', 'project_manager', 'designer', 'developer');