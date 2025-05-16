-- RLS Policies for the 'teams' table

-- 1. SELECT Policy: Allow any authenticated user to read any team for now.
--    Refine later if necessary (e.g., only show teams the user is a member of).
CREATE POLICY "Allow authenticated read access to teams" ON public.teams
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. INSERT Policy: Allow any authenticated user to create a team.
--    Set the owner_user_id to the creator's ID automatically.
CREATE POLICY "Allow authenticated users to create teams" ON public.teams
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add default owner_user_id on insert using a trigger (more robust than relying on client)
CREATE OR REPLACE FUNCTION public.set_team_owner()
RETURNS TRIGGER AS $$
BEGIN
    NEW.owner_user_id = auth.uid();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists (idempotency)
DROP TRIGGER IF EXISTS trigger_set_team_owner ON public.teams;

CREATE TRIGGER trigger_set_team_owner
BEFORE INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.set_team_owner();

-- 3. UPDATE Policy: Allow the owner to update the team.
--    TODO: Decide if global admins should also be allowed to update.
CREATE POLICY "Allow owner to update their teams" ON public.teams
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- 4. DELETE Policy: Allow the owner OR a global admin to delete the team.
--    Requires a helper function to check for global admin role.

-- Helper function to check if the current user has a specific global role (e.g., 'admin')
-- This assumes you have a 'user_roles' and 'roles' table setup like in AuthContext.
CREATE OR REPLACE FUNCTION public.is_global_admin(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'admin'
  ) INTO is_admin;
  RETURN is_admin;
END;
$$ language 'plpgsql' SECURITY DEFINER;
-- SECURITY DEFINER is important if the user_roles/roles tables have stricter RLS

-- DELETE Policy using the helper function
CREATE POLICY "Allow owner or global admin to delete teams" ON public.teams
  FOR DELETE
  USING (
    auth.uid() = owner_user_id 
    OR public.is_global_admin(auth.uid()) -- Check if the current user is a global admin
  );

-- Grant usage on the helper function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;
