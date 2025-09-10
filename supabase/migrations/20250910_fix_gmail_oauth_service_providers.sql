-- Fix Gmail OAuth functions to use service_providers instead of oauth_providers
-- This migration ensures all Gmail-related database functions use the correct table references

-- Update validate_agent_gmail_permissions function to use service_providers
CREATE OR REPLACE FUNCTION validate_agent_gmail_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_required_scopes TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_scope TEXT;
BEGIN
    -- Get allowed scopes for agent using correct table names
    SELECT aip.allowed_scopes INTO v_allowed_scopes
    FROM agent_integration_permissions aip
    INNER JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    INNER JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE aip.agent_id = p_agent_id
      AND uic.user_id = p_user_id
      AND sp.name = 'gmail'
      AND aip.is_active = true
      AND uic.connection_status = 'active'
    LIMIT 1;

    -- If no permissions found, return false
    IF v_allowed_scopes IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if all required scopes are granted
    FOR i IN 1..array_length(p_required_scopes, 1) LOOP
        v_scope := p_required_scopes[i];
        
        -- Check if scope exists in allowed_scopes array
        IF NOT (v_allowed_scopes ? v_scope) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_gmail_connection function to use service_providers
CREATE OR REPLACE FUNCTION get_user_gmail_connection(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    connection_status TEXT,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uic.id as connection_id,
        uic.connection_name,
        uic.external_username,
        uic.connection_status,
        uic.connection_metadata as configuration
    FROM user_integration_credentials uic
    INNER JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = p_user_id
      AND sp.name = 'gmail'
      AND uic.connection_status = 'active'
    ORDER BY uic.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_agent_gmail_permissions(UUID, UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_gmail_connection(UUID) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION validate_agent_gmail_permissions(UUID, UUID, TEXT[]) IS 'Validate agent Gmail permissions - Updated to use service_providers table';
COMMENT ON FUNCTION get_user_gmail_connection(UUID) IS 'Get user Gmail connection - Updated to use service_providers table';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ GMAIL OAUTH FUNCTIONS UPDATED TO USE SERVICE_PROVIDERS';
    RAISE NOTICE '📊 Functions updated: validate_agent_gmail_permissions, get_user_gmail_connection';
    RAISE NOTICE '🔄 Table reference changed: oauth_providers -> service_providers';
END $$;
