-- RLS Policies for the 'team_members' table

-- Helper function: Check if the current user is a member of a specific team
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_member boolean;
BEGIN
  -- Check if the user owns any agent that is part of the team
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.agents a ON tm.agent_id = a.id
    WHERE tm.team_id = p_team_id AND a.user_id = p_user_id
  ) INTO is_member;
  RETURN is_member;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Helper function: Check if the current user has an admin/pm role within a specific team
CREATE OR REPLACE FUNCTION public.is_team_admin_or_pm(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_admin_or_pm boolean;
BEGIN
  -- Check if the user owns an agent in the team with role 'project_manager' (or potentially 'admin')
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.agents a ON tm.agent_id = a.id
    WHERE tm.team_id = p_team_id
      AND a.user_id = p_user_id
      AND tm.team_role IN ('project_manager') -- Add 'admin' here if you define such a team role
  ) INTO is_admin_or_pm;
  RETURN is_admin_or_pm;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin_or_pm(uuid, uuid) TO authenticated;

-- 1. SELECT Policy: Allow team members to read their own team's member list.
CREATE POLICY "Allow team members to read member list" ON public.team_members
  FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()));

-- 2. INSERT Policy: Allow admins/PMs of the team to add new members.
CREATE POLICY "Allow team admins/pms to add members" ON public.team_members
  FOR INSERT
  WITH CHECK (public.is_team_admin_or_pm(team_id, auth.uid()));

-- 3. DELETE Policy: Allow admins/PMs of the team to remove members.
CREATE POLICY "Allow team admins/pms to remove members" ON public.team_members
  FOR DELETE
  USING (public.is_team_admin_or_pm(team_id, auth.uid()));

-- 4. UPDATE Policy: Allow admins/PMs to update any member, OR allow a user to update their own agent's role/reporting?
--    Let's start simple: Allow Admins/PMs to update roles/reporting.
--    Self-update could be added later if needed.
CREATE POLICY "Allow team admins/pms to update members" ON public.team_members
  FOR UPDATE
  USING (public.is_team_admin_or_pm(team_id, auth.uid()))
  WITH CHECK (public.is_team_admin_or_pm(team_id, auth.uid()));

-- Note: Consider if the agent being added needs to belong to the user adding them,
-- or if a PM can add any agent they have access to. The current INSERT policy allows
-- adding any agent as long as the current user is the PM/Admin of that team.
