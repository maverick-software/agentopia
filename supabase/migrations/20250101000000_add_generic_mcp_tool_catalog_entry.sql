-- Migration: Add Generic MCP Server Entry to Tool Catalog
-- Date: January 1, 2025
-- Purpose: Provide a generic tool_catalog entry for MCP servers to satisfy foreign key constraints
-- This is a temporary solution until MCP servers are fully migrated to use mcp_server_deployments

BEGIN;

-- Insert a generic MCP Server entry into tool_catalog
-- This provides a valid foreign key reference for account_tool_instances
INSERT INTO public.tool_catalog (
  id,
  tool_name,
  name,
  description,
  docker_image_url,
  category,
  provider,
  version,
  is_public,
  packaging_type,
  package_identifier,
  status,
  default_config_template,
  required_secrets_schema,
  resource_requirements
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'MCP Server',
  'MCP Server',
  'Generic Model Context Protocol (MCP) Server - A standardized protocol for integrating external tools and resources with AI agents',
  'mcpserver/generic:latest',
  'mcp',
  'Official',
  '1.0.0',
  true,
  'docker_image',
  'mcpserver/generic:latest',
  'available',
  '{"transport": "stdio", "endpoint": "/mcp", "capabilities": ["tools", "resources", "prompts"]}'::jsonb,
  '[]'::jsonb,
  '{"memory": "256Mi", "cpu": "0.25"}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  updated_at = now();

-- Add comment explaining this entry
COMMENT ON TABLE public.tool_catalog IS 'Admin-curated list of available tools that can be deployed on Toolboxes. Includes generic MCP Server entry for foreign key constraints.';

COMMIT; 