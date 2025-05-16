BEGIN;

-- Function to create a secret in Supabase Vault and return its ID.
CREATE OR REPLACE FUNCTION public.create_vault_secret(
    secret_value TEXT,
    name TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    new_secret_id UUID;
BEGIN
    -- Ensure supabase_vault.secrets table exists (basic check)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'supabase_vault' AND table_name = 'secrets'
    ) THEN
        RAISE EXCEPTION 'Supabase Vault (supabase_vault.secrets table) not found. Ensure Vault is enabled and initialized.';
    END IF;

    INSERT INTO supabase_vault.secrets (secret, name, description)
    VALUES (secret_value, name, description)
    RETURNING id INTO new_secret_id;

    RETURN new_secret_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error for debugging, then re-raise to ensure transaction rollback if applicable
        RAISE WARNING 'Error in create_vault_secret: % - %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;

-- Grant execute permission to roles that need to call this function.
-- For backend services using service_role key:
GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;
-- For authenticated users, if they are meant to call this directly (ensure RLS and appropriate checks):
GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) IS 
'Creates a new secret in Supabase Vault and returns its UUID. Inputs: secret_value, optional name, optional description.';

COMMIT; 