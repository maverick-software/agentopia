-- Migration to unify web search with OAuth system
-- This allows web search API keys to be treated the same as OAuth tokens

-- Add web search providers to oauth_providers table
INSERT INTO oauth_providers (
  name,
  display_name,
  client_id,
  auth_url,
  token_url,
  available_scopes,
  icon_url,
  created_at,
  updated_at
) VALUES 
(
  'serper_api',
  'Serper API',
  'serper_api', -- Not a real OAuth client, just identifier
  'https://serper.dev', -- Not used for API key auth
  'https://serper.dev', -- Not used for API key auth
  '["web_search", "news_search", "scrape_and_summarize"]'::jsonb,
  null,
  NOW(),
  NOW()
),
(
  'serpapi',
  'SerpAPI',
  'serpapi', -- Not a real OAuth client, just identifier
  'https://serpapi.com', -- Not used for API key auth
  'https://serpapi.com', -- Not used for API key auth
  '["web_search", "news_search", "scrape_and_summarize"]'::jsonb,
  null,
  NOW(),
  NOW()
),
(
  'brave_search',
  'Brave Search API',
  'brave_search', -- Not a real OAuth client, just identifier
  'https://api.search.brave.com', -- Not used for API key auth
  'https://api.search.brave.com', -- Not used for API key auth
  '["web_search", "news_search", "scrape_and_summarize"]'::jsonb,
  null,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  available_scopes = EXCLUDED.available_scopes,
  updated_at = NOW();

-- Comment explaining the approach
COMMENT ON TABLE oauth_providers IS 'Unified provider table supporting both OAuth providers (like Gmail) and API key providers (like web search APIs). API key providers use this table for consistency but store keys differently.';

-- Add indices for better performance
CREATE INDEX IF NOT EXISTS idx_oauth_providers_name ON oauth_providers(name);
CREATE INDEX IF NOT EXISTS idx_user_oauth_connections_provider_user ON user_oauth_connections(oauth_provider_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_oauth_permissions_agent_connection ON agent_oauth_permissions(agent_id, user_oauth_connection_id); 