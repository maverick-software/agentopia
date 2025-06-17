-- Migration: Update RLS policies for MCP integration
-- Purpose: Enhanced security policies for agent-MCP connections with performance optimization
-- Date: 2025-01-01
-- Related to: MCP-DTMA Integration Phase 4.2.3

-- ============================================================================
-- 1. ENHANCED AGENT-MCP CONNECTION POLICIES
-- ============================================================================

-- Drop existing policies to recreate with optimizations
DROP POLICY IF EXISTS "Users can view their own agent connections" ON agent_mcp_connections;
DROP POLICY IF EXISTS "Users can create connections for their own agents" ON agent_mcp_connections;
DROP POLICY IF EXISTS "Users can update their own agent connections" ON agent_mcp_connections;

-- Policy: Enhanced user access with performance optimization
CREATE POLICY "Users can view their own agent connections" ON agent_mcp_connections
    FOR SELECT
    USING (
        -- Optimized query using EXISTS for better performance
        EXISTS (
            SELECT 1 FROM agents 
            WHERE id = agent_id 
            AND user_id = auth.uid()
        )
    );

-- Policy: Enhanced insert policy with validation
CREATE POLICY "Users can create connections for their own agents" ON agent_mcp_connections
    FOR INSERT
    WITH CHECK (
        -- Ensure user owns the agent
        EXISTS (
            SELECT 1 FROM agents 
            WHERE id = agent_id 
            AND user_id = auth.uid()
        )
        AND
        -- Ensure MCP server is available for connections
        EXISTS (
            SELECT 1 FROM account_tool_instances 
            WHERE id = mcp_server_instance_id 
            AND mcp_server_type IS NOT NULL
            AND status_on_toolbox = 'running'
        )
    );

-- Policy: Enhanced update policy with state validation
CREATE POLICY "Users can update their own agent connections" ON agent_mcp_connections
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE id = agent_id 
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Prevent users from changing agent_id or server_id
        agent_id = OLD.agent_id
        AND mcp_server_instance_id = OLD.mcp_server_instance_id
        AND
        -- Ensure user still owns the agent
        EXISTS (
            SELECT 1 FROM agents 
            WHERE id = agent_id 
            AND user_id = auth.uid()
        )
    );

-- ============================================================================
-- 2. CROSS-TABLE SECURITY POLICIES
-- ============================================================================

-- Policy: Admin monitoring access across all MCP-related tables
CREATE POLICY "Admins can monitor all MCP activity" ON agent_mcp_connections
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Policy: Service role access for system operations
CREATE POLICY "Service role system access" ON agent_mcp_connections
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Enhanced policy for account_tool_instances to support MCP integration
CREATE POLICY "Users can view MCP servers for connection" ON account_tool_instances
    FOR SELECT
    USING (
        -- Allow users to see running MCP servers for connection discovery
        (mcp_server_type IS NOT NULL AND status_on_toolbox = 'running')
        OR
        -- Allow users to see their own tool instances
        EXISTS (
            SELECT 1 FROM account_tool_environments ate
            WHERE ate.id = account_tool_environment_id
            AND ate.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 3. ENHANCED LOGGING AND AUDIT POLICIES
-- ============================================================================

-- Drop existing logging policies to recreate with optimizations
DROP POLICY IF EXISTS "Users can view their own connection logs" ON agent_mcp_connection_logs;
DROP POLICY IF EXISTS "Users can view relevant status logs" ON mcp_server_status_logs;

-- Enhanced policy for connection logs with better performance
CREATE POLICY "Users can view their own connection logs" ON agent_mcp_connection_logs
    FOR SELECT
    USING (
        -- Direct join approach for better performance
        connection_id IN (
            SELECT amc.id 
            FROM agent_mcp_connections amc
            INNER JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

-- Enhanced policy for status logs with server access validation
CREATE POLICY "Users can view relevant status logs" ON mcp_server_status_logs
    FOR SELECT
    USING (
        -- Users can see status logs for servers their agents connect to
        server_id IN (
            SELECT DISTINCT amc.mcp_server_instance_id 
            FROM agent_mcp_connections amc
            INNER JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id = auth.uid() 
            AND amc.is_active = true
        )
        OR
        -- Users can see status logs for their own deployed servers
        server_id IN (
            SELECT ati.id
            FROM account_tool_instances ati
            INNER JOIN account_tool_environments ate ON ati.account_tool_environment_id = ate.id
            WHERE ate.user_id = auth.uid()
            AND ati.mcp_server_type IS NOT NULL
        )
    );

-- ============================================================================
-- 4. ADMIN DASHBOARD POLICIES
-- ============================================================================

-- Create admin-specific policies for dashboard and monitoring
CREATE POLICY "Admin dashboard access to all agents" ON agents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Admin access to all tool instances for monitoring
CREATE POLICY "Admin monitoring access to tool instances" ON account_tool_instances
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Admin modification access for MCP server management
CREATE POLICY "Admin can manage MCP servers" ON account_tool_instances
    FOR UPDATE
    USING (
        mcp_server_type IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        mcp_server_type IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- 5. PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Create optimized security context function
CREATE OR REPLACE FUNCTION get_user_security_context()
RETURNS TABLE(
    user_id UUID,
    is_admin BOOLEAN,
    owned_agent_ids UUID[],
    accessible_server_ids UUID[]
) AS $$
BEGIN
    RETURN QUERY
    WITH user_context AS (
        SELECT 
            auth.uid() as uid,
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
            ) as is_admin_user
    ),
    user_agents AS (
        SELECT array_agg(id) as agent_ids
        FROM agents 
        WHERE user_id = (SELECT uid FROM user_context)
    ),
    accessible_servers AS (
        SELECT array_agg(DISTINCT server_id) as server_ids
        FROM (
            -- Servers user's agents connect to
            SELECT amc.mcp_server_instance_id as server_id
            FROM agent_mcp_connections amc
            INNER JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id = (SELECT uid FROM user_context)
            AND amc.is_active = true
            
            UNION
            
            -- Servers user owns
            SELECT ati.id as server_id
            FROM account_tool_instances ati
            INNER JOIN account_tool_environments ate ON ati.account_tool_environment_id = ate.id
            WHERE ate.user_id = (SELECT uid FROM user_context)
            AND ati.mcp_server_type IS NOT NULL
        ) servers
    )
    SELECT 
        uc.uid,
        uc.is_admin_user,
        COALESCE(ua.agent_ids, '{}'),
        COALESCE(as_srv.server_ids, '{}')
    FROM user_context uc
    CROSS JOIN user_agents ua
    CROSS JOIN accessible_servers as_srv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. VIEW-LEVEL SECURITY ENHANCEMENTS
-- ============================================================================

-- Enable security barriers on existing views
ALTER VIEW active_agent_mcp_connections SET (security_barrier = true);
ALTER VIEW user_mcp_connection_stats SET (security_barrier = true);
ALTER VIEW recent_connection_activity SET (security_barrier = true);
ALTER VIEW server_health_history SET (security_barrier = true);

-- Create security-aware version of active connections view
CREATE OR REPLACE VIEW active_agent_mcp_connections_secure AS
SELECT 
    amc.id,
    amc.agent_id,
    a.name AS agent_name,
    a.user_id,
    amc.mcp_server_instance_id,
    ati.instance_name_on_toolbox AS server_name,
    ati.status_on_toolbox AS server_status,
    ati.mcp_server_type AS server_type,
    amc.connection_status,
    amc.connection_config,
    amc.connection_test_result,
    amc.last_used,
    amc.usage_stats,
    amc.created_at,
    amc.updated_at
FROM agent_mcp_connections amc
JOIN agents a ON amc.agent_id = a.id
JOIN account_tool_instances ati ON amc.mcp_server_instance_id = ati.id
WHERE amc.is_active = true
AND (
    -- User can see their own connections
    a.user_id = auth.uid()
    OR
    -- Admins can see all connections
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- ============================================================================
-- 7. ARCHIVE AND CLEANUP POLICIES
-- ============================================================================

-- Enable RLS on archive tables
ALTER TABLE agent_mcp_connection_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_server_status_logs_archive ENABLE ROW LEVEL SECURITY;

-- Archive access policies (admin only for performance)
CREATE POLICY "Admin access to connection log archives" ON agent_mcp_connection_logs_archive
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admin access to status log archives" ON mcp_server_status_logs_archive
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Service role access for cleanup operations
CREATE POLICY "Service role archive management connections" ON agent_mcp_connection_logs_archive
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role archive management status" ON mcp_server_status_logs_archive
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 8. POLICY TESTING AND VALIDATION FUNCTIONS
-- ============================================================================

-- Function to test RLS policies
CREATE OR REPLACE FUNCTION test_rls_policies()
RETURNS TABLE(
    test_name TEXT,
    passed BOOLEAN,
    details TEXT
) AS $$
BEGIN
    -- Test 1: User can only see their own connections
    RETURN QUERY
    SELECT 
        'User connection isolation'::TEXT,
        NOT EXISTS (
            SELECT 1 FROM agent_mcp_connections amc
            JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id != auth.uid()
        ),
        'Users should not see connections for other users agents'::TEXT;
    
    -- Test 2: User can see available MCP servers
    RETURN QUERY
    SELECT 
        'MCP server visibility'::TEXT,
        EXISTS (
            SELECT 1 FROM account_tool_instances
            WHERE mcp_server_type IS NOT NULL
            AND status_on_toolbox = 'running'
        ),
        'Users should see available MCP servers'::TEXT;
    
    -- Test 3: User can access their connection logs
    RETURN QUERY
    SELECT 
        'Connection log access'::TEXT,
        NOT EXISTS (
            SELECT 1 FROM agent_mcp_connection_logs acl
            WHERE connection_id NOT IN (
                SELECT id FROM agent_mcp_connections amc
                JOIN agents a ON amc.agent_id = a.id
                WHERE a.user_id = auth.uid()
            )
        ),
        'Users should only see logs for their connections'::TEXT;
    
    -- Test 4: Admin can see all data
    RETURN QUERY
    SELECT 
        'Admin access verification'::TEXT,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
            ) THEN true
            ELSE NULL::BOOLEAN -- Skip test for non-admin users
        END,
        'Admins should have access to all MCP data'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate policy performance
CREATE OR REPLACE FUNCTION validate_policy_performance()
RETURNS TABLE(
    query_type TEXT,
    execution_time_ms NUMERIC,
    row_count INTEGER,
    performance_rating TEXT
) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    duration_ms NUMERIC;
    row_cnt INTEGER;
BEGIN
    -- Test 1: Agent connections query
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_cnt FROM agent_mcp_connections;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY
    SELECT 
        'Agent connections'::TEXT,
        duration_ms,
        row_cnt,
        CASE 
            WHEN duration_ms < 100 THEN 'Excellent'
            WHEN duration_ms < 500 THEN 'Good'
            WHEN duration_ms < 1000 THEN 'Acceptable'
            ELSE 'Needs optimization'
        END;
    
    -- Test 2: Connection logs query
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_cnt FROM agent_mcp_connection_logs;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY
    SELECT 
        'Connection logs'::TEXT,
        duration_ms,
        row_cnt,
        CASE 
            WHEN duration_ms < 100 THEN 'Excellent'
            WHEN duration_ms < 500 THEN 'Good'
            WHEN duration_ms < 1000 THEN 'Acceptable'
            ELSE 'Needs optimization'
        END;
    
    -- Test 3: Status logs query
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_cnt FROM mcp_server_status_logs;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY
    SELECT 
        'Status logs'::TEXT,
        duration_ms,
        row_cnt,
        CASE 
            WHEN duration_ms < 100 THEN 'Excellent'
            WHEN duration_ms < 500 THEN 'Good'
            WHEN duration_ms < 1000 THEN 'Acceptable'
            ELSE 'Needs optimization'
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. GRANT ENHANCED PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users for new views and functions
GRANT SELECT ON active_agent_mcp_connections_secure TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_security_context() TO authenticated;
GRANT EXECUTE ON FUNCTION test_rls_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_policy_performance() TO authenticated;

-- Grant additional permissions to service role
GRANT ALL ON active_agent_mcp_connections_secure TO service_role;
GRANT EXECUTE ON FUNCTION get_user_security_context() TO service_role;
GRANT EXECUTE ON FUNCTION test_rls_policies() TO service_role;
GRANT EXECUTE ON FUNCTION validate_policy_performance() TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add migration completion log
INSERT INTO migrations_log (migration_name, completed_at, description) 
VALUES (
    '20250101000004_update_rls_policies_mcp_integration',
    NOW(),
    'Updated RLS policies for MCP integration with enhanced security, performance optimization, and cross-table access control'
) ON CONFLICT (migration_name) DO NOTHING; 