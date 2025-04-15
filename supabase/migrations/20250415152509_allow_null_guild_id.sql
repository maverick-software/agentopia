-- Migration to allow NULL values for guild_id in agent_discord_connections

-- Alter the guild_id column to remove the NOT NULL constraint (if it exists)
ALTER TABLE public.agent_discord_connections
ALTER COLUMN guild_id DROP NOT NULL;

-- Update comment to reflect the change
COMMENT ON COLUMN public.agent_discord_connections.guild_id IS 'Discord Server ID the agent connection is linked to (can be NULL initially).';
