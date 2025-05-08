-- Migration: create_tool_infrastructure_tables
-- Timestamp: 20250506000000

BEGIN;

-- ENUM Types
CREATE TYPE public.droplet_status_enum AS ENUM (
    'pending_creation', 'creating', 'active', 'error_creation', 
    'pending_deletion', 'deleting', 'deleted', 'error_deletion', 'unresponsive'
);

CREATE TYPE public.tool_installation_status_enum AS ENUM (
    'pending_install', 'installing', 'active', 'error_install', 
    'pending_uninstall', 'uninstalling', 'uninstalled', 'error_uninstall', 
    'pending_config', 'stopped', 'starting', 'stopping', 'error_runtime', 'disabled'
);

CREATE TYPE public.tool_packaging_type_enum AS ENUM (
    'docker_image'
);

CREATE TYPE public.catalog_tool_status_enum AS ENUM (
    'available', 'beta', 'experimental', 'deprecated', 'archived'
);

-- Function to auto-update 'updated_at'
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: agent_droplets
CREATE TABLE public.agent_droplets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
    do_droplet_id BIGINT UNIQUE, -- Can be NULL initially, should be NOT NULL after creation
    ip_address INET,
    status public.droplet_status_enum NOT NULL DEFAULT 'pending_creation',
    region_slug TEXT NOT NULL,
    size_slug TEXT NOT NULL,
    image_slug TEXT NOT NULL,
    do_created_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_droplets_agent_id ON public.agent_droplets(agent_id);
CREATE INDEX idx_agent_droplets_do_droplet_id ON public.agent_droplets(do_droplet_id);
CREATE INDEX idx_agent_droplets_status ON public.agent_droplets(status);

CREATE TRIGGER set_agent_droplets_timestamp
BEFORE UPDATE ON public.agent_droplets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Table: tool_catalog
CREATE TABLE public.tool_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_name TEXT NOT NULL UNIQUE,
    description TEXT,
    developer_org_name TEXT,
    categories TEXT[],
    icon_url TEXT,
    documentation_url TEXT,
    packaging_type public.tool_packaging_type_enum NOT NULL DEFAULT 'docker_image',
    package_identifier TEXT NOT NULL,
    version_info JSONB NOT NULL DEFAULT '{"available_versions": ["latest"], "default_version": "latest"}',
    default_config_template JSONB DEFAULT '{}',
    required_secrets_schema JSONB DEFAULT '[]',
    resource_requirements JSONB DEFAULT '{}',
    status public.catalog_tool_status_enum NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tool_catalog_categories ON public.tool_catalog USING GIN (categories);
CREATE INDEX idx_tool_catalog_status ON public.tool_catalog(status);

CREATE TRIGGER set_tool_catalog_timestamp
BEFORE UPDATE ON public.tool_catalog
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Table: agent_droplet_tools
CREATE TABLE public.agent_droplet_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_droplet_id UUID NOT NULL REFERENCES public.agent_droplets(id) ON DELETE CASCADE,
    tool_catalog_id UUID NOT NULL REFERENCES public.tool_catalog(id) ON DELETE RESTRICT, 
    version_to_install TEXT NOT NULL,
    actual_installed_version TEXT,
    status public.tool_installation_status_enum NOT NULL DEFAULT 'pending_install',
    config_values JSONB DEFAULT '{}',
    runtime_details JSONB DEFAULT '{}',
    error_message TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_droplet_tools_agent_droplet_id ON public.agent_droplet_tools(agent_droplet_id);
CREATE INDEX idx_agent_droplet_tools_tool_catalog_id ON public.agent_droplet_tools(tool_catalog_id);
CREATE INDEX idx_agent_droplet_tools_status ON public.agent_droplet_tools(status);

CREATE TRIGGER set_agent_droplet_tools_timestamp
BEFORE UPDATE ON public.agent_droplet_tools
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

COMMIT; 