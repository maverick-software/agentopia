-- Migration to add Row-Level Security (RLS) policies to user_secrets

-- 1. Enable RLS on the table
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for table owners (IMPORTANT for security)
-- This ensures even the table owner must adhere to RLS policies
ALTER TABLE public.user_secrets FORCE ROW LEVEL SECURITY;

-- 3. Create policies for authenticated users

-- Policy: Allow authenticated users to SELECT their own secret
CREATE POLICY "Allow individual user select access" 
ON public.user_secrets
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Allow authenticated users to UPDATE their own secret
-- (Useful for future key rotation features)
CREATE POLICY "Allow individual user update access"
ON public.user_secrets
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Disallow INSERT (handled by trigger)
-- By default, without an INSERT policy, inserts are denied when RLS is enabled.
-- We can explicitly add a denying policy if desired for clarity, but it's often omitted.
-- CREATE POLICY "Disallow direct inserts" 
-- ON public.user_secrets 
-- FOR INSERT 
-- WITH CHECK (false);

-- Policy: Disallow DELETE (handled by CASCADE from auth.users)
-- By default, without a DELETE policy, deletes are denied.
-- CREATE POLICY "Disallow direct deletes" 
-- ON public.user_secrets 
-- FOR DELETE 
-- USING (false);
