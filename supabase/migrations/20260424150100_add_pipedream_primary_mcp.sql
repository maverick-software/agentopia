-- Pipedream primary MCP integration support
-- Stores only Agentopia/Pipedream mapping metadata. Pipedream owns third-party
-- OAuth/API credentials and token refresh.

CREATE TABLE IF NOT EXISTS public.user_pipedream_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  app_slug TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_description TEXT,
  app_icon_url TEXT,
  account_id TEXT NOT NULL,
  account_name TEXT,
  external_account_id TEXT,
  healthy BOOLEAN DEFAULT true,
  dead BOOLEAN DEFAULT false,
  authorized_scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  error_message TEXT,
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, account_id)
);

ALTER TABLE public.user_pipedream_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own Pipedream accounts" ON public.user_pipedream_accounts;
CREATE POLICY "Users can manage their own Pipedream accounts"
  ON public.user_pipedream_accounts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_pipedream_accounts_user_app
  ON public.user_pipedream_accounts(user_id, app_slug);

CREATE INDEX IF NOT EXISTS idx_user_pipedream_accounts_account_id
  ON public.user_pipedream_accounts(account_id);

ALTER TABLE public.mcp_tools_cache
  ADD COLUMN IF NOT EXISTS remote_tool_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS app_slug TEXT,
  ADD COLUMN IF NOT EXISTS tool_metadata JSONB DEFAULT '{}'::jsonb;

UPDATE public.mcp_tools_cache
SET remote_tool_name = tool_name
WHERE remote_tool_name IS NULL;

ALTER TABLE public.mcp_tools_cache
  ALTER COLUMN remote_tool_name SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_provider_app
  ON public.mcp_tools_cache(provider_name, app_slug);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_tool_agent
  ON public.mcp_tools_cache(tool_name, connection_id);

DROP POLICY IF EXISTS "System can manage MCP tools cache" ON public.mcp_tools_cache;
DROP POLICY IF EXISTS "Service role can manage MCP tools cache" ON public.mcp_tools_cache;
CREATE POLICY "Service role can manage MCP tools cache"
  ON public.mcp_tools_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP FUNCTION IF EXISTS public.get_agent_mcp_tools(UUID);

CREATE OR REPLACE FUNCTION public.get_agent_mcp_tools(p_agent_id UUID)
RETURNS TABLE (
  connection_id UUID,
  connection_name TEXT,
  connection_type TEXT,
  tool_name TEXT,
  remote_tool_name TEXT,
  provider_name TEXT,
  app_slug TEXT,
  openai_schema JSONB,
  successful_parameters JSONB,
  last_successful_call TIMESTAMPTZ,
  success_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    amc.id AS connection_id,
    amc.connection_name,
    amc.connection_type,
    mtc.tool_name,
    COALESCE(NULLIF(mtc.remote_tool_name, ''), mtc.tool_name) AS remote_tool_name,
    COALESCE(mtc.provider_name, amc.connection_type) AS provider_name,
    mtc.app_slug,
    mtc.openai_schema,
    mtc.successful_parameters,
    mtc.last_successful_call,
    mtc.success_count
  FROM public.agent_mcp_connections amc
  JOIN public.mcp_tools_cache mtc ON amc.id = mtc.connection_id
  WHERE amc.agent_id = p_agent_id
    AND amc.is_active = true
  ORDER BY amc.connection_name, mtc.tool_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pipedream_accounts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_mcp_tools(UUID) TO authenticated, service_role;

COMMENT ON TABLE public.user_pipedream_accounts IS
  'Local metadata for Pipedream Connect accounts. Does not store third-party credentials.';
COMMENT ON COLUMN public.mcp_tools_cache.remote_tool_name IS
  'Original tool name exposed by the remote MCP server. tool_name may be namespaced for local collision avoidance.';
COMMENT ON COLUMN public.mcp_tools_cache.provider_name IS
  'Provider that supplied this MCP tool, e.g. pipedream, zapier, generic.';
COMMENT ON COLUMN public.mcp_tools_cache.app_slug IS
  'Pipedream app slug or equivalent provider app identifier.';
