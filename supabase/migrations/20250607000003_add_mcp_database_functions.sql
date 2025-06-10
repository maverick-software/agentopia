-- Migration: Add Database Functions for MCP and OAuth Management
-- Date: June 7, 2025
-- Project: MCP Server Integration Phase 2.2.1
-- This migration adds helper functions for MCP server and OAuth management

BEGIN;

-- Function: Get MCP servers for agent
CREATE OR REPLACE FUNCTION public.get_agent_mcp_servers(p_agent_id UUID)
RETURNS TABLE (
    instance_id UUID,
    instance_name TEXT,
    mcp_endpoint_path TEXT,
    mcp_transport_type TEXT,
    mcp_capabilities JSONB,
    access_level TEXT,
    is_active BOOLEAN,
    status_on_toolbox public.account_tool_installation_status_enum
) 
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ati.id,
    ati.instance_name_on_toolbox,
    ati.mcp_endpoint_path,
    ati.mcp_transport_type,
    ati.mcp_server_capabilities,
    amsa.access_level,
    amsa.is_active,
    ati.status_on_toolbox
  FROM account_tool_instances ati
  JOIN agent_mcp_server_access amsa ON ati.id = amsa.account_tool_instance_id
  WHERE amsa.agent_id = p_agent_id
    AND amsa.is_active = true
    AND ati.mcp_server_type = 'mcp_server'
    AND ati.status_on_toolbox IN ('active', 'running');
$$;

-- Function: Get user OAuth connections
CREATE OR REPLACE FUNCTION public.get_user_oauth_connections(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    external_username TEXT,
    connection_name TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    token_expires_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    uoc.id,
    op.name,
    op.display_name,
    uoc.external_username,
    uoc.connection_name,
    uoc.scopes_granted,
    uoc.connection_status,
    uoc.token_expires_at
  FROM user_oauth_connections uoc
  JOIN oauth_providers op ON uoc.oauth_provider_id = op.id
  WHERE uoc.user_id = p_user_id
    AND uoc.connection_status IN ('active', 'expired');
$$;

-- Function: Get available MCP servers for user
CREATE OR REPLACE FUNCTION public.get_available_mcp_servers(p_user_id UUID)
RETURNS TABLE (
    instance_id UUID,
    instance_name TEXT,
    mcp_endpoint_path TEXT,
    mcp_transport_type TEXT,
    mcp_capabilities JSONB,
    status_on_toolbox public.account_tool_installation_status_enum,
    environment_id UUID,
    environment_status public.account_tool_environment_status_enum
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ati.id,
    ati.instance_name_on_toolbox,
    ati.mcp_endpoint_path,
    ati.mcp_transport_type,
    ati.mcp_server_capabilities,
    ati.status_on_toolbox,
    ate.id,
    ate.status
  FROM account_tool_instances ati
  JOIN account_tool_environments ate ON ati.account_tool_environment_id = ate.id
  WHERE ate.user_id = p_user_id
    AND ati.mcp_server_type = 'mcp_server'
    AND ati.status_on_toolbox IN ('active', 'running', 'pending_install', 'installing')
  ORDER BY ati.created_at DESC;
$$;

-- Function: Grant agent access to MCP server
CREATE OR REPLACE FUNCTION public.grant_agent_mcp_access(
    p_agent_id UUID,
    p_instance_id UUID,
    p_access_level TEXT DEFAULT 'read_only',
    p_allowed_tools JSONB DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_access_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the user ID for the agent
    SELECT user_id INTO v_user_id 
    FROM agents 
    WHERE id = p_agent_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Verify the user owns the MCP server instance
    IF NOT EXISTS (
        SELECT 1 
        FROM account_tool_instances ati
        JOIN account_tool_environments ate ON ati.account_tool_environment_id = ate.id
        WHERE ati.id = p_instance_id 
        AND ate.user_id = v_user_id
        AND ati.mcp_server_type = 'mcp_server'
    ) THEN
        RAISE EXCEPTION 'MCP server instance not found or access denied';
    END IF;
    
    -- Insert or update the access record
    INSERT INTO agent_mcp_server_access (
        agent_id,
        account_tool_instance_id,
        granted_by_user_id,
        access_level,
        allowed_tools,
        expires_at
    ) VALUES (
        p_agent_id,
        p_instance_id,
        v_user_id,
        p_access_level,
        p_allowed_tools,
        p_expires_at
    )
    ON CONFLICT (agent_id, account_tool_instance_id) 
    DO UPDATE SET
        access_level = EXCLUDED.access_level,
        allowed_tools = EXCLUDED.allowed_tools,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_access_id;
    
    RETURN v_access_id;
END;
$$;

-- Function: Revoke agent access to MCP server
CREATE OR REPLACE FUNCTION public.revoke_agent_mcp_access(
    p_agent_id UUID,
    p_instance_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID for the agent
    SELECT user_id INTO v_user_id 
    FROM agents 
    WHERE id = p_agent_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Update the access record to inactive
    UPDATE agent_mcp_server_access 
    SET is_active = false, updated_at = now()
    WHERE agent_id = p_agent_id 
    AND account_tool_instance_id = p_instance_id
    AND granted_by_user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;

-- Function: Grant agent access to OAuth connection
CREATE OR REPLACE FUNCTION public.grant_agent_oauth_access(
    p_agent_id UUID,
    p_connection_id UUID,
    p_permission_level TEXT DEFAULT 'read_only',
    p_allowed_scopes JSONB DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the user ID for the agent
    SELECT user_id INTO v_user_id 
    FROM agents 
    WHERE id = p_agent_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Verify the user owns the OAuth connection
    IF NOT EXISTS (
        SELECT 1 
        FROM user_oauth_connections 
        WHERE id = p_connection_id 
        AND user_id = v_user_id
        AND connection_status = 'active'
    ) THEN
        RAISE EXCEPTION 'OAuth connection not found or access denied';
    END IF;
    
    -- Insert or update the permission record
    INSERT INTO agent_oauth_permissions (
        agent_id,
        user_oauth_connection_id,
        granted_by_user_id,
        permission_level,
        allowed_scopes,
        expires_at
    ) VALUES (
        p_agent_id,
        p_connection_id,
        v_user_id,
        p_permission_level,
        p_allowed_scopes,
        p_expires_at
    )
    ON CONFLICT (agent_id, user_oauth_connection_id) 
    DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        allowed_scopes = EXCLUDED.allowed_scopes,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;

-- Function: Get agent OAuth permissions
CREATE OR REPLACE FUNCTION public.get_agent_oauth_permissions(p_agent_id UUID)
RETURNS TABLE (
    permission_id UUID,
    connection_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    connection_name TEXT,
    permission_level TEXT,
    allowed_scopes JSONB,
    expires_at TIMESTAMPTZ,
    usage_count INTEGER,
    last_used_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    aop.id,
    uoc.id,
    op.name,
    op.display_name,
    uoc.connection_name,
    aop.permission_level,
    aop.allowed_scopes,
    aop.expires_at,
    aop.usage_count,
    aop.last_used_at
  FROM agent_oauth_permissions aop
  JOIN user_oauth_connections uoc ON aop.user_oauth_connection_id = uoc.id
  JOIN oauth_providers op ON uoc.oauth_provider_id = op.id
  WHERE aop.agent_id = p_agent_id
    AND aop.is_active = true
    AND uoc.connection_status = 'active'
    AND (aop.expires_at IS NULL OR aop.expires_at > now());
$$;

-- Function: Record OAuth usage by agent
CREATE OR REPLACE FUNCTION public.record_agent_oauth_usage(
    p_agent_id UUID,
    p_connection_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE agent_oauth_permissions 
    SET 
        usage_count = usage_count + 1,
        last_used_at = now(),
        updated_at = now()
    WHERE agent_id = p_agent_id 
    AND user_oauth_connection_id = p_connection_id
    AND is_active = true;
    
    RETURN FOUND;
END;
$$;

-- Add comments for functions
COMMENT ON FUNCTION public.get_agent_mcp_servers(UUID) IS 'Returns all MCP servers accessible to an agent';
COMMENT ON FUNCTION public.get_user_oauth_connections(UUID) IS 'Returns all OAuth connections for a user';
COMMENT ON FUNCTION public.get_available_mcp_servers(UUID) IS 'Returns all MCP servers available in user environments';
COMMENT ON FUNCTION public.grant_agent_mcp_access(UUID, UUID, TEXT, JSONB, TIMESTAMPTZ) IS 'Grants agent access to an MCP server';
COMMENT ON FUNCTION public.revoke_agent_mcp_access(UUID, UUID) IS 'Revokes agent access to an MCP server';
COMMENT ON FUNCTION public.grant_agent_oauth_access(UUID, UUID, TEXT, JSONB, TIMESTAMPTZ) IS 'Grants agent access to user OAuth connection';
COMMENT ON FUNCTION public.get_agent_oauth_permissions(UUID) IS 'Returns OAuth permissions for an agent';
COMMENT ON FUNCTION public.record_agent_oauth_usage(UUID, UUID) IS 'Records OAuth connection usage by agent';

COMMIT; 