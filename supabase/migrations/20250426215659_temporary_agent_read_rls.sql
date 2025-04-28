-- Temporarily update agents RLS for testing joins

-- Drop the previous SELECT policy
DROP POLICY IF EXISTS "Allow read access to own agents or if admin" ON public.agents;

-- Create a TEMPORARY permissive SELECT policy
-- Allows any authenticated user to read any agent.
-- WARNING: This is for testing only. Revert this policy later.
CREATE POLICY "TEMP Allow read access to all agents" ON public.agents
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- NOTE: The "Allow modify access to own agents" policy (for INSERT/UPDATE/DELETE) remains unchanged.
