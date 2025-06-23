/*
  # Fix users table RLS policies

  1. Changes
    - Enable RLS on users table
    - Add policies for:
      - Insert: Allow authenticated users to insert their own record
      - Select: Allow authenticated users to view their own record
      - Update: Allow authenticated users to update their own record

  2. Security
    - Ensures users can only access their own records
    - Maintains data isolation between users
*/

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy for inserting own user record
CREATE POLICY "Users can insert own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy for viewing own user record
CREATE POLICY "Users can view own record"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy for updating own user record
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);