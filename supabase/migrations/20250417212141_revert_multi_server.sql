-- Revert Multi-Server Functionality

-- 1. Remove the unique index that allowed multiple entries per agent (for different guilds)
DROP INDEX IF EXISTS public.agent_discord_connections_agent_guild_unique;

-- 2. Re-add the unique constraint on agent_id to enforce only one connection record per agent
ALTER TABLE public.agent_discord_connections
ADD CONSTRAINT agent_discord_connections_agent_id_key UNIQUE (agent_id);

-- Note: Keeping the 'is_enabled' column for now, as it might still be relevant for the single connection. 