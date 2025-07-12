-- Ensure vault schema exists
CREATE SCHEMA IF NOT EXISTS vault;

-- Grant permissions on vault schema
GRANT USAGE ON SCHEMA vault TO postgres, anon, authenticated, service_role;

-- Create the secrets table in vault schema if it doesn't exist
CREATE TABLE IF NOT EXISTS vault.secrets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    description text,
    secret text NOT NULL,
    key_id uuid,
    nonce bytea,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT secrets_name_unique UNIQUE (name)
);

-- Create decrypted_secrets view
CREATE OR REPLACE VIEW vault.decrypted_secrets AS
SELECT
    id,
    name,
    description,
    secret,
    CASE 
        WHEN secret IS NOT NULL THEN
            convert_from(
                pgsodium.crypto_aead_det_decrypt(
                    decode(secret, 'base64'),
                    convert_to(id::text, 'utf8'),
                    key_id,
                    nonce
                ),
                'utf8'
            )
        ELSE NULL
    END AS decrypted_secret,
    key_id,
    nonce,
    created_at,
    updated_at
FROM vault.secrets;

-- Update the create_vault_secret function to use vault schema instead of supabase_vault
CREATE OR REPLACE FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text" DEFAULT NULL::"text", "description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_secret_id UUID;
    key_uuid UUID;
    nonce_value bytea;
BEGIN
    -- Get the key_id from pgsodium
    SELECT id INTO key_uuid FROM pgsodium.valid_key WHERE name = 'default' LIMIT 1;
    
    IF key_uuid IS NULL THEN
        -- Create a default key if it doesn't exist
        key_uuid := pgsodium.create_key();
    END IF;
    
    -- Generate a nonce
    nonce_value := pgsodium.crypto_aead_det_noncegen();

    -- Insert the encrypted secret
    INSERT INTO vault.secrets (secret, name, description, key_id, nonce)
    VALUES (
        encode(
            pgsodium.crypto_aead_det_encrypt(
                convert_to(secret_value, 'utf8'),
                convert_to(gen_random_uuid()::text, 'utf8'),
                key_uuid,
                nonce_value
            ),
            'base64'
        ),
        name,
        description,
        key_uuid,
        nonce_value
    )
    RETURNING id INTO new_secret_id;

    RETURN new_secret_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in create_vault_secret: % - %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;

-- Grant necessary permissions
GRANT ALL ON vault.secrets TO postgres, service_role;
GRANT SELECT ON vault.decrypted_secrets TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.create_vault_secret TO service_role; 