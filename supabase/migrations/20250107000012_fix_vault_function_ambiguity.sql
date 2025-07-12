-- Fix the ambiguous column reference in create_vault_secret function
CREATE OR REPLACE FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text" DEFAULT NULL::"text", "description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_secret_id UUID;
    key_uuid UUID;
    nonce_value bytea;
BEGIN
    -- Get the key_id from pgsodium (fix ambiguous reference by using table alias)
    SELECT k.id INTO key_uuid FROM pgsodium.valid_key k WHERE k.name = 'default' LIMIT 1;
    
    IF key_uuid IS NULL THEN
        -- Create a default key if it doesn't exist
        key_uuid := pgsodium.create_key();
    END IF;
    
    -- Generate a nonce
    nonce_value := pgsodium.crypto_aead_det_noncegen();

    -- Insert the encrypted secret (use parameter names to avoid ambiguity)
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
        create_vault_secret.name,
        create_vault_secret.description,
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