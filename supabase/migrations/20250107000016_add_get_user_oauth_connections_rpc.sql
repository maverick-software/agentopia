-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_user_oauth_connections(UUID);

-- Create RPC function to get all user OAuth connections
CREATE OR REPLACE FUNCTION public.get_user_oauth_connections(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    connection_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    external_username TEXT,
    connection_name TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        uoc.id AS connection_id,
        op.name AS provider_name,
        op.display_name AS provider_display_name,
        uoc.external_username,
        uoc.connection_name,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.token_expires_at,
        uoc.created_at,
        uoc.updated_at
    FROM user_oauth_connections uoc
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE uoc.user_id = COALESCE(p_user_id, auth.uid())
    ORDER BY uoc.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_oauth_connections(UUID) TO anon, authenticated;

-- Add comment to help PostgREST discover the function
COMMENT ON FUNCTION public.get_user_oauth_connections(UUID) IS 'Get all OAuth connections for a user'; 