/*
  # Fix Users RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Add new policies that properly handle auth
    - Allow new user creation during OAuth
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own record" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can update own record" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view own record" ON users;

-- Create new policies
CREATE POLICY "Enable insert for authenticated users" ON public.users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id" ON public.users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable read access for users based on id" ON public.users
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Add policy to allow initial user creation during OAuth
CREATE POLICY "Enable insert during auth" ON public.users
FOR INSERT TO anon
WITH CHECK (auth.jwt() IS NOT NULL);