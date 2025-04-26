-- Migration to align the database schema with the visual diagram (DATABASE_SCHEMA.png) as the source of truth
-- Note: Assumes data loss in altered/dropped columns is acceptable.

BEGIN;

-- 1. User Profiles Table Alignment (Corrected - Table already named user_profiles)
-- Add username column if it doesn't exist
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username text;
-- Drop role_id column if it exists (replaced by user_roles table)
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS role_id;

-- 2. User Roles Table Alignment
-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, role_id)
);
-- Add comments for clarity
COMMENT ON TABLE public.user_roles IS 'Links users to their assigned roles.';

-- 3. Team Members Table Alignment (Focus on Agents)
-- Drop incorrect columns from previous migration if they exist
ALTER TABLE public.team_members DROP COLUMN IF EXISTS role;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS created_at; -- Replaced by joined_at
-- Add/Ensure Agent-focused columns from diagram exist
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS team_role text;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS team_role_description text;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS reports_to_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT timezone('utc'::text, now());
-- Drop user_id column as this table is for Agents
ALTER TABLE public.team_members DROP COLUMN IF EXISTS user_id;
-- Potentially make agent_id NOT NULL if required
-- ALTER TABLE public.team_members ALTER COLUMN agent_id SET NOT NULL;
-- Add comments
COMMENT ON TABLE public.team_members IS 'Links Agents to Teams and defines their role/reporting structure within the team.';
COMMENT ON COLUMN public.team_members.agent_id IS 'The agent who is a member of the team.';
COMMENT ON COLUMN public.team_members.team_role IS 'The role of the agent within the team.';
COMMENT ON COLUMN public.team_members.reports_to_agent_id IS 'Optional: The agent this team member reports to.';
COMMENT ON COLUMN public.team_members.joined_at IS 'Timestamp when the agent joined the team.';


-- 4. Agents Table Alignment
-- Drop columns from migrations not in diagram
ALTER TABLE public.agents DROP COLUMN IF EXISTS personality;
ALTER TABLE public.agents DROP COLUMN IF EXISTS active;
-- Add columns from diagram if they don't exist
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS system_instructions text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS assistant_instructions text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS discord_channel text; -- As per diagram
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS discord_bot_key text; -- As per diagram (Vault?)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS discord_bot_token_id text; -- As per diagram (Vault?)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS discord_user_id text; -- As per diagram

-- 5. Agent Discord Connections Alignment
-- Ensure guild_id exists (Correct representation, despite diagram showing channel_id)
ALTER TABLE public.agent_discord_connections ADD COLUMN IF NOT EXISTS guild_id text;
-- Drop channel_id if it exists (Deprecated/Incorrect for this table context)
ALTER TABLE public.agent_discord_connections DROP COLUMN IF EXISTS channel_id;

-- 6. Agent Datastores Alignment
-- Ensure ID column is standard UUID PK if needed (diagram shows 'id' PK)
-- Assuming previous migration used agent_id, datastore_id as PK.
-- If 'id uuid PK' is desired, existing PK needs dropping and new one added.
-- Example (Needs verification of current PK): 
-- ALTER TABLE public.agent_datastores DROP CONSTRAINT IF EXISTS agent_datastores_pkey;
-- ALTER TABLE public.agent_datastores ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid();

-- Add comments for other tables if desired (Optional)

COMMIT; 