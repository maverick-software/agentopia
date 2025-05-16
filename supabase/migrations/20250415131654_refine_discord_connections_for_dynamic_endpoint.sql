-- Add columns required for dynamic interaction endpoints

-- Add the unique secret identifier for the connection
ALTER TABLE public.agent_discord_connections
ADD COLUMN interaction_secret TEXT NOT NULL;

-- Add the user-provided Discord Application ID
ALTER TABLE public.agent_discord_connections
ADD COLUMN discord_app_id TEXT NOT NULL;

-- Add the user-provided Discord Public Key
ALTER TABLE public.agent_discord_connections
ADD COLUMN discord_public_key TEXT NOT NULL;

-- (Optional but Recommended) Add user_id for ownership
-- Uncomment and adjust if your users table/schema is different (e.g., public.users)
-- ALTER TABLE public.agent_discord_connections
-- ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for efficient lookup

-- Index for looking up connection details by the secret in the URL
CREATE UNIQUE INDEX idx_agent_discord_connections_interaction_secret 
ON public.agent_discord_connections(interaction_secret);

-- Index for querying connections by server (useful for listing/management)
-- Might exist already depending on previous setup, but good to ensure
CREATE INDEX IF NOT EXISTS idx_agent_discord_connections_guild_id 
ON public.agent_discord_connections(guild_id);

-- (Optional but Recommended) Index for querying connections by user
-- Uncomment if user_id column is added
-- CREATE INDEX IF NOT EXISTS idx_agent_discord_connections_user_id 
-- ON public.agent_discord_connections(user_id);
