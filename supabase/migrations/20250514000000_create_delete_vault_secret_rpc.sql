BEGIN;

-- Function to delete a secret from Supabase Vault by its ID.
CREATE OR REPLACE FUNCTION public.delete_vault_secret(
    secret_id UUID
)
RETURNS BOOLEAN  -- Returns true on success, false if not found (or raises an error)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Ensure supabase_vault.secrets table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'supabase_vault' AND table_name = 'secrets'
    ) THEN
        RAISE EXCEPTION 'Supabase Vault (supabase_vault.secrets table) not found. Ensure Vault is enabled and initialized.';
    END IF;

    DELETE FROM supabase_vault.secrets
    WHERE id = secret_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count = 0 THEN
        -- Optionally, raise a warning or return false if the secret was not found
        RAISE WARNING 'Vault secret with ID % not found for deletion.', secret_id;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in delete_vault_secret: % - %', SQLSTATE, SQLERRM;
        RAISE; -- Re-raise the original error to ensure transaction integrity
END;
$$;

-- Grant execute permission to roles that need to call this function.
-- For backend services using service_role key:
GRANT EXECUTE ON FUNCTION public.delete_vault_secret(UUID) TO service_role;
-- For authenticated users, if they are meant to call this directly (ensure RLS and appropriate checks):
-- GRANT EXECUTE ON FUNCTION public.delete_vault_secret(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_vault_secret(UUID) IS 
'Deletes a secret from Supabase Vault by its UUID. Returns true if deletion was successful, false if not found.';

COMMIT; 