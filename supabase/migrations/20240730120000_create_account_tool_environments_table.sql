-- Create ENUM type for account tool environment status
CREATE TYPE account_tool_environment_status_enum AS ENUM (
    'inactive',
    'pending_creation',
    'creating',
    'active',
    'error_creation',
    'pending_deletion',
    'deleting',
    'error_deletion',
    'unresponsive',
    'scaling'
);

-- Create account_tool_environments table
CREATE TABLE IF NOT EXISTS public.account_tool_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    do_droplet_id BIGINT NULL,
    ip_address INET NULL,
    status account_tool_environment_status_enum NOT NULL DEFAULT 'inactive',
    region_slug TEXT NOT NULL,
    size_slug TEXT NOT NULL,
    image_slug TEXT NOT NULL,
    last_heartbeat_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_do_droplet_id UNIQUE (do_droplet_id) -- Assuming do_droplet_id should be unique if present
);

-- Add indexes for account_tool_environments
CREATE INDEX IF NOT EXISTS idx_ate_user_id ON public.account_tool_environments(user_id);
CREATE INDEX IF NOT EXISTS idx_ate_status ON public.account_tool_environments(status);

-- Trigger to automatically update updated_at timestamp (reusable function)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_account_tool_environments_updated_at
BEFORE UPDATE ON public.account_tool_environments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- RLS policies for account_tool_environments
ALTER TABLE public.account_tool_environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own account tool environment"
ON public.account_tool_environments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service roles can access all account tool environments"
ON public.account_tool_environments
FOR ALL
USING (get_my_claim('role') = 'service_role')
WITH CHECK (get_my_claim('role') = 'service_role');

COMMENT ON TABLE public.account_tool_environments IS 'Stores information about shared DigitalOcean Droplets provisioned for a user account''s tool environment.';
COMMENT ON COLUMN public.account_tool_environments.user_id IS 'The user account this tool environment belongs to.';
COMMENT ON COLUMN public.account_tool_environments.do_droplet_id IS 'The DigitalOcean ID of the provisioned droplet.';
COMMENT ON COLUMN public.account_tool_environments.status IS 'The current status of the account tool environment.';
COMMENT ON COLUMN public.account_tool_environments.last_heartbeat_at IS 'Timestamp of the last successful contact from the DTMA on this environment.';

-- Create ENUM type for tool installation status on account environment
CREATE TYPE account_tool_installation_status_enum AS ENUM (
    'pending_install',
    'installing',
    'active',
    'error_install',
    'pending_uninstall',
    'uninstalling',
    'uninstalled',
    'error_uninstall',
    'pending_config',
    'stopped',
    'starting',
    'stopping',
    'error_runtime',
    'disabled'
);

-- Table to track tools installed/active on an account's tool environment
CREATE TABLE IF NOT EXISTS public.account_tool_environment_active_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_tool_environment_id UUID NOT NULL REFERENCES public.account_tool_environments(id) ON DELETE CASCADE,
    tool_catalog_id UUID NOT NULL REFERENCES public.tool_catalog(id) ON DELETE RESTRICT, -- Prevent deleting a tool from catalog if it's active
    status account_tool_installation_status_enum NOT NULL DEFAULT 'pending_install',
    version_to_install TEXT NOT NULL DEFAULT 'latest', -- Version from tool_catalog to install
    actual_installed_version TEXT NULL, -- Actual version reported by DTMA
    config_values JSONB NULL DEFAULT '{}',
    runtime_details JSONB NULL DEFAULT '{}',
    error_message TEXT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_account_env_tool UNIQUE (account_tool_environment_id, tool_catalog_id)
);

-- Add indexes for account_tool_environment_active_tools
CREATE INDEX IF NOT EXISTS idx_ateat_account_tool_environment_id ON public.account_tool_environment_active_tools(account_tool_environment_id);
CREATE INDEX IF NOT EXISTS idx_ateat_tool_catalog_id ON public.account_tool_environment_active_tools(tool_catalog_id);
CREATE INDEX IF NOT EXISTS idx_ateat_status ON public.account_tool_environment_active_tools(status);

-- Trigger for updated_at on account_tool_environment_active_tools
CREATE TRIGGER set_account_tool_environment_active_tools_updated_at
BEFORE UPDATE ON public.account_tool_environment_active_tools
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- RLS Policies for account_tool_environment_active_tools
ALTER TABLE public.account_tool_environment_active_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tools on their own account environment"
ON public.account_tool_environment_active_tools
FOR ALL
USING (
    auth.uid() = (
        SELECT user_id FROM public.account_tool_environments ate
        WHERE ate.id = account_tool_environment_id
    )
)
WITH CHECK (
    auth.uid() = (
        SELECT user_id FROM public.account_tool_environments ate
        WHERE ate.id = account_tool_environment_id
    )
);

CREATE POLICY "Service roles can access all account tool environment tools"
ON public.account_tool_environment_active_tools
FOR ALL
USING (get_my_claim('role') = 'service_role')
WITH CHECK (get_my_claim('role') = 'service_role');

COMMENT ON TABLE public.account_tool_environment_active_tools IS 'Tracks tools that are installed or active on a user account''s shared tool environment.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.account_tool_environment_id IS 'The ID of the account tool environment.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.tool_catalog_id IS 'The ID of the tool from the tool catalog.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.status IS 'The current status of the tool installation.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.version_to_install IS 'The version of the tool to install.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.actual_installed_version IS 'The actual installed version of the tool.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.config_values IS 'The configuration values for the tool.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.runtime_details IS 'Runtime details for the tool.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.error_message IS 'Error message related to the tool installation.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.enabled IS 'Indicates whether the tool is enabled.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.created_at IS 'Timestamp when the tool installation record was created.';
COMMENT ON COLUMN public.account_tool_environment_active_tools.updated_at IS 'Timestamp when the tool installation record was last updated.'; 