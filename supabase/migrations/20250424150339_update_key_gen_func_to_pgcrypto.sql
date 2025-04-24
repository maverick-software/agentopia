-- Ensure pgcrypto is available (redundant if already checked, but safe)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Update the function to use pgcrypto for key generation
CREATE OR REPLACE FUNCTION public.handle_new_user_key_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_key_bytes bytea;
  generated_key_base64 text;
BEGIN
  -- Generate 32 random bytes using pgcrypto
  generated_key_bytes := public.gen_random_bytes(32);

  -- Encode the bytes as base64 for text storage
  generated_key_base64 := encode(generated_key_bytes, 'base64');

  -- Insert the key into the user_secrets table
  INSERT INTO public.user_secrets (user_id, encryption_key)
  VALUES (NEW.id, generated_key_base64);

  RETURN NEW;
END;
$$;

-- Optional: Re-add comment if desired
COMMENT ON FUNCTION public.handle_new_user_key_generation() IS 'Trigger function to generate a unique encryption key for a new user (using pgcrypto) and store it in user_secrets.';
