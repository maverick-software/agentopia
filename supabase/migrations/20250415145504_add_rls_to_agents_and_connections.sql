-- Migration to add Row-Level Security policies to agents and agent_discord_connections

-- === Policies for agents table ===

-- 1. Enable RLS on the agents table
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for table owners
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;

-- 3. Create CRUD policies based on user_id

-- Allow users to SELECT their own agents
CREATE POLICY "Allow individual user select access" 
ON public.agents FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to INSERT agents linked to their user_id
CREATE POLICY "Allow individual user insert"
ON public.agents FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own agents
CREATE POLICY "Allow individual user update"
ON public.agents FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own agents
CREATE POLICY "Allow individual user delete"
ON public.agents FOR DELETE
USING (auth.uid() = user_id);

-- === Policies for agent_discord_connections table ===

-- 1. Enable RLS on the connections table
ALTER TABLE public.agent_discord_connections ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for table owners
ALTER TABLE public.agent_discord_connections FORCE ROW LEVEL SECURITY;

-- 3. Create CRUD policies based on ownership of the linked agent

-- Allow owners to SELECT connections linked to their agents
CREATE POLICY "Allow owner select via agent"
ON public.agent_discord_connections FOR SELECT 
USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_discord_connections.agent_id AND agents.user_id = auth.uid()));

-- Allow owners to INSERT connections linked to their agents
CREATE POLICY "Allow owner insert via agent"
ON public.agent_discord_connections FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_discord_connections.agent_id AND agents.user_id = auth.uid()));

-- Allow owners to UPDATE connections linked to their agents
CREATE POLICY "Allow owner update via agent"
ON public.agent_discord_connections FOR UPDATE 
USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_discord_connections.agent_id AND agents.user_id = auth.uid())) 
WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_discord_connections.agent_id AND agents.user_id = auth.uid()));

-- Allow owners to DELETE connections linked to their agents
CREATE POLICY "Allow owner delete via agent"
ON public.agent_discord_connections FOR DELETE 
USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_discord_connections.agent_id AND agents.user_id = auth.uid()));
