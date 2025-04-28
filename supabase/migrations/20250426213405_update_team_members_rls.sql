-- Helper function: Check if the current user is the owner of a specific team
CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = p_team_id AND t.owner_user_id = p_user_id
  ) INTO is_owner;
  RETURN is_owner;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid, uuid) TO authenticated;

-- Update RLS Policies for team_members

-- Drop existing policies first to redefine them
DROP POLICY IF EXISTS "Allow team members to read member list" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins/pms to add members" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins/pms to remove members" ON public.team_members;
DROP POLICY IF EXISTS "Allow team admins/pms to update members" ON public.team_members;

-- 1. SELECT Policy: Allow global admins, team owners, or team members to read.
CREATE POLICY "Allow read access to team members" ON public.team_members
  FOR SELECT
  USING (
    public.user_has_role(auth.uid(), 'admin') OR
    public.is_team_owner(team_id, auth.uid()) OR
    public.is_team_member(team_id, auth.uid())
  );

-- 2. INSERT Policy: Allow global admins or team owners to add members.
CREATE POLICY "Allow insert access for team owners/admins" ON public.team_members
  FOR INSERT
  WITH CHECK (
    public.user_has_role(auth.uid(), 'admin') OR
    public.is_team_owner(team_id, auth.uid())
  );

-- 3. DELETE Policy: Allow global admins or team owners to remove members.
CREATE POLICY "Allow delete access for team owners/admins" ON public.team_members
  FOR DELETE
  USING (
    public.user_has_role(auth.uid(), 'admin') OR
    public.is_team_owner(team_id, auth.uid())
  );

-- 4. UPDATE Policy: Allow global admins or team owners to update members.
CREATE POLICY "Allow update access for team owners/admins" ON public.team_members
  FOR UPDATE
  USING (
    public.user_has_role(auth.uid(), 'admin') OR
    public.is_team_owner(team_id, auth.uid())
  )
  WITH CHECK (
    public.user_has_role(auth.uid(), 'admin') OR
    public.is_team_owner(team_id, auth.uid())
  );
