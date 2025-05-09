-- Add missing columns from initial design + configuration column
ALTER TABLE public.agent_droplets
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS configuration JSONB; -- Add configuration column as JSONB

COMMENT ON COLUMN public.agent_droplets.name IS 'The name of the droplet assigned during creation, usually includes agent ID.';
COMMENT ON COLUMN public.agent_droplets.tags IS 'Tags applied to the droplet in DigitalOcean, also stored for reference.';
COMMENT ON COLUMN public.agent_droplets.configuration IS 'Configuration used to provision the droplet (region, size, image, etc.).';

-- Add new columns for DTMA communication
ALTER TABLE public.agent_droplets
ADD COLUMN dtma_auth_token TEXT UNIQUE,
ADD COLUMN dtma_last_known_version TEXT,
ADD COLUMN dtma_last_reported_status JSONB;

COMMENT ON COLUMN public.agent_droplets.dtma_auth_token IS 'Secure authentication token for the Droplet Tool Management Agent to communicate with the backend.';
COMMENT ON COLUMN public.agent_droplets.dtma_last_known_version IS 'Last reported version of the DTMA software running on the droplet.';
COMMENT ON COLUMN public.agent_droplets.dtma_last_reported_status IS 'Last reported detailed status payload from the DTMA heartbeat.'; 