-- Migration to allow NULL values for channel_id in agent_discord_connections

-- Alter the channel_id column to remove the NOT NULL constraint (if it exists)
ALTER TABLE public.agent_discord_connections
ALTER COLUMN channel_id DROP NOT NULL;

-- Update comment to reflect the change
COMMENT ON COLUMN public.agent_discord_connections.channel_id IS 'Discord Channel ID the agent connection is linked to (can be NULL initially).';
