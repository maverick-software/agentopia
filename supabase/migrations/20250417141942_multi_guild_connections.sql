-- Add the is_enabled column to track activation per guild
alter table public.agent_discord_connections
add column is_enabled boolean not null default true;

-- Add a unique constraint only for non-null guild_ids
-- This ensures an agent can only be associated with a specific guild once,
-- but allows rows where guild_id is NULL (representing pre-guild configuration).
create unique index agent_discord_connections_agent_guild_unique
on public.agent_discord_connections (agent_id, guild_id)
where guild_id is not null;

-- Optional: Add an index on is_enabled if queries will frequently filter by it
-- create index idx_agent_discord_connections_is_enabled on public.agent_discord_connections (is_enabled);

-- NOTE: We are NO LONGER dropping the original primary key or adding a composite primary key.
-- NOTE: We are NO LONGER deleting rows where guild_id is null.
