-- Enable Correct RLS Policies

-- Remove all existing incorrect/redundant policies first
DROP POLICY IF EXISTS "Allow anon worker read access" ON public.agents;
DROP POLICY IF EXISTS "Allow individual user delete" ON public.agents;
DROP POLICY IF EXISTS "Allow individual user insert" ON public.agents;
DROP POLICY IF EXISTS "Allow individual user select access" ON public.agents;
DROP POLICY IF EXISTS "Allow individual user update" ON public.agents;
DROP POLICY IF EXISTS "Users can create agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can read own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can update own agents" ON public.agents;

DROP POLICY IF EXISTS "Allow owner delete via agent" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow owner insert via agent" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow owner select via agent" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow owner update via agent" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow users to delete connections for their own agents" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow users to insert connections for their own agents" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow users to view their own agent connections" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow worker read own connection" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow worker self-update" ON public.agent_discord_connections;
DROP POLICY IF EXISTS "Allow worker update own status" ON public.agent_discord_connections;

-- Enable RLS (might already be enabled, but good practice to ensure)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_discord_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for 'agents' table (owned by users)
CREATE POLICY "Allow full access to own agents" ON public.agents
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policies for 'agent_discord_connections' table (access based on agent ownership)
-- Helper function to check agent ownership (reduces policy complexity)
CREATE OR REPLACE FUNCTION public.is_agent_owner(agent_id_to_check uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Important: Runs as the function creator, allowing access to 'agents' table
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agents
    WHERE id = agent_id_to_check AND user_id = auth.uid()
  );
$$;

-- Grant execute permission on the helper function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_agent_owner(uuid) TO authenticated;

-- Apply policy using the helper function
CREATE POLICY "Allow full access to connections for own agents" ON public.agent_discord_connections
FOR ALL
TO authenticated
USING (public.is_agent_owner(agent_id))
WITH CHECK (public.is_agent_owner(agent_id));

-- Note: No policies are needed for the 'anon' or 'service_role' roles here,
-- as worker status updates should happen ONLY via the SECURITY DEFINER RPC function
-- 'update_worker_status'. Direct worker access via RLS is removed.
