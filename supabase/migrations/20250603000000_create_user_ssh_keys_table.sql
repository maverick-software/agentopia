BEGIN;

-- Create table for SSH key metadata (vault IDs only, not the actual keys)
CREATE TABLE public.user_ssh_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key_vault_id UUID NOT NULL, -- Reference to Supabase Vault secret
  private_key_vault_id UUID NOT NULL, -- Reference to Supabase Vault secret
  key_name TEXT NOT NULL DEFAULT 'default',
  fingerprint TEXT NOT NULL, -- SSH key fingerprint for identification
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Ensure unique key names per user
  UNIQUE(user_id, key_name)
);

-- Add comments
COMMENT ON TABLE public.user_ssh_keys IS 'Metadata for user SSH keys stored securely in Supabase Vault';
COMMENT ON COLUMN public.user_ssh_keys.public_key_vault_id IS 'UUID reference to public key stored in Supabase Vault';
COMMENT ON COLUMN public.user_ssh_keys.private_key_vault_id IS 'UUID reference to private key stored in Supabase Vault';
COMMENT ON COLUMN public.user_ssh_keys.key_name IS 'User-friendly name for the SSH key pair';
COMMENT ON COLUMN public.user_ssh_keys.fingerprint IS 'SSH key fingerprint for identification and verification';

-- Enable RLS
ALTER TABLE public.user_ssh_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own SSH keys
CREATE POLICY "Users can view own SSH keys" ON public.user_ssh_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SSH keys" ON public.user_ssh_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SSH keys" ON public.user_ssh_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own SSH keys" ON public.user_ssh_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all SSH keys (for backend operations)
CREATE POLICY "Service role can manage all SSH keys" ON public.user_ssh_keys
  FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger
CREATE TRIGGER on_user_ssh_keys_update
  BEFORE UPDATE ON public.user_ssh_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_user_ssh_keys_user_id ON public.user_ssh_keys(user_id);
CREATE INDEX idx_user_ssh_keys_fingerprint ON public.user_ssh_keys(fingerprint);

COMMIT; 