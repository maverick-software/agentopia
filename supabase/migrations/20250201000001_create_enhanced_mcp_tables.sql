-- Migration: Create Enhanced MCP Server Tables
-- This migration creates the enhanced MCP server management tables with multi-tenant support

-- MCP Server Catalog - Central registry of available MCP servers
CREATE TABLE public.mcp_server_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    docker_image TEXT NOT NULL,
    icon_url TEXT,
    category TEXT,
    provider TEXT DEFAULT 'community' CHECK (provider IN ('official', 'community', 'custom')),
    capabilities JSONB DEFAULT '[]'::jsonb,
    required_permissions JSONB DEFAULT '[]'::jsonb,
    configuration_schema JSONB DEFAULT '{}'::jsonb,
    oauth_providers JSONB DEFAULT '[]'::jsonb, -- Supported OAuth providers
    documentation_url TEXT,
    repository_url TEXT,
    license TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_verified BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    download_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.0 CHECK (rating_average >= 0 AND rating_average <= 5),
    rating_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.mcp_server_catalog IS 'Central catalog of available MCP servers';

-- MCP Server Deployments - Organization-specific server instances
CREATE TABLE public.mcp_server_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    catalog_server_id UUID REFERENCES public.mcp_server_catalog(id),
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'active', 'error', 'stopping', 'stopped', 'updating')),
    configuration JSONB DEFAULT '{}'::jsonb,
    environment_variables JSONB DEFAULT '{}'::jsonb,
    resource_limits JSONB DEFAULT '{}'::jsonb,
    health_check_url TEXT,
    internal_endpoint TEXT,
    external_endpoint TEXT,
    container_id TEXT,
    last_health_check TIMESTAMPTZ,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'unknown')),
    error_message TEXT,
    deployment_logs JSONB DEFAULT '[]'::jsonb,
    auto_restart BOOLEAN DEFAULT true,
    restart_count INTEGER DEFAULT 0,
    deployed_by UUID REFERENCES auth.users(id),
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(organization_id, name)
);

COMMENT ON TABLE public.mcp_server_deployments IS 'Organization-specific MCP server deployments';

-- Create indexes and remaining tables in next migration for better organization