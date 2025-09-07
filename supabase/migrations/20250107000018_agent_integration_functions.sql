-- Migration: Agent Integration Assignment Functions
-- This adds RPC functions to manage agent permissions for OAuth connections

-- Function to get all integration permissions for an agent
CREATE OR REPLACE FUNCTION public.get_agent_integration_permissions(p_agent_id UUID)
RETURNS TABLE (
    permission_id UUID,
    agent_id UUID,
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    provider_name TEXT,
    provider_display_name TEXT,
    allowed_scopes JSONB,
    is_active BOOLEAN,
    permission_level TEXT,
    granted_at TIMESTAMPTZ,
    granted_by_user_id UUID
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        aop.id AS permission_id,
        aop.agent_id,
        uoc.id AS connection_id,
        uoc.connection_name,
        uoc.external_username,
        op.name AS provider_name,
        op.display_name AS provider_display_name,
        aop.allowed_scopes,
        aop.is_active,
        aop.permission_level,
        aop.granted_at,
        aop.granted_by_user_id
    FROM agent_oauth_permissions aop
    INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = auth.uid()
    AND aop.is_active = true
    ORDER BY aop.granted_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_agent_integration_permissions(UUID) TO anon, authenticated;

-- Function to grant integration permission to an agent
CREATE OR REPLACE FUNCTION public.grant_agent_integration_permission(
    p_agent_id UUID,
    p_connection_id UUID,
    p_allowed_scopes JSONB,
    p_permission_level TEXT DEFAULT 'custom'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the connection belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM user_oauth_connections 
        WHERE id = p_connection_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Connection not found or access denied';
    END IF;
    
    -- Verify the agent belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Insert or update the permission
    INSERT INTO agent_oauth_permissions (
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        is_active,
        granted_by_user_id
    ) VALUES (
        p_agent_id,
        p_connection_id,
        p_allowed_scopes,
        p_permission_level,
        true,
        v_user_id
    )
    ON CONFLICT (agent_id, user_oauth_connection_id) 
    DO UPDATE SET
        allowed_scopes = EXCLUDED.allowed_scopes,
        permission_level = EXCLUDED.permission_level,
        is_active = true,
        granted_by_user_id = EXCLUDED.granted_by_user_id,
        updated_at = now()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT) TO anon, authenticated;

-- Function to revoke integration permission from an agent
CREATE OR REPLACE FUNCTION public.revoke_agent_integration_permission(p_permission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the permission belongs to the user's agent
    IF NOT EXISTS (
        SELECT 1 
        FROM agent_oauth_permissions aop
        INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
        WHERE aop.id = p_permission_id 
        AND uoc.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Permission not found or access denied';
    END IF;
    
    -- Update the permission to revoke it
    UPDATE agent_oauth_permissions
    SET 
        is_active = false,
        updated_at = now()
    WHERE id = p_permission_id;
    
    RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.revoke_agent_integration_permission(UUID) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_agent_integration_permissions(UUID) IS 'Get all integration permissions for an agent';
COMMENT ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT) IS 'Grant integration permission to an agent';
COMMENT ON FUNCTION public.revoke_agent_integration_permission(UUID) IS 'Revoke integration permission from an agent'; 