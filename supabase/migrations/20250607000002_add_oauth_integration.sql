-- Migration: Add OAuth Integration for MCP Servers
-- Date: June 7, 2025
-- Project: MCP Server Integration Phase 2.2.1
-- This migration adds OAuth provider configuration and user credential management

BEGIN;

-- OAuth providers table - Central registry of OAuth providers
CREATE TABLE IF NOT EXISTS public.oauth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    authorization_endpoint TEXT NOT NULL,
    token_endpoint TEXT NOT NULL,
    revoke_endpoint TEXT NULL,
    discovery_endpoint TEXT NULL,
    scopes_supported JSONB NOT NULL DEFAULT '[]',
    pkce_required BOOLEAN NOT NULL DEFAULT true,
    client_credentials_location TEXT NOT NULL DEFAULT 'header',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    configuration_metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User OAuth connections table - User-specific OAuth connections
CREATE TABLE IF NOT EXISTS public.user_oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    oauth_provider_id UUID NOT NULL REFERENCES public.oauth_providers(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL,
    external_username TEXT NULL,
    scopes_granted JSONB NOT NULL DEFAULT '[]',
    connection_name TEXT NULL,
    vault_access_token_id UUID NULL,
    vault_refresh_token_id UUID NULL,
    token_expires_at TIMESTAMPTZ NULL,
    last_token_refresh TIMESTAMPTZ NULL,
    connection_status TEXT NOT NULL DEFAULT 'active' CHECK (connection_status IN ('active', 'expired', 'revoked', 'error')),
    connection_metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_user_provider_external UNIQUE (user_id, oauth_provider_id, external_user_id)
);

-- Agent OAuth permissions table - Agent access to user OAuth connections
CREATE TABLE IF NOT EXISTS public.agent_oauth_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    user_oauth_connection_id UUID NOT NULL REFERENCES public.user_oauth_connections(id) ON DELETE CASCADE,
    granted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'read_only' CHECK (permission_level IN ('read_only', 'full_access', 'custom')),
    allowed_scopes JSONB NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_agent_oauth_connection UNIQUE (agent_id, user_oauth_connection_id)
);

-- Add comments for new tables
COMMENT ON TABLE public.oauth_providers IS 'Central registry of OAuth providers (GitHub, Google, Microsoft, etc.)';
COMMENT ON TABLE public.user_oauth_connections IS 'User-specific OAuth provider connections with credential storage';
COMMENT ON TABLE public.agent_oauth_permissions IS 'Agent permissions to access user OAuth connections';

-- Enable RLS on all new tables
ALTER TABLE public.oauth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_oauth_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oauth_providers (public read access for enabled providers)
CREATE POLICY "Anyone can view enabled OAuth providers" ON public.oauth_providers
    FOR SELECT USING (is_enabled = true);

-- RLS Policies for user_oauth_connections (users can only access their own connections)
CREATE POLICY "Users can manage their own OAuth connections" ON public.user_oauth_connections
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies for agent_oauth_permissions (users can manage their own agents' permissions)
CREATE POLICY "Users can manage their agents' OAuth permissions" ON public.agent_oauth_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE agents.id = agent_oauth_permissions.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Create indexes for OAuth connection queries
CREATE INDEX IF NOT EXISTS idx_user_oauth_connections_user_id 
ON public.user_oauth_connections(user_id) WHERE connection_status IN ('active', 'expired');

CREATE INDEX IF NOT EXISTS idx_agent_oauth_permissions_agent_id 
ON public.agent_oauth_permissions(agent_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_oauth_providers_enabled 
ON public.oauth_providers(name) WHERE is_enabled = true;

-- Create composite index for OAuth connection lookups
CREATE INDEX IF NOT EXISTS idx_user_oauth_provider_lookup 
ON public.user_oauth_connections(user_id, oauth_provider_id, connection_status);

-- Add constraint to ensure OAuth connections have valid token data
ALTER TABLE public.user_oauth_connections 
ADD CONSTRAINT chk_oauth_token_consistency 
CHECK (
    (connection_status = 'active' AND vault_access_token_id IS NOT NULL) OR
    (connection_status != 'active')
);

-- Insert default OAuth providers
INSERT INTO public.oauth_providers (name, display_name, authorization_endpoint, token_endpoint, scopes_supported, is_enabled, configuration_metadata) VALUES
('github', 'GitHub', 'https://github.com/login/oauth/authorize', 'https://github.com/login/oauth/access_token', 
 '["user", "repo", "admin:org", "admin:public_key", "admin:repo_hook", "admin:org_hook", "gist", "notifications", "user:email", "user:follow", "public_repo", "repo_deployment", "repo:status", "delete_repo", "read:repo_hook", "write:repo_hook", "admin:repo_hook", "read:org", "write:org", "admin:org", "read:public_key", "write:public_key", "admin:public_key", "read:gpg_key", "write:gpg_key", "admin:gpg_key"]'::jsonb, 
 true, '{"client_id_env": "GITHUB_CLIENT_ID", "client_secret_env": "GITHUB_CLIENT_SECRET"}'::jsonb),

('google', 'Google', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', 
 '["openid", "email", "profile", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/youtube.readonly"]'::jsonb, 
 true, '{"client_id_env": "GOOGLE_CLIENT_ID", "client_secret_env": "GOOGLE_CLIENT_SECRET"}'::jsonb),

('microsoft', 'Microsoft', 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', 'https://login.microsoftonline.com/common/oauth2/v2.0/token', 
 '["openid", "profile", "email", "User.Read", "Files.Read", "Mail.Read", "Calendars.Read", "Tasks.Read"]'::jsonb, 
 true, '{"client_id_env": "MICROSOFT_CLIENT_ID", "client_secret_env": "MICROSOFT_CLIENT_SECRET"}'::jsonb),

('slack', 'Slack', 'https://slack.com/oauth/v2/authorize', 'https://slack.com/api/oauth.v2.access', 
 '["channels:read", "chat:write", "files:read", "users:read", "users:read.email", "team:read", "im:read", "mpim:read", "groups:read"]'::jsonb, 
 true, '{"client_id_env": "SLACK_CLIENT_ID", "client_secret_env": "SLACK_CLIENT_SECRET"}'::jsonb)

ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    authorization_endpoint = EXCLUDED.authorization_endpoint,
    token_endpoint = EXCLUDED.token_endpoint,
    scopes_supported = EXCLUDED.scopes_supported,
    is_enabled = EXCLUDED.is_enabled,
    configuration_metadata = EXCLUDED.configuration_metadata,
    updated_at = now();

COMMIT; 