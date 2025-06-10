-- Migration: Add MCP Server Support to Tool Instances
-- Date: June 7, 2025
-- Project: MCP Server Integration Phase 2.2.1
-- This migration adds MCP-specific columns to support multi-MCP server hosting

BEGIN;

-- First, ensure we're working with the correct table name
-- The refactor migration should have renamed account_tool_environment_active_tools to account_tool_instances
-- But we'll handle both cases for safety

-- Check if account_tool_instances exists, if not rename the old table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_tool_instances') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_tool_environment_active_tools') THEN
            -- Rename the old table to the new name
            ALTER TABLE public.account_tool_environment_active_tools RENAME TO account_tool_instances;
            
            -- Update column names to match our planning
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_instances' AND column_name = 'status') THEN
                ALTER TABLE public.account_tool_instances RENAME COLUMN status TO status_on_toolbox;
            END IF;
            
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_instances' AND column_name = 'config_values') THEN
                ALTER TABLE public.account_tool_instances RENAME COLUMN config_values TO base_config_override_json;
            END IF;
            
            -- Add missing columns from our planning
            ALTER TABLE public.account_tool_instances 
            ADD COLUMN IF NOT EXISTS instance_name_on_toolbox TEXT,
            ADD COLUMN IF NOT EXISTS port_mapping_json JSONB NULL,
            ADD COLUMN IF NOT EXISTS last_heartbeat_from_dtma TIMESTAMPTZ NULL,
            ADD COLUMN IF NOT EXISTS version TEXT NULL,
            ADD COLUMN IF NOT EXISTS instance_error_message TEXT NULL;
            
            -- Remove old columns that are no longer needed
            ALTER TABLE public.account_tool_instances 
            DROP COLUMN IF EXISTS version_to_install,
            DROP COLUMN IF EXISTS actual_installed_version,
            DROP COLUMN IF EXISTS runtime_details,
            DROP COLUMN IF EXISTS error_message,
            DROP COLUMN IF EXISTS enabled;
        END IF;
    END IF;
END$$;

-- Now add MCP-specific columns to account_tool_instances table
ALTER TABLE public.account_tool_instances 
ADD COLUMN IF NOT EXISTS mcp_server_type TEXT NULL 
    CHECK (mcp_server_type IS NULL OR mcp_server_type IN ('standard_tool', 'mcp_server')),
ADD COLUMN IF NOT EXISTS mcp_endpoint_path TEXT NULL,
ADD COLUMN IF NOT EXISTS mcp_transport_type TEXT NULL 
    CHECK (mcp_transport_type IS NULL OR mcp_transport_type IN ('stdio', 'sse', 'websocket')),
ADD COLUMN IF NOT EXISTS mcp_server_capabilities JSONB NULL,
ADD COLUMN IF NOT EXISTS mcp_discovery_metadata JSONB NULL;

-- Create agent MCP access control table
CREATE TABLE IF NOT EXISTS public.agent_mcp_server_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    account_tool_instance_id UUID NOT NULL REFERENCES public.account_tool_instances(id) ON DELETE CASCADE,
    granted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'read_only' CHECK (access_level IN ('read_only', 'full_access', 'custom')),
    allowed_tools JSONB NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_agent_mcp_instance UNIQUE (agent_id, account_tool_instance_id)
);

-- Add comments for new MCP columns
COMMENT ON COLUMN public.account_tool_instances.mcp_server_type IS 'Type of container: standard_tool or mcp_server';
COMMENT ON COLUMN public.account_tool_instances.mcp_endpoint_path IS 'MCP server endpoint path (e.g., /mcp)';
COMMENT ON COLUMN public.account_tool_instances.mcp_transport_type IS 'MCP transport protocol: stdio, sse, or websocket';
COMMENT ON COLUMN public.account_tool_instances.mcp_server_capabilities IS 'JSON object containing MCP server capabilities';
COMMENT ON COLUMN public.account_tool_instances.mcp_discovery_metadata IS 'JSON object containing MCP discovery metadata';

-- Add comment for new table
COMMENT ON TABLE public.agent_mcp_server_access IS 'Defines which agents can access which MCP servers with specific permissions';

-- Enable RLS on new table
ALTER TABLE public.agent_mcp_server_access ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent MCP access
CREATE POLICY "Users can view their agents' MCP access" ON public.agent_mcp_server_access
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE agents.id = agent_mcp_server_access.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their agents' MCP access" ON public.agent_mcp_server_access
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE agents.id = agent_mcp_server_access.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Create indexes for MCP server access queries
CREATE INDEX IF NOT EXISTS idx_agent_mcp_server_access_agent_id 
ON public.agent_mcp_server_access(agent_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_account_tool_instances_mcp_server_type 
ON public.account_tool_instances(mcp_server_type) WHERE mcp_server_type = 'mcp_server';

-- Composite index for MCP server discovery
CREATE INDEX IF NOT EXISTS idx_mcp_server_discovery 
ON public.account_tool_instances(account_tool_environment_id, mcp_server_type, status_on_toolbox) 
WHERE mcp_server_type = 'mcp_server';

-- Add constraint to ensure MCP servers have required fields
ALTER TABLE public.account_tool_instances 
ADD CONSTRAINT chk_mcp_server_required_fields 
CHECK (
  (mcp_server_type IS NULL) OR 
  (mcp_server_type = 'standard_tool') OR 
  (mcp_server_type = 'mcp_server' AND mcp_transport_type IS NOT NULL)
);

COMMIT; 