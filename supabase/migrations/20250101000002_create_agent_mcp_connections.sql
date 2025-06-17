-- Migration: Create agent_mcp_connections table
-- Purpose: Store connections between user agents and admin-deployed MCP servers
-- Date: 2025-01-01
-- Related to: MCP-DTMA Integration Phase 4.2.1

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE MAIN TABLE
-- ============================================================================

-- Agent MCP Connections Table
-- Stores connections between user agents and admin-deployed MCP servers
CREATE TABLE agent_mcp_connections (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key relationships
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mcp_server_instance_id UUID NOT NULL REFERENCES account_tool_instances(id) ON DELETE CASCADE,
    
    -- Connection configuration
    connection_config JSONB DEFAULT '{}',
    connection_test_result JSONB,
    
    -- Connection state
    is_active BOOLEAN NOT NULL DEFAULT true,
    connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'testing')),
    
    -- Usage tracking
    last_used TIMESTAMPTZ,
    usage_stats JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    UNIQUE(agent_id, mcp_server_instance_id, is_active) WHERE is_active = true
);

-- Add table and column comments for documentation
COMMENT ON TABLE agent_mcp_connections IS 'Stores connections between user agents and MCP servers';
COMMENT ON COLUMN agent_mcp_connections.agent_id IS 'Reference to the agent making the connection';
COMMENT ON COLUMN agent_mcp_connections.mcp_server_instance_id IS 'Reference to the MCP server instance';
COMMENT ON COLUMN agent_mcp_connections.connection_config IS 'JSON configuration for the connection (timeout, retries, etc.)';
COMMENT ON COLUMN agent_mcp_connections.connection_test_result IS 'Result of the last connection test';
COMMENT ON COLUMN agent_mcp_connections.is_active IS 'Whether the connection is currently active';
COMMENT ON COLUMN agent_mcp_connections.connection_status IS 'Current status of the connection';
COMMENT ON COLUMN agent_mcp_connections.last_used IS 'Timestamp of last connection usage';
COMMENT ON COLUMN agent_mcp_connections.usage_stats IS 'JSON object containing usage statistics';

-- ============================================================================
-- 2. CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Primary indexes for foreign key relationships
CREATE INDEX idx_agent_mcp_connections_agent_id ON agent_mcp_connections(agent_id);
CREATE INDEX idx_agent_mcp_connections_server_id ON agent_mcp_connections(mcp_server_instance_id);

-- Status and state indexes
CREATE INDEX idx_agent_mcp_connections_active ON agent_mcp_connections(is_active) WHERE is_active = true;
CREATE INDEX idx_agent_mcp_connections_status ON agent_mcp_connections(connection_status);

-- Temporal indexes
CREATE INDEX idx_agent_mcp_connections_created_at ON agent_mcp_connections(created_at);
CREATE INDEX idx_agent_mcp_connections_last_used ON agent_mcp_connections(last_used);

-- Composite indexes for common query patterns
CREATE INDEX idx_agent_mcp_connections_agent_active ON agent_mcp_connections(agent_id, is_active) WHERE is_active = true;
CREATE INDEX idx_agent_mcp_connections_server_active ON agent_mcp_connections(mcp_server_instance_id, is_active) WHERE is_active = true;

-- ============================================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_mcp_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_agent_mcp_connections_updated_at
    BEFORE UPDATE ON agent_mcp_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_mcp_connections_updated_at();

-- ============================================================================
-- 4. CREATE DATA VALIDATION FUNCTIONS
-- ============================================================================

-- Function to validate connection configuration
CREATE OR REPLACE FUNCTION validate_connection_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow empty configuration
    IF config IS NULL OR config = '{}'::JSONB THEN
        RETURN TRUE;
    END IF;
    
    -- Check timeout field
    IF config ? 'timeout' THEN
        IF NOT (config->>'timeout' ~ '^[0-9]+$') OR (config->>'timeout')::INTEGER <= 0 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check retryAttempts field
    IF config ? 'retryAttempts' THEN
        IF NOT (config->>'retryAttempts' ~ '^[0-9]+$') OR (config->>'retryAttempts')::INTEGER < 0 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check maxConcurrentRequests field
    IF config ? 'maxConcurrentRequests' THEN
        IF NOT (config->>'maxConcurrentRequests' ~ '^[0-9]+$') OR (config->>'maxConcurrentRequests')::INTEGER <= 0 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check enableLogging field
    IF config ? 'enableLogging' THEN
        IF NOT (config->>'enableLogging' IN ('true', 'false')) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add check constraint for connection configuration
ALTER TABLE agent_mcp_connections 
ADD CONSTRAINT check_valid_connection_config 
CHECK (validate_connection_config(connection_config));

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on the table
ALTER TABLE agent_mcp_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see connections for their own agents
CREATE POLICY "Users can view their own agent connections" ON agent_mcp_connections
    FOR SELECT
    USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can only insert connections for their own agents
CREATE POLICY "Users can create connections for their own agents" ON agent_mcp_connections
    FOR INSERT
    WITH CHECK (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can only update connections for their own agents
CREATE POLICY "Users can update their own agent connections" ON agent_mcp_connections
    FOR UPDATE
    USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can only delete connections for their own agents
CREATE POLICY "Users can delete their own agent connections" ON agent_mcp_connections
    FOR DELETE
    USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Policy: Admins can view all connections for monitoring
CREATE POLICY "Admins can view all agent connections" ON agent_mcp_connections
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ============================================================================
-- 6. CREATE HELPER VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active agent connections with server details
CREATE VIEW active_agent_mcp_connections AS
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
WHERE amc.is_active = true;

-- View: Connection statistics by user
CREATE VIEW user_mcp_connection_stats AS
SELECT 
    a.user_id,
    COUNT(*) AS total_connections,
    COUNT(*) FILTER (WHERE amc.connection_status = 'connected') AS active_connections,
    COUNT(*) FILTER (WHERE amc.connection_status = 'error') AS error_connections,
    COUNT(*) FILTER (WHERE amc.connection_status = 'disconnected') AS disconnected_connections,
    MAX(amc.last_used) AS last_connection_used,
    MIN(amc.created_at) AS first_connection_created,
    COUNT(DISTINCT amc.mcp_server_instance_id) AS unique_servers_connected
FROM agent_mcp_connections amc
JOIN agents a ON amc.agent_id = a.id
WHERE amc.is_active = true
GROUP BY a.user_id;

-- View: Server connection statistics
CREATE VIEW server_mcp_connection_stats AS
SELECT 
    ati.id AS server_id,
    ati.instance_name_on_toolbox AS server_name,
    ati.mcp_server_type AS server_type,
    COUNT(*) AS total_connections,
    COUNT(*) FILTER (WHERE amc.connection_status = 'connected') AS active_connections,
    COUNT(*) FILTER (WHERE amc.connection_status = 'error') AS error_connections,
    COUNT(DISTINCT amc.agent_id) AS unique_agents_connected,
    COUNT(DISTINCT a.user_id) AS unique_users_connected,
    MAX(amc.last_used) AS last_connection_used,
    MIN(amc.created_at) AS first_connection_created
FROM account_tool_instances ati
LEFT JOIN agent_mcp_connections amc ON ati.id = amc.mcp_server_instance_id AND amc.is_active = true
LEFT JOIN agents a ON amc.agent_id = a.id
WHERE ati.mcp_server_type IS NOT NULL
GROUP BY ati.id, ati.instance_name_on_toolbox, ati.mcp_server_type;

-- ============================================================================
-- 7. CREATE AUDIT FUNCTIONS
-- ============================================================================

-- Function to log connection events
CREATE OR REPLACE FUNCTION log_agent_mcp_connection_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Set created_by on INSERT
    IF TG_OP = 'INSERT' THEN
        NEW.created_by = auth.uid();
        RETURN NEW;
    END IF;
    
    -- Log significant changes on UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.connection_status != NEW.connection_status THEN
            INSERT INTO agent_mcp_connection_logs (
                connection_id,
                event_type,
                event_details,
                old_status,
                new_status,
                created_by
            ) VALUES (
                NEW.id,
                'status_change',
                format('Connection status changed from %s to %s', OLD.connection_status, NEW.connection_status),
                OLD.connection_status,
                NEW.connection_status,
                auth.uid()
            );
        END IF;
        
        -- Log activation/deactivation
        IF OLD.is_active != NEW.is_active THEN
            INSERT INTO agent_mcp_connection_logs (
                connection_id,
                event_type,
                event_details,
                created_by
            ) VALUES (
                NEW.id,
                CASE WHEN NEW.is_active THEN 'activated' ELSE 'deactivated' END,
                format('Connection %s', CASE WHEN NEW.is_active THEN 'activated' ELSE 'deactivated' END),
                auth.uid()
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER trigger_agent_mcp_connection_audit
    BEFORE INSERT OR UPDATE ON agent_mcp_connections
    FOR EACH ROW
    EXECUTE FUNCTION log_agent_mcp_connection_event();

-- ============================================================================
-- 8. GRANT APPROPRIATE PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_mcp_connections TO authenticated;
GRANT SELECT ON active_agent_mcp_connections TO authenticated;
GRANT SELECT ON user_mcp_connection_stats TO authenticated;

-- Grant additional permissions to service role for system operations
GRANT ALL ON agent_mcp_connections TO service_role;
GRANT ALL ON active_agent_mcp_connections TO service_role;
GRANT ALL ON user_mcp_connection_stats TO service_role;
GRANT ALL ON server_mcp_connection_stats TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add migration completion log
INSERT INTO migrations_log (migration_name, completed_at, description) 
VALUES (
    '20250101000002_create_agent_mcp_connections',
    NOW(),
    'Created agent_mcp_connections table with RLS policies, indexes, and helper views for MCP-DTMA integration'
) ON CONFLICT (migration_name) DO NOTHING; 