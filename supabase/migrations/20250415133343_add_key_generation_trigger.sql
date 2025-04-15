-- Migration to automatically generate and store encryption key on user signup

-- Ensure pgsodium is available (usually enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;

-- Create the function to generate and insert the key
CREATE OR REPLACE FUNCTION public.handle_new_user_key_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Important: Allows function to insert into public.user_secrets
AS $$
DECLARE
  generated_key_bytes bytea;
  generated_key_base64 text;
BEGIN
  -- Generate 32 random bytes for AES-256 key
  generated_key_bytes := pgsodium.crypto_aead_aes256gcm_keygen(); 
  
  -- Encode the bytes as base64 for text storage
  generated_key_base64 := encode(generated_key_bytes, 'base64');
  
  -- Insert the key into the user_secrets table
  INSERT INTO public.user_secrets (user_id, encryption_key)
  VALUES (NEW.id, generated_key_base64);
  
  RETURN NEW;
END;
$$;

-- Create the trigger on the auth.users table
CREATE TRIGGER on_auth_user_created_generate_key
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_key_generation();

-- Add comments
COMMENT ON FUNCTION public.handle_new_user_key_generation() IS 'Trigger function to generate a unique encryption key for a new user and store it in user_secrets.';
COMMENT ON TRIGGER on_auth_user_created_generate_key ON auth.users IS 'Fires after a new user is created to generate their unique encryption key.';
