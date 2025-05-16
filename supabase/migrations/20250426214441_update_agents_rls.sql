-- Update RLS Policies for agents table

-- Drop the existing combined policy
DROP POLICY IF EXISTS "Allow full access to own agents" ON public.agents;

-- 1. SELECT Policy: Allow reading own agents OR if the user is a global admin.
CREATE POLICY "Allow read access to own agents or if admin" ON public.agents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    public.user_has_role(auth.uid(), 'admin')
  );

-- 2. INSERT/UPDATE/DELETE Policy: Only allow modifying own agents.
CREATE POLICY "Allow modify access to own agents" ON public.agents
  FOR ALL -- Applies to INSERT, UPDATE, DELETE
  TO authenticated
  USING (auth.uid() = user_id)      -- For UPDATE/DELETE checks
  WITH CHECK (auth.uid() = user_id); -- For INSERT/UPDATE checks
