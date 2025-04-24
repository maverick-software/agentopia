-- Update the function to explicitly set the search_path
CREATE OR REPLACE FUNCTION public.handle_new_user_key_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Explicitly set search path
AS $$
DECLARE
  generated_key_bytes bytea;
  generated_key_base64 text;
BEGIN
  -- Generate 32 random bytes using pgcrypto
  -- No need for public. prefix now, but it doesn't hurt
  generated_key_bytes := gen_random_bytes(32);

  -- Encode the bytes as base64 for text storage
  generated_key_base64 := encode(generated_key_bytes, 'base64');

  -- Insert the key into the user_secrets table
  INSERT INTO public.user_secrets (user_id, encryption_key)
  VALUES (NEW.id, generated_key_base64);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_key_generation() IS 'Trigger function to generate a unique encryption key (using pgcrypto with explicit search_path) and store it.';
