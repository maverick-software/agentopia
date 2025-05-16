-- Drop the conflicting unique constraint on agent_id
-- The name agent_discord_connections_agent_id_key is inferred from the error message
ALTER TABLE public.agent_discord_connections
DROP CONSTRAINT IF EXISTS agent_discord_connections_agent_id_key;

-- The existing unique index agent_discord_connections_agent_guild_unique
-- already ensures uniqueness for non-null guild_ids per agent.
