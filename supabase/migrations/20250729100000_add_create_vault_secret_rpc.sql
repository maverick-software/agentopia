-- Migration to create the RPC wrapper for creating secrets in the vault.

CREATE OR REPLACE FUNCTION public.create_vault_secret(
    p_secret TEXT,
    p_name TEXT,
    p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function acts as a wrapper to call the actual vault.create_secret function.
    -- It uses positional arguments for compatibility.
    RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;

-- Grant execution rights to the service_role so it can be called from Supabase client libraries.
GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) IS 'A public RPC wrapper for vault.create_secret.'; 