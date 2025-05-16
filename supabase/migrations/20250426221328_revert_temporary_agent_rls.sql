-- Revert temporary RLS policy for agents table

-- Drop the temporary permissive SELECT policy
DROP POLICY IF EXISTS "TEMP Allow read access to all agents" ON public.agents;

-- Restore the correct SELECT policy (Allow owner or admin read)
CREATE POLICY "Allow read access to own agents or if admin" ON public.agents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    public.user_has_role(auth.uid(), 'admin')
  );

-- NOTE: The "Allow modify access to own agents" policy (for INSERT/UPDATE/DELETE) was not changed and remains active.