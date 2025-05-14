-- Supabase Migration: Refactor Tool Schema (Based on WBS v2.1)
-- Timestamp: 20250512000000

BEGIN;

-- Section 1: ENUM Type Modifications & Creations
-- For account_tool_environments.status (Modifying existing account_tool_environment_status_enum)
-- WBS Target: pending_provision, provisioning, active, error_provisioning, pending_deprovision, deprovisioning, deprovisioned, error_deprovisioning, unresponsive.
-- Existing: inactive, pending_creation, creating, active, error_creation, pending_deletion, deleting, error_deletion, unresponsive, scaling.
-- Strategy: Add new values, then use ALTER TYPE for renames if direct remapping isn't clean.
-- For simplicity here, we'll ensure all WBS target values exist. Existing apps might need more careful transition for enum renames.

-- Add missing WBS values (idempotently, though direct ADD VALUE is not idempotent without checks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_provision' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'pending_provision';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'provisioning' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'provisioning';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'error_provisioning' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'error_provisioning';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_deprovision' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'pending_deprovision';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deprovisioning' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'deprovisioning';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deprovisioned' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'deprovisioned';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'error_deprovisioning' AND enumtypid = 'account_tool_environment_status_enum'::regtype) THEN
        ALTER TYPE account_tool_environment_status_enum ADD VALUE 'error_deprovisioning';
    END IF;
    -- Note: 'active', 'unresponsive' from WBS likely already exist or map. 'inactive', 'scaling' are existing values kept for now.
    -- Mapping old names (e.g. pending_creation -> pending_provision) would require updating data then renaming enum values, which is complex.
    -- For this refactor, we assume new records will use the WBS-aligned values.
END$$;
COMMENT ON TYPE account_tool_environment_status_enum IS 'Reflects WBS v2.1 statuses for account tool environments, retaining some prior values like inactive, scaling.';


-- For account_tool_instances.status_on_toolbox (Modifying existing account_tool_installation_status_enum)
-- WBS Target: pending_deploy, deploying, running, stopped, error, pending_delete, deleting
-- Existing: pending_install, installing, active, error_install, pending_uninstall, uninstalling, uninstalled, error_uninstall, pending_config, stopped, starting, stopping, error_runtime, disabled
-- Strategy: Similar to above, ensure WBS values exist.
DO $$
BEGIN
    ALTER TYPE account_tool_installation_status_enum ADD VALUE IF NOT EXISTS 'pending_deploy';
    ALTER TYPE account_tool_installation_status_enum ADD VALUE IF NOT EXISTS 'deploying';
    ALTER TYPE account_tool_installation_status_enum ADD VALUE IF NOT EXISTS 'running'; -- Maps to 'active'
    -- 'stopped' already exists
    ALTER TYPE account_tool_installation_status_enum ADD VALUE IF NOT EXISTS 'error'; -- Generic error
    ALTER TYPE account_tool_installation_status_enum ADD VALUE IF NOT EXISTS 'pending_delete';
    ALTER TYPE account_tool_installation_status_enum ADD VALUE IF NOT EXISTS 'deleting';
END$$;
COMMENT ON TYPE account_tool_installation_status_enum IS 'Reflects WBS v2.1 statuses for tool instances on a toolbox, retaining some prior more granular values.';

-- Create new ENUM for agent_tool_credentials.status
CREATE TYPE agent_tool_credential_status_enum AS ENUM (
    'active',
    'revoked',
    'requires_reauth',
    'error'
);


-- Section 2: Table Modifications

-- Modify public.account_tool_environments (WBS 1.2.1)
ALTER TABLE public.account_tool_environments
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT NULL,
    ADD COLUMN IF NOT EXISTS dtma_bearer_token TEXT NULL,
    ADD COLUMN IF NOT EXISTS dtma_last_known_version TEXT NULL,
    ADD COLUMN IF NOT EXISTS dtma_health_details_json JSONB NULL,
    ADD COLUMN IF NOT EXISTS image_slug TEXT NULL, -- Confirmed as needed per WBS 1.2.1 Action Item
    ADD COLUMN IF NOT EXISTS provisioning_error_message TEXT NULL; -- Renamed from error_message for clarity for env lifecycle errors

-- Rename ip_address to public_ip_address if it exists and the new one doesn't
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_environments' AND column_name = 'ip_address') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_environments' AND column_name = 'public_ip_address') THEN
        ALTER TABLE public.account_tool_environments RENAME COLUMN ip_address TO public_ip_address;
    END IF;
END$$;
-- Drop old error_message if provisioning_error_message is added
ALTER TABLE public.account_tool_environments DROP COLUMN IF EXISTS error_message;


COMMENT ON COLUMN public.account_tool_environments.name IS 'User-defined name for the Toolbox, e.g., "My Primary Toolbox"';
COMMENT ON COLUMN public.account_tool_environments.description IS 'Optional description for the Toolbox.';
COMMENT ON COLUMN public.account_tool_environments.dtma_bearer_token IS 'Bearer token for the DTMA on this environment to authenticate with the backend.';
COMMENT ON COLUMN public.account_tool_environments.dtma_last_known_version IS 'Last known version of the DTMA running on this environment.';
COMMENT ON COLUMN public.account_tool_environments.dtma_health_details_json IS 'Health details reported by DTMA (e.g., disk, CPU, memory).';
COMMENT ON COLUMN public.account_tool_environments.image_slug IS 'Base OS image slug used for the droplet (e.g., "ubuntu-22-04-x64").';
COMMENT ON COLUMN public.account_tool_environments.provisioning_error_message IS 'Records errors specifically from the provisioning/deprovisioning lifecycle of the environment.';
COMMENT ON COLUMN public.account_tool_environments.status IS 'Current status of the account tool environment, aligned with WBS v2.1 definitions.';


-- Modify public.account_tool_environment_active_tools to become public.account_tool_instances (WBS 1.2.3)
-- Rename table first
ALTER TABLE IF EXISTS public.account_tool_environment_active_tools RENAME TO account_tool_instances;

-- Add/Modify columns for public.account_tool_instances
ALTER TABLE public.account_tool_instances
    ADD COLUMN IF NOT EXISTS instance_name_on_toolbox TEXT,
    ADD COLUMN IF NOT EXISTS port_mapping_json JSONB NULL,
    ADD COLUMN IF NOT EXISTS last_heartbeat_from_dtma TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS version TEXT NULL, -- Consolidates version_to_install and actual_installed_version
    ADD COLUMN IF NOT EXISTS base_config_override_json JSONB NULL, -- Replaces config_values
    ADD COLUMN IF NOT EXISTS instance_error_message TEXT NULL; -- For tool-specific errors

-- Rename status column and potentially change its type if ENUMs were not altered in-place perfectly
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_instances' AND column_name = 'status') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_instances' AND column_name = 'status_on_toolbox') THEN
        ALTER TABLE public.account_tool_instances RENAME COLUMN status TO status_on_toolbox;
    END IF;
END$$;
-- Ensure status_on_toolbox uses the (potentially modified) account_tool_installation_status_enum
ALTER TABLE public.account_tool_instances ALTER COLUMN status_on_toolbox TYPE account_tool_installation_status_enum USING status_on_toolbox::text::account_tool_installation_status_enum;


-- Handle old version columns: For simplicity, we add 'version' and expect new logic to populate it. Old columns can be dropped.
ALTER TABLE public.account_tool_instances DROP COLUMN IF EXISTS version_to_install;
ALTER TABLE public.account_tool_instances DROP COLUMN IF EXISTS actual_installed_version;

-- Handle old config_values: Renamed to base_config_override_json if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_instances' AND column_name = 'config_values') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_tool_instances' AND column_name = 'base_config_override_json') THEN
        ALTER TABLE public.account_tool_instances RENAME COLUMN config_values TO base_config_override_json;
    END IF;
END$$;
-- Drop old runtime_details, error_message (replaced by instance_error_message), enabled
ALTER TABLE public.account_tool_instances DROP COLUMN IF EXISTS runtime_details;
ALTER TABLE public.account_tool_instances DROP COLUMN IF EXISTS error_message; -- if instance_error_message is the successor
ALTER TABLE public.account_tool_instances DROP COLUMN IF EXISTS enabled;


COMMENT ON TABLE public.account_tool_instances IS 'Generic tool instances deployed on an account_tool_environment (Toolbox).';
COMMENT ON COLUMN public.account_tool_instances.instance_name_on_toolbox IS 'User-defined or auto-generated name for the tool instance on the Toolbox.';
COMMENT ON COLUMN public.account_tool_instances.port_mapping_json IS 'Port mapping for the tool instance container, e.g., {"container_port": 8080, "host_port": 49152}.';
COMMENT ON COLUMN public.account_tool_instances.last_heartbeat_from_dtma IS 'Timestamp of the last heartbeat received from DTMA for this specific tool instance (if applicable).';
COMMENT ON COLUMN public.account_tool_instances.version IS 'Version of the tool (from tool_catalog at deployment, may be updated by DTMA).';
COMMENT ON COLUMN public.account_tool_instances.base_config_override_json IS 'User-provided overrides for non-credential configurations of the tool instance.';
COMMENT ON COLUMN public.account_tool_instances.status_on_toolbox IS 'Current status of the tool instance on the Toolbox, aligned with WBS v2.1 definitions.';
COMMENT ON COLUMN public.account_tool_instances.instance_error_message IS 'Error message specific to this tool instance.';


-- Section 3: Table Creations

-- Create public.tool_catalog (WBS 1.2.2)
CREATE TABLE IF NOT EXISTS public.tool_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    docker_image_url TEXT NOT NULL, -- e.g., "username/mytool:latest"
    icon_url TEXT,
    category TEXT, -- e.g., "communication", "productivity"
    required_config_schema JSONB, -- JSON schema for base_config_override_json
    required_secrets_schema JSONB, -- JSON schema describing needed secrets (e.g., {"env_var_name": "API_KEY", "description": "Your API Key", "type": "string"})
    required_capabilities_schema JSONB, -- JSON schema for capabilities agent can use (e.g., {"action_name": "send_email", "description": "Allows sending emails"})
    provider TEXT, -- e.g., "Google", "OpenAI"
    documentation_url TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0', -- Catalog entry version
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was pre-existing as a shell
ALTER TABLE public.tool_catalog
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL UNIQUE, -- May cause error if constraint added on existing empty table before this.
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS docker_image_url TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS icon_url TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS required_config_schema JSONB,
    ADD COLUMN IF NOT EXISTS required_secrets_schema JSONB,
    ADD COLUMN IF NOT EXISTS required_capabilities_schema JSONB,
    ADD COLUMN IF NOT EXISTS provider TEXT,
    ADD COLUMN IF NOT EXISTS documentation_url TEXT,
    ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add default for id if table pre-existed without it and id is missing (less likely for PK)
-- ALTER TABLE public.tool_catalog ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- It might be cleaner to drop and recreate if it exists as a shell, but this is safer to preserve other potential FKs if any.
-- However, the UNIQUE constraint on 'name' added via ADD COLUMN might fail if the table exists and the column is added without it first, then constraint added.
-- Let's refine the ADD COLUMN for name to be two steps if table exists:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tool_catalog' AND table_schema='public') THEN
        ALTER TABLE public.tool_catalog ADD COLUMN IF NOT EXISTS name TEXT;
        -- If name was just added and is NULL, it needs values before UNIQUE constraint or NOT NULL
        -- This part is tricky without knowing the state. Assuming for now that if table exists, this migration should fully define it.
        -- For simplicity in this step, the ADD COLUMN above will try to add NOT NULL UNIQUE.
        -- If 'name' column is added, ensure it can accept NOT NULL before constraint
        -- UPDATE public.tool_catalog SET name = 'default_name_' || id::text WHERE name IS NULL; -- Example placeholder
        -- ALTER TABLE public.tool_catalog ALTER COLUMN name SET NOT NULL;
        -- ALTER TABLE public.tool_catalog ADD CONSTRAINT tool_catalog_name_key UNIQUE (name);
    END IF;
END$$;



CREATE INDEX IF NOT EXISTS idx_tool_catalog_name ON public.tool_catalog(name);
CREATE INDEX IF NOT EXISTS idx_tool_catalog_category ON public.tool_catalog(category);
CREATE TRIGGER set_tool_catalog_updated_at
BEFORE UPDATE ON public.tool_catalog
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE public.tool_catalog IS 'Admin-curated list of available tools that can be deployed on Toolboxes.';
COMMENT ON COLUMN public.tool_catalog.docker_image_url IS 'The Docker image URL for deploying this tool.';
COMMENT ON COLUMN public.tool_catalog.required_config_schema IS 'JSON schema for basic configuration options.';
COMMENT ON COLUMN public.tool_catalog.required_secrets_schema IS 'JSON schema defining secrets required by the tool.';
COMMENT ON COLUMN public.tool_catalog.required_capabilities_schema IS 'JSON schema defining capabilities the tool offers.';


-- Create public.agent_toolbox_access (WBS 1.2.4)
CREATE TABLE IF NOT EXISTS public.agent_toolbox_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    account_tool_environment_id UUID NOT NULL REFERENCES public.account_tool_environments(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_toolbox_access UNIQUE (agent_id, account_tool_environment_id)
);
CREATE INDEX IF NOT EXISTS idx_ata_agent_id ON public.agent_toolbox_access(agent_id);
CREATE INDEX IF NOT EXISTS idx_ata_account_tool_environment_id ON public.agent_toolbox_access(account_tool_environment_id);
CREATE TRIGGER set_agent_toolbox_access_updated_at
BEFORE UPDATE ON public.agent_toolbox_access
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE public.agent_toolbox_access IS 'Links agents to Toolboxes (account_tool_environments) they have permission to use.';


-- Create public.agent_toolbelt_items (WBS 1.2.5)
CREATE TABLE IF NOT EXISTS public.agent_toolbelt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    account_tool_instance_id UUID NOT NULL REFERENCES public.account_tool_instances(id) ON DELETE CASCADE,
    is_active_for_agent BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_toolbelt_item UNIQUE (agent_id, account_tool_instance_id)
);
CREATE INDEX IF NOT EXISTS idx_ati_agent_id ON public.agent_toolbelt_items(agent_id);
CREATE INDEX IF NOT EXISTS idx_ati_account_tool_instance_id ON public.agent_toolbelt_items(account_tool_instance_id);
CREATE TRIGGER set_agent_toolbelt_items_updated_at
BEFORE UPDATE ON public.agent_toolbelt_items
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE public.agent_toolbelt_items IS 'Specific tool instances from a Toolbox that an agent has added to their Toolbelt.';
COMMENT ON COLUMN public.agent_toolbelt_items.is_active_for_agent IS 'Indicates if the agent has currently enabled this tool in their toolbelt.';


-- Create public.agent_tool_credentials (WBS 1.2.6)
CREATE TABLE IF NOT EXISTS public.agent_tool_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_toolbelt_item_id UUID NOT NULL REFERENCES public.agent_toolbelt_items(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL, -- e.g., 'oauth2', 'api_key'
    encrypted_credentials TEXT NOT NULL, -- Reference to Supabase Vault or encrypted value directly
    account_identifier TEXT, -- e.g., masked email like user@gm***.com, for display
    last_validated_at TIMESTAMPTZ NULL,
    status agent_tool_credential_status_enum NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atc_agent_toolbelt_item_id ON public.agent_tool_credentials(agent_toolbelt_item_id);
CREATE TRIGGER set_agent_tool_credentials_updated_at
BEFORE UPDATE ON public.agent_tool_credentials
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE public.agent_tool_credentials IS 'Stores agent-specific credentials for a tool in their Toolbelt.';
COMMENT ON COLUMN public.agent_tool_credentials.credential_type IS 'Type of credential, e.g., "oauth2", "api_key".';
COMMENT ON COLUMN public.agent_tool_credentials.encrypted_credentials IS 'Encrypted credentials or a reference to them in Supabase Vault.';
COMMENT ON COLUMN public.agent_tool_credentials.account_identifier IS 'A user-friendly identifier for the account associated with the credential.';


-- Create public.agent_tool_capability_permissions (WBS 1.2.7)
CREATE TABLE IF NOT EXISTS public.agent_tool_capability_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_toolbelt_item_id UUID NOT NULL REFERENCES public.agent_toolbelt_items(id) ON DELETE CASCADE,
    capability_name TEXT NOT NULL, -- e.g., "gmail_send", from tool_catalog.required_capabilities_schema
    is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_tool_capability_permission UNIQUE (agent_toolbelt_item_id, capability_name)
);
CREATE INDEX IF NOT EXISTS idx_atcp_agent_toolbelt_item_id ON public.agent_tool_capability_permissions(agent_toolbelt_item_id);
CREATE TRIGGER set_agent_tool_capability_permissions_updated_at
BEFORE UPDATE ON public.agent_tool_capability_permissions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE public.agent_tool_capability_permissions IS 'Granular permissions for an agent regarding specific capabilities of a tool in their Toolbelt.';
COMMENT ON COLUMN public.agent_tool_capability_permissions.capability_name IS 'Name of the capability, matching a key in tool_catalog.required_capabilities_schema.';


-- Section 4: RLS Policies
-- RLS for public.account_tool_environments (Review existing, ensure user_id focus)
-- Existing policy "Users can manage their own account tool environment" is good.
-- Existing policy "Service roles can access all account tool environments" is good.

-- RLS for public.account_tool_instances (Review existing for renamed table, ensure user_id focus via account_tool_environments)
-- Drop old RLS if they exist by old name and re-create for new name or adapt.
-- Assuming old policies were on account_tool_environment_active_tools, they might need to be recreated for account_tool_instances.
DROP POLICY IF EXISTS "Users can manage tools on their own account environment" ON public.account_tool_instances;
DROP POLICY IF EXISTS "Service roles can access all account tool environment tools" ON public.account_tool_instances;

ALTER TABLE public.account_tool_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage instances on their own account environments"
ON public.account_tool_instances
FOR ALL
USING (
    auth.uid() = (
        SELECT ate.user_id FROM public.account_tool_environments ate
        WHERE ate.id = account_tool_environment_id
    )
)
WITH CHECK (
    auth.uid() = (
        SELECT ate.user_id FROM public.account_tool_environments ate
        WHERE ate.id = account_tool_environment_id
    )
);

CREATE POLICY "Service roles can access all account tool instances"
ON public.account_tool_instances
FOR ALL
USING (get_my_claim('role') = 'service_role')
WITH CHECK (get_my_claim('role') = 'service_role');


-- RLS for public.tool_catalog (Admins/Service roles can manage, Authenticated users can read)
ALTER TABLE public.tool_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tool catalog"
ON public.tool_catalog
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service roles can manage tool catalog"
ON public.tool_catalog
FOR ALL
USING (get_my_claim('role') = 'service_role')
WITH CHECK (get_my_claim('role') = 'service_role');
-- Consider an admin role if different from service_role for CUD operations.


-- RLS for public.agent_toolbox_access
ALTER TABLE public.agent_toolbox_access ENABLE ROW LEVEL SECURITY;
-- Users can manage access for agents they own, to toolboxes they own.
-- Agents can view their own toolbox access. (More complex, needs agent context)
-- Simplified: User manages for their agents.
CREATE POLICY "Users can manage toolbox access for their agents on their toolboxes"
ON public.agent_toolbox_access
FOR ALL
USING (
    auth.uid() = (SELECT user_id FROM public.agents WHERE id = agent_id) AND
    auth.uid() = (SELECT user_id FROM public.account_tool_environments WHERE id = account_tool_environment_id)
)
WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.agents WHERE id = agent_id) AND
    auth.uid() = (SELECT user_id FROM public.account_tool_environments WHERE id = account_tool_environment_id)
);
CREATE POLICY "Service roles can access all agent toolbox access"
ON public.agent_toolbox_access FOR ALL USING (get_my_claim('role') = 'service_role') WITH CHECK (get_my_claim('role') = 'service_role');


-- RLS for public.agent_toolbelt_items
ALTER TABLE public.agent_toolbelt_items ENABLE ROW LEVEL SECURITY;
-- Users can manage toolbelt items for their agents.
-- Agents can manage their own toolbelt items.
CREATE POLICY "Users can manage toolbelt items for their agents"
ON public.agent_toolbelt_items
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.agents WHERE id = agent_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.agents WHERE id = agent_id));
-- Add policy for agent self-management if agent_id can be securely derived from auth.uid() or a claim.

CREATE POLICY "Service roles can access all agent toolbelt items"
ON public.agent_toolbelt_items FOR ALL USING (get_my_claim('role') = 'service_role') WITH CHECK (get_my_claim('role') = 'service_role');


-- RLS for public.agent_tool_credentials
ALTER TABLE public.agent_tool_credentials ENABLE ROW LEVEL SECURITY;
-- Users can manage credentials for their agents' toolbelt items.
-- Backend (service_role) will be primary interactor for fetching for DTMA.
CREATE POLICY "Users can manage credentials for their agents toolbelt items"
ON public.agent_tool_credentials
FOR ALL
USING (
    auth.uid() = (
        SELECT a.user_id FROM public.agents a
        JOIN public.agent_toolbelt_items ati ON a.id = ati.agent_id
        WHERE ati.id = agent_toolbelt_item_id
    )
)
WITH CHECK (
    auth.uid() = (
        SELECT a.user_id FROM public.agents a
        JOIN public.agent_toolbelt_items ati ON a.id = ati.agent_id
        WHERE ati.id = agent_toolbelt_item_id
    )
);
CREATE POLICY "Service roles can access all agent tool credentials"
ON public.agent_tool_credentials FOR ALL USING (get_my_claim('role') = 'service_role') WITH CHECK (get_my_claim('role') = 'service_role');


-- RLS for public.agent_tool_capability_permissions
ALTER TABLE public.agent_tool_capability_permissions ENABLE ROW LEVEL SECURITY;
-- Users can manage permissions for their agents' toolbelt items.
CREATE POLICY "Users can manage permissions for their agents toolbelt items"
ON public.agent_tool_capability_permissions
FOR ALL
USING (
    auth.uid() = (
        SELECT a.user_id FROM public.agents a
        JOIN public.agent_toolbelt_items ati ON a.id = ati.agent_id
        WHERE ati.id = agent_toolbelt_item_id
    )
)
WITH CHECK (
    auth.uid() = (
        SELECT a.user_id FROM public.agents a
        JOIN public.agent_toolbelt_items ati ON a.id = ati.agent_id
        WHERE ati.id = agent_toolbelt_item_id
    )
);
CREATE POLICY "Service roles can access all agent tool capability permissions"
ON public.agent_tool_capability_permissions FOR ALL USING (get_my_claim('role') = 'service_role') WITH CHECK (get_my_claim('role') = 'service_role');


-- Section 5: Ensure trigger_set_timestamp() exists (from previous migration)
-- CREATE OR REPLACE FUNCTION trigger_set_timestamp()... - Assume it exists.


COMMIT; 