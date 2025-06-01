-- Migration: Alter clients table to add owner_auth_user_id and ensure updated_at trigger

-- Add owner_auth_user_id to existing clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS owner_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL; -- or RESTRICT depending on desired business rules for user deletion

-- The handle_updated_at function should have been created by the profiles_table migration.
-- This section ensures the trigger is specifically created for the clients table if it doesn't exist.

-- Ensure the updated_at column exists (if it might not)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- Check if the trigger exists on 'clients' table before creating it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'on_clients_updated' AND tgrelid = 'public.clients'::regclass
    ) THEN
        CREATE TRIGGER on_clients_updated
        BEFORE UPDATE ON public.clients
        FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
    END IF;
END
$$;

-- For completeness, ensure created_at column exists (if it might not)
-- ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now() NOT NULL; 