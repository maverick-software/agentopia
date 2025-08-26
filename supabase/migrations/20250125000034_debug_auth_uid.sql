-- Debug function to test auth.uid() behavior
-- Date: January 25, 2025

BEGIN;

-- Create a simple function to test auth.uid()
CREATE OR REPLACE FUNCTION public.auth_uid_test()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(auth.uid()::text, 'NULL - No authenticated user');
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.auth_uid_test() TO anon, authenticated, service_role;

COMMIT;
