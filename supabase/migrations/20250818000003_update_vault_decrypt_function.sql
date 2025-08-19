-- Update vault_decrypt function to properly use vault views
-- Fixes pgsodium_crypto_aead_det_decrypt_by_id error

BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS public.vault_decrypt(TEXT);

-- Create the updated vault_decrypt function
CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
BEGIN
    -- Only allow service role to decrypt vault secrets
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to decrypt vault secrets';
    END IF;

    -- Try to convert to UUID if it looks like one
    BEGIN
        uuid_id := vault_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        uuid_id := NULL;
    END;

    IF uuid_id IS NOT NULL THEN
        -- Get the decrypted secret from vault using ID
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE id = uuid_id
        LIMIT 1;
    END IF;

    -- If not found by ID or not a UUID, try by name
    IF decrypted_value IS NULL THEN
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE name = vault_id
        LIMIT 1;
    END IF;

    RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
REVOKE ALL ON FUNCTION public.vault_decrypt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.vault_decrypt(TEXT) IS 'Decrypts vault secrets for edge functions - requires service role (updated to use vault views)';

COMMIT;
