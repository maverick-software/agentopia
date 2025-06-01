/*
  # Remove role check constraint

  1. Changes
    - Remove the role check constraint from users table
    - Keep NOT NULL constraint and default value
    - Update auth sync function to handle any role value
*/

-- Drop the role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Ensure role column constraints remain
ALTER TABLE users 
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'developer'::text;

-- Update auth sync function to accept any role
CREATE OR REPLACE FUNCTION handle_auth_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user with default role
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'developer'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email
  WHERE users.email IS DISTINCT FROM EXCLUDED.email;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error in handle_auth_user_sync: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;