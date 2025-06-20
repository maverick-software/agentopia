-- Migration: Add droplet name synchronization
-- Date: 2025-01-19
-- Purpose: Sync actual DigitalOcean droplet names with Agentopia database

-- Add column to store the actual DigitalOcean droplet name
ALTER TABLE public.account_tool_environments 
ADD COLUMN IF NOT EXISTS do_droplet_name TEXT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.account_tool_environments.do_droplet_name IS 'The actual name assigned by DigitalOcean (may differ from intended name due to conflicts or DO policies)';

-- Add index for efficient lookups by droplet name
CREATE INDEX IF NOT EXISTS idx_ate_do_droplet_name ON public.account_tool_environments(do_droplet_name);

-- Update existing records to set do_droplet_name to current name field (as fallback)
UPDATE public.account_tool_environments 
SET do_droplet_name = name 
WHERE do_droplet_name IS NULL AND name IS NOT NULL; 