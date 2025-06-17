-- Migration: Create minimal connection logging tables
-- Purpose: Basic audit trails for MCP integration
-- Date: 2025-01-01

-- Agent MCP Connection Logs Table
CREATE TABLE agent_mcp_connection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES agent_mcp_connections(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('connect', 'disconnect', 'error', 'test', 'status_change')),
    event_details TEXT,
    old_status TEXT,
    new_status TEXT,
    request_data JSONB,
    response_data JSONB,
    error_data JSONB,
    latency_ms INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- MCP Server Status Logs Table
CREATE TABLE mcp_server_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES account_tool_instances(id) ON DELETE CASCADE,
    previous_status JSONB,
    current_status JSONB,
    source TEXT NOT NULL CHECK (source IN ('dtma', 'heartbeat', 'manual', 'system')),
    details TEXT,
    health_check_result JSONB,
    response_time_ms INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_agent_mcp_connection_logs_connection_id ON agent_mcp_connection_logs(connection_id);
CREATE INDEX idx_agent_mcp_connection_logs_timestamp ON agent_mcp_connection_logs(timestamp);
CREATE INDEX idx_mcp_server_status_logs_server_id ON mcp_server_status_logs(server_id);
CREATE INDEX idx_mcp_server_status_logs_timestamp ON mcp_server_status_logs(timestamp);

-- Enable RLS
ALTER TABLE agent_mcp_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_server_status_logs ENABLE ROW LEVEL SECURITY;

-- Basic policies
CREATE POLICY "Users can view their own connection logs" ON agent_mcp_connection_logs
    FOR SELECT
    USING (
        connection_id IN (
            SELECT amc.id FROM agent_mcp_connections amc
            JOIN agents a ON amc.agent_id = a.id
            WHERE a.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert connection logs" ON agent_mcp_connection_logs
    FOR INSERT
    WITH CHECK (true);

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

CREATE POLICY "System can insert status logs" ON mcp_server_status_logs
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON agent_mcp_connection_logs TO authenticated;
GRANT SELECT ON mcp_server_status_logs TO authenticated;
GRANT ALL ON agent_mcp_connection_logs TO service_role;
GRANT ALL ON mcp_server_status_logs TO service_role; 