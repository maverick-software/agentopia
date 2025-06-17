-- Migration: Add agent_mcp_connections table for user-agent to MCP server connections
-- This enables users to connect their agents to admin-deployed MCP servers

-- Create agent_mcp_connections table
CREATE TABLE agent_mcp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mcp_server_instance_id UUID NOT NULL REFERENCES account_tool_instances(id) ON DELETE CASCADE,
  connection_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one connection per agent-server pair
  UNIQUE(agent_id, mcp_server_instance_id)
);

-- Add trigger for updated_at
CREATE TRIGGER trigger_agent_mcp_connections_updated_at
  BEFORE UPDATE ON agent_mcp_connections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS
ALTER TABLE agent_mcp_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own agent connections
CREATE POLICY "agent_mcp_connections_user_policy" ON agent_mcp_connections
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX idx_agent_mcp_connections_agent_id ON agent_mcp_connections(agent_id);
CREATE INDEX idx_agent_mcp_connections_mcp_server_instance_id ON agent_mcp_connections(mcp_server_instance_id);
CREATE INDEX idx_agent_mcp_connections_is_active ON agent_mcp_connections(is_active);

-- Add comment
COMMENT ON TABLE agent_mcp_connections IS 'Connections between user agents and admin-deployed MCP servers'; 