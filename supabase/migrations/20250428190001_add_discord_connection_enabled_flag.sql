-- Add the is_enabled column to track connection status per guild, defaulting to true
-- ALTER TABLE public.agent_discord_connections
-- ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.agent_discord_connections.is_enabled IS 'Tracks whether the Discord connection is enabled for the specific agent-guild pair.';

-- Create a unique index to ensure only one connection record exists per agent
-- for any specific guild_id (where guild_id is not NULL).
-- This allows storing connection details even before a guild is assigned (guild_id IS NULL)
-- while preventing duplicate entries once a guild is associated.
CREATE UNIQUE INDEX agent_discord_connections_agent_guild_unique
ON public.agent_discord_connections (agent_id, guild_id)
WHERE guild_id IS NOT NULL;

COMMENT ON INDEX public.agent_discord_connections_agent_guild_unique IS 'Ensures uniqueness for agent_id and guild_id pairs only when guild_id is not NULL.'; 