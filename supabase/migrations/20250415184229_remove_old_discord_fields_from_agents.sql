-- Drop unused discord fields from the agents table

-- Drop discord_app_id if it exists
ALTER TABLE public.agents
DROP COLUMN IF EXISTS discord_app_id;

-- Drop discord_public_key if it exists
ALTER TABLE public.agents
DROP COLUMN IF EXISTS discord_public_key;
