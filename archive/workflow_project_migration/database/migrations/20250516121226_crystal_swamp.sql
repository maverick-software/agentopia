/*
  # Add email authentication support
  
  1. Changes
    - Add email/password authentication policies
    - Enable automatic sign-in after registration
    
  2. Security
    - Enable RLS on users table
    - Add policies for email auth
*/

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert during auth" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;
DROP POLICY IF EXISTS "Enable read access for users based on id" ON users;

-- Create new policies
CREATE POLICY "Enable insert during auth" ON public.users
FOR INSERT TO anon
WITH CHECK (true);

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