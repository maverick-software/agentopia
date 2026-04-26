-- OpenAI Codex OAuth provider and per-user bridge credentials.
-- Tokens live in Supabase Vault; relational tables store only metadata and Vault IDs.

BEGIN;

INSERT INTO public.service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  discovery_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  configuration_metadata,
  is_enabled
)
VALUES (
  'openai-codex',
  'OpenAI Codex',
  'https://auth.openai.com/oauth/authorize',
  'https://auth.openai.com/oauth/token',
  'https://auth.openai.com/oauth/revoke',
  NULL,
  '["openid", "profile", "email", "offline_access"]'::jsonb,
  true,
  'body',
  jsonb_build_object(
    'auth_mode', 'chatgpt',
    'provider', 'openai-codex',
    'oauth_flow', 'pkce',
    'oauth_client_id', 'app_EMoamEEZ73f0CkXaXp7hrann',
    'default_redirect_uri', 'http://127.0.0.1:1455/auth/callback',
    'token_endpoint_auth_method', 'none',
    'default_model', 'gpt-5.1-codex',
    'integration_description', 'Use your ChatGPT plan with the Codex CLI bridge.',
    'icon_name', 'Bot',
    'is_popular', true,
    'display_order', 35,
    'agent_classification', 'tool',
    'ui_category', 'AI Tools',
    'ui_description', 'Connect ChatGPT-managed Codex OAuth for agentic coding tasks.',
    'ui_icon', 'Bot'
  ),
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  authorization_endpoint = EXCLUDED.authorization_endpoint,
  token_endpoint = EXCLUDED.token_endpoint,
  revoke_endpoint = EXCLUDED.revoke_endpoint,
  scopes_supported = EXCLUDED.scopes_supported,
  pkce_required = EXCLUDED.pkce_required,
  client_credentials_location = EXCLUDED.client_credentials_location,
  configuration_metadata = COALESCE(public.service_providers.configuration_metadata, '{}'::jsonb) || EXCLUDED.configuration_metadata,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.codex_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_codex_oauth_states_user_created
  ON public.codex_oauth_states(user_id, created_at DESC);

ALTER TABLE public.codex_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Codex OAuth states" ON public.codex_oauth_states;
CREATE POLICY "Users can view own Codex OAuth states"
  ON public.codex_oauth_states
  FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.codex_oauth_states TO authenticated;
GRANT ALL ON public.codex_oauth_states TO service_role;

CREATE TABLE IF NOT EXISTS public.codex_oauth_refresh_locks (
  credential_id uuid PRIMARY KEY REFERENCES public.user_integration_credentials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_until timestamptz NOT NULL,
  locked_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codex_oauth_refresh_locks_user
  ON public.codex_oauth_refresh_locks(user_id, locked_until);

ALTER TABLE public.codex_oauth_refresh_locks ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.codex_oauth_refresh_locks TO service_role;

ALTER TABLE public.user_integration_credentials
  ADD COLUMN IF NOT EXISTS vault_id_token_id uuid;

ALTER TABLE public.codex_bridge_jobs
  ADD COLUMN IF NOT EXISTS credential_id uuid REFERENCES public.user_integration_credentials(id) ON DELETE SET NULL;

ALTER TABLE public.codex_bridge_jobs
  ADD COLUMN IF NOT EXISTS auth_profile_id text;

CREATE INDEX IF NOT EXISTS idx_codex_bridge_jobs_user_credential_status
  ON public.codex_bridge_jobs(user_id, credential_id, status);

COMMENT ON TABLE public.codex_bridge_jobs IS
  'Async Codex CLI bridge jobs. Per-user ChatGPT Codex OAuth tokens are stored only in Vault and materialized into temporary CODEX_HOME directories on the trusted runner.';

COMMIT;
