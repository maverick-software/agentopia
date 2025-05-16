-- Migration: Add RLS Policies for MCP Tables

-- Enable RLS on the new tables
ALTER TABLE public.mcp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- Policy for mcp_configurations: Allow access if user owns the linked agent
CREATE POLICY "Allow access to own agent MCP configurations"
ON public.mcp_configurations
FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
USING (
  -- Check if the current user owns the agent linked to this config
  EXISTS (
    SELECT 1
    FROM public.agents a
    WHERE a.id = mcp_configurations.agent_id
      AND a.user_id = auth.uid() -- Compare agent owner to current user
  )
)
WITH CHECK (
  -- Ensure inserted/updated configs are linked to an agent the user owns
  EXISTS (
    SELECT 1
    FROM public.agents a
    WHERE a.id = mcp_configurations.agent_id
      AND a.user_id = auth.uid()
  )
);

-- Policy for mcp_servers: Allow access if user owns the agent linked to the parent config
CREATE POLICY "Allow access to own agent MCP servers"
ON public.mcp_servers
FOR ALL
USING (
  -- Check if the current user owns the agent linked to the parent config
  EXISTS (
    SELECT 1
    FROM public.mcp_configurations mc
    JOIN public.agents a ON mc.agent_id = a.id
    WHERE mc.id = mcp_servers.config_id -- Link server to config
      AND a.user_id = auth.uid()        -- Compare agent owner to current user
  )
)
WITH CHECK (
  -- Ensure inserted/updated servers are linked to a config the user owns
  EXISTS (
    SELECT 1
    FROM public.mcp_configurations mc
    JOIN public.agents a ON mc.agent_id = a.id
    WHERE mc.id = mcp_servers.config_id
      AND a.user_id = auth.uid()
  )
); 