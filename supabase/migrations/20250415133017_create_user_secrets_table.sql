-- Migration to create the user_secrets table for per-user encryption keys

CREATE TABLE public.user_secrets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encryption_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments describing the table and columns
COMMENT ON TABLE public.user_secrets IS 'Stores per-user encryption keys for sensitive data like bot tokens.';
COMMENT ON COLUMN public.user_secrets.user_id IS 'Foreign key referencing the user in auth.users.';
COMMENT ON COLUMN public.user_secrets.encryption_key IS 'Base64 encoded 32-byte encryption key specific to the user.';

-- Optional: Trigger function to automatically update updated_at timestamp
-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the user_secrets table
CREATE TRIGGER on_user_secrets_update
  BEFORE UPDATE ON public.user_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
