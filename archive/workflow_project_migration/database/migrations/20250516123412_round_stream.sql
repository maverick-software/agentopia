/*
  # Fix authentication system

  1. Changes
    - Simplify user role handling
    - Add better error handling for auth triggers
    - Ensure proper role synchronization
    - Add missing indexes
    - Clean up existing data

  2. Security
    - Enable RLS
    - Add proper policies for user access
*/

-- Drop existing role constraints and triggers
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
DROP TRIGGER IF EXISTS ensure_user_role_trigger ON users;
DROP FUNCTION IF EXISTS ensure_user_role();

-- Add NOT NULL constraint and default role
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'developer'::text;

-- Add role check constraint
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'project_manager'::text, 'designer'::text, 'developer'::text]));

-- Create improved auth sync function
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
    -- Log error and continue
    RAISE WARNING 'Error in handle_auth_user_sync: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate auth sync trigger
DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;
CREATE TRIGGER sync_auth_users
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_sync();

-- Add performance indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert during auth" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;
DROP POLICY IF EXISTS "Enable read access for users based on id" ON users;

-- Create new policies
CREATE POLICY "Enable insert during auth"
  ON public.users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read access for users based on id"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Clean up any invalid roles in existing data
UPDATE users
SET role = 'developer'
WHERE role NOT IN ('admin', 'project_manager', 'designer', 'developer');