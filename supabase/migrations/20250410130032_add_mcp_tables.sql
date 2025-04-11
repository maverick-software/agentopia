-- Migration: Add MCP Configuration and Server Tables

-- Enable Vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Table for overall MCP enable/disable per agent
CREATE TABLE mcp_configurations (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookup by agent_id
CREATE INDEX IF NOT EXISTS idx_mcp_configurations_agent_id ON mcp_configurations(agent_id);

-- Table for individual MCP server connections linked to a configuration
CREATE TABLE mcp_servers (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES mcp_configurations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  endpoint_url TEXT NOT NULL,
  vault_api_key_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL, -- Link to Supabase Vault secret
  timeout_ms INTEGER DEFAULT 5000 CHECK (timeout_ms >= 0),
  max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0),
  retry_backoff_ms INTEGER DEFAULT 1000 CHECK (retry_backoff_ms >= 0),
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  capabilities JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookup by config_id
CREATE INDEX IF NOT EXISTS idx_mcp_servers_config_id ON mcp_servers(config_id);

-- Trigger function to update 'updated_at' timestamp (Create only if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to mcp_configurations if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_configurations_updated_at') THEN
    CREATE TRIGGER update_mcp_configurations_updated_at
    BEFORE UPDATE ON mcp_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Apply trigger to mcp_servers if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_servers_updated_at') THEN
    CREATE TRIGGER update_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 