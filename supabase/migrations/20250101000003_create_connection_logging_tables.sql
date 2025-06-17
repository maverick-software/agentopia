-- Migration: Create connection logging tables
-- Purpose: Audit trail and debugging support for MCP connections and status changes
-- Date: 2025-01-01
-- Related to: MCP-DTMA Integration Phase 4.2.2

-- ============================================================================
-- 1. CREATE AGENT MCP CONNECTION LOGS TABLE
-- ============================================================================

-- Agent MCP Connection Logs Table
-- Stores audit trail and events for agent-MCP connections
CREATE TABLE agent_mcp_connection_logs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to connection
    connection_id UUID NOT NULL REFERENCES agent_mcp_connections(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'connected', 'disconnected', 'error', 'testing',
        'status_change', 'activated', 'deactivated',
        'config_updated', 'usage_recorded'
    )),
    event_details TEXT,
    
    -- Status transition tracking
    old_status TEXT,
    new_status TEXT,
    
    -- Request/response data for debugging
    request_data JSONB,
    response_data JSONB,
    error_data JSONB,
    
    -- Performance metrics
    latency_ms INTEGER,
    bytes_transferred BIGINT,
    
    -- Audit fields
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Additional context
    user_agent TEXT,
    ip_address INET,
    session_id TEXT
);

-- Add table and column comments
COMMENT ON TABLE agent_mcp_connection_logs IS 'Audit trail and event logs for agent-MCP connections';
COMMENT ON COLUMN agent_mcp_connection_logs.connection_id IS 'Reference to the agent-MCP connection';
COMMENT ON COLUMN agent_mcp_connection_logs.event_type IS 'Type of event that occurred';
COMMENT ON COLUMN agent_mcp_connection_logs.event_details IS 'Human-readable description of the event';
COMMENT ON COLUMN agent_mcp_connection_logs.old_status IS 'Previous connection status (for status changes)';
COMMENT ON COLUMN agent_mcp_connection_logs.new_status IS 'New connection status (for status changes)';
COMMENT ON COLUMN agent_mcp_connection_logs.request_data IS 'Request data for debugging (JSON)';
COMMENT ON COLUMN agent_mcp_connection_logs.response_data IS 'Response data for debugging (JSON)';
COMMENT ON COLUMN agent_mcp_connection_logs.error_data IS 'Error information for failed operations';
COMMENT ON COLUMN agent_mcp_connection_logs.latency_ms IS 'Request latency in milliseconds';
COMMENT ON COLUMN agent_mcp_connection_logs.bytes_transferred IS 'Number of bytes transferred';

-- ============================================================================
-- 2. CREATE MCP SERVER STATUS LOGS TABLE
-- ============================================================================

-- MCP Server Status Logs Table
-- Stores status synchronization history for MCP servers
CREATE TABLE mcp_server_status_logs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Server reference
    server_id UUID NOT NULL REFERENCES account_tool_instances(id) ON DELETE CASCADE,
    
    -- Status information
    previous_status JSONB,
    current_status JSONB,
    
    -- Change details
    source TEXT NOT NULL CHECK (source IN ('dtma', 'heartbeat', 'manual', 'system')),
    details TEXT,
    
    -- Health check data
    health_check_result JSONB,
    heartbeat_data JSONB,
    
    -- Performance metrics
    response_time_ms INTEGER,
    uptime_seconds BIGINT,
    
    -- Audit fields
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Sync metadata
    sync_session_id UUID,
    batch_id UUID
);

-- Add table and column comments
COMMENT ON TABLE mcp_server_status_logs IS 'Status synchronization history for MCP servers';
COMMENT ON COLUMN mcp_server_status_logs.server_id IS 'Reference to the MCP server instance';
COMMENT ON COLUMN mcp_server_status_logs.previous_status IS 'Previous server status (JSON)';
COMMENT ON COLUMN mcp_server_status_logs.current_status IS 'Current server status (JSON)';
COMMENT ON COLUMN mcp_server_status_logs.source IS 'Source of the status update';
COMMENT ON COLUMN mcp_server_status_logs.details IS 'Additional details about the status change';
COMMENT ON COLUMN mcp_server_status_logs.health_check_result IS 'Result of health check (JSON)';
COMMENT ON COLUMN mcp_server_status_logs.heartbeat_data IS 'Heartbeat monitoring data (JSON)';
COMMENT ON COLUMN mcp_server_status_logs.response_time_ms IS 'Server response time in milliseconds';
COMMENT ON COLUMN mcp_server_status_logs.uptime_seconds IS 'Server uptime in seconds';
COMMENT ON COLUMN mcp_server_status_logs.sync_session_id IS 'ID of the synchronization session';
COMMENT ON COLUMN mcp_server_status_logs.batch_id IS 'ID of the batch operation';

-- ============================================================================
-- 3. CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Indexes for agent_mcp_connection_logs
CREATE INDEX idx_agent_mcp_connection_logs_connection_id ON agent_mcp_connection_logs(connection_id);
CREATE INDEX idx_agent_mcp_connection_logs_timestamp ON agent_mcp_connection_logs(timestamp);
CREATE INDEX idx_agent_mcp_connection_logs_event_type ON agent_mcp_connection_logs(event_type);
CREATE INDEX idx_agent_mcp_connection_logs_created_by ON agent_mcp_connection_logs(created_by);

-- Composite indexes for common queries
CREATE INDEX idx_agent_mcp_connection_logs_connection_timestamp ON agent_mcp_connection_logs(connection_id, timestamp);
CREATE INDEX idx_agent_mcp_connection_logs_event_timestamp ON agent_mcp_connection_logs(event_type, timestamp);

-- Indexes for mcp_server_status_logs
CREATE INDEX idx_mcp_server_status_logs_server_id ON mcp_server_status_logs(server_id);
CREATE INDEX idx_mcp_server_status_logs_timestamp ON mcp_server_status_logs(timestamp);
CREATE INDEX idx_mcp_server_status_logs_source ON mcp_server_status_logs(source);
CREATE INDEX idx_mcp_server_status_logs_session_id ON mcp_server_status_logs(sync_session_id);

-- Composite indexes for common queries
CREATE INDEX idx_mcp_server_status_logs_server_timestamp ON mcp_server_status_logs(server_id, timestamp);
CREATE INDEX idx_mcp_server_status_logs_source_timestamp ON mcp_server_status_logs(source, timestamp);

-- Partial indexes for performance optimization
CREATE INDEX idx_agent_mcp_connection_logs_errors ON agent_mcp_connection_logs(timestamp) 
    WHERE event_type = 'error';
CREATE INDEX idx_mcp_server_status_logs_recent ON mcp_server_status_logs(server_id, timestamp) 
    WHERE timestamp > NOW() - INTERVAL '7 days';

-- ============================================================================
-- 4. CREATE ARCHIVE TABLES
-- ============================================================================

-- Archive table for old connection logs
CREATE TABLE agent_mcp_connection_logs_archive (
    LIKE agent_mcp_connection_logs INCLUDING ALL
);

-- Archive table for old status logs  
CREATE TABLE mcp_server_status_logs_archive (
    LIKE mcp_server_status_logs INCLUDING ALL
);

-- Add partitioning indexes for archive tables
CREATE INDEX idx_agent_mcp_connection_logs_archive_timestamp_year 
    ON agent_mcp_connection_logs_archive(EXTRACT(YEAR FROM timestamp), timestamp);
CREATE INDEX idx_mcp_server_status_logs_archive_timestamp_year 
    ON mcp_server_status_logs_archive(EXTRACT(YEAR FROM timestamp), timestamp);

-- ============================================================================
-- 5. CREATE LOG RETENTION AND CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up old connection logs
CREATE OR REPLACE FUNCTION cleanup_agent_mcp_connection_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM agent_mcp_connection_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation if system_logs table exists
    BEGIN
        INSERT INTO system_logs (operation, details, timestamp)
        VALUES (
            'log_cleanup',
            format('Cleaned up %s old agent connection logs (retention: %s days)', deleted_count, retention_days),
            NOW()
        );
    EXCEPTION WHEN undefined_table THEN
        -- Ignore if system_logs table doesn't exist
        NULL;
    END;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old status logs
CREATE OR REPLACE FUNCTION cleanup_mcp_server_status_logs(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM mcp_server_status_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation if system_logs table exists
    BEGIN
        INSERT INTO system_logs (operation, details, timestamp)
        VALUES (
            'log_cleanup',
            format('Cleaned up %s old server status logs (retention: %s days)', deleted_count, retention_days),
            NOW()
        );
    EXCEPTION WHEN undefined_table THEN
        -- Ignore if system_logs table doesn't exist
        NULL;
    END;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old logs to separate tables
CREATE OR REPLACE FUNCTION archive_old_logs()
RETURNS TABLE(connection_logs_archived INTEGER, status_logs_archived INTEGER) AS $$
DECLARE
    conn_archived INTEGER;
    status_archived INTEGER;
BEGIN
    -- Archive connection logs older than 1 year
    INSERT INTO agent_mcp_connection_logs_archive 
    SELECT * FROM agent_mcp_connection_logs 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS conn_archived = ROW_COUNT;
    
    DELETE FROM agent_mcp_connection_logs 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Archive status logs older than 6 months
    INSERT INTO mcp_server_status_logs_archive 
    SELECT * FROM mcp_server_status_logs 
    WHERE timestamp < NOW() - INTERVAL '6 months';
    
    GET DIAGNOSTICS status_archived = ROW_COUNT;
    
    DELETE FROM mcp_server_status_logs 
    WHERE timestamp < NOW() - INTERVAL '6 months';
    
    RETURN QUERY SELECT conn_archived, status_archived;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on logging tables
ALTER TABLE agent_mcp_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_server_status_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for their own agent connections
CREATE POLICY "Users can view their own connection logs" ON agent_mcp_connection_logs
    FOR SELECT
    USING (
        connection_id IN (
            SELECT id FROM agent_mcp_connections amc
            JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

-- Policy: System can insert all logs
CREATE POLICY "System can insert connection logs" ON agent_mcp_connection_logs
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can view status logs for servers their agents connect to
CREATE POLICY "Users can view relevant status logs" ON mcp_server_status_logs
    FOR SELECT
    USING (
        server_id IN (
            SELECT DISTINCT amc.mcp_server_instance_id 
            FROM agent_mcp_connections amc
            JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id = auth.uid() AND amc.is_active = true
        )
    );

-- Policy: System can insert all status logs
CREATE POLICY "System can insert status logs" ON mcp_server_status_logs
    FOR INSERT
    WITH CHECK (true);

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view all connection logs" ON agent_mcp_connection_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all status logs" ON mcp_server_status_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ============================================================================
-- 7. CREATE HELPER VIEWS AND FUNCTIONS
-- ============================================================================

-- View: Recent connection activity
CREATE VIEW recent_connection_activity AS
SELECT 
    acl.timestamp,
    acl.event_type,
    acl.event_details,
    a.name AS agent_name,
    ati.instance_name_on_toolbox AS server_name,
    acl.latency_ms,
    u.email AS user_email
FROM agent_mcp_connection_logs acl
JOIN agent_mcp_connections amc ON acl.connection_id = amc.id
JOIN agents a ON amc.agent_id = a.id
JOIN account_tool_instances ati ON amc.mcp_server_instance_id = ati.id
JOIN auth.users u ON a.user_id = u.id
WHERE acl.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY acl.timestamp DESC;

-- View: Server health history
CREATE VIEW server_health_history AS
SELECT 
    mssl.timestamp,
    ati.instance_name_on_toolbox AS server_name,
    mssl.previous_status->>'health' AS previous_health,
    mssl.current_status->>'health' AS current_health,
    mssl.source,
    mssl.response_time_ms,
    mssl.details
FROM mcp_server_status_logs mssl
JOIN account_tool_instances ati ON mssl.server_id = ati.id
WHERE mssl.timestamp > NOW() - INTERVAL '7 days'
ORDER BY mssl.timestamp DESC;

-- Function: Get connection logs for a specific agent
CREATE OR REPLACE FUNCTION get_agent_connection_logs(
    p_agent_id UUID,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
    timestamp TIMESTAMPTZ,
    event_type TEXT,
    event_details TEXT,
    server_name TEXT,
    latency_ms INTEGER,
    error_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        acl.timestamp,
        acl.event_type,
        acl.event_details,
        ati.instance_name_on_toolbox,
        acl.latency_ms,
        acl.error_data
    FROM agent_mcp_connection_logs acl
    JOIN agent_mcp_connections amc ON acl.connection_id = amc.id
    JOIN account_tool_instances ati ON amc.mcp_server_instance_id = ati.id
    WHERE amc.agent_id = p_agent_id
    AND acl.timestamp > NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY acl.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get server status history
CREATE OR REPLACE FUNCTION get_server_status_history(
    p_server_id UUID,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
    timestamp TIMESTAMPTZ,
    previous_state TEXT,
    current_state TEXT,
    source TEXT,
    details TEXT,
    response_time_ms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mssl.timestamp,
        mssl.previous_status->>'state',
        mssl.current_status->>'state',
        mssl.source,
        mssl.details,
        mssl.response_time_ms
    FROM mcp_server_status_logs mssl
    WHERE mssl.server_id = p_server_id
    AND mssl.timestamp > NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY mssl.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. GRANT APPROPRIATE PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT ON agent_mcp_connection_logs TO authenticated;
GRANT SELECT ON mcp_server_status_logs TO authenticated;
GRANT SELECT ON recent_connection_activity TO authenticated;
GRANT SELECT ON server_health_history TO authenticated;

-- Grant additional permissions to service role for system operations
GRANT ALL ON agent_mcp_connection_logs TO service_role;
GRANT ALL ON mcp_server_status_logs TO service_role;
GRANT ALL ON agent_mcp_connection_logs_archive TO service_role;
GRANT ALL ON mcp_server_status_logs_archive TO service_role;
GRANT ALL ON recent_connection_activity TO service_role;
GRANT ALL ON server_health_history TO service_role;

-- Grant execution permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_agent_mcp_connection_logs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_mcp_server_status_logs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_logs() TO service_role;
GRANT EXECUTE ON FUNCTION get_agent_connection_logs(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_status_history(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add migration completion log
INSERT INTO migrations_log (migration_name, completed_at, description) 
VALUES (
    '20250101000003_create_connection_logging_tables',
    NOW(),
    'Created connection logging tables with audit trail, status history, and log management for MCP-DTMA integration'
) ON CONFLICT (migration_name) DO NOTHING; 