/*
  # Sync Auth Users with Application Users

  1. Changes
    - Add trigger to sync auth.users with public.users
    - Ensure IDs match between auth.users and public.users
    - Maintain role consistency
    - Add indexes for better performance

  2. Security
    - Maintain existing RLS policies
    - Ensure secure user creation flow
*/

-- Create function to handle user creation/updates
CREATE OR REPLACE FUNCTION handle_auth_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- For new auth users, create corresponding application user
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'developer')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email
  WHERE users.email IS DISTINCT FROM EXCLUDED.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;

-- Create trigger to sync auth users
CREATE TRIGGER sync_auth_users
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_sync();

-- Add index on email for better performance
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- Sync existing auth users
INSERT INTO public.users (id, email, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'role', 'developer') as role
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email
WHERE users.email IS DISTINCT FROM EXCLUDED.email;