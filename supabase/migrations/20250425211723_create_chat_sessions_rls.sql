-- RLS Policies for the 'chat_sessions' table

-- Ensure the helper function exists (created in team_members RLS migration)
-- CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid) ...

-- 1. SELECT Policy: Allow users to see chat sessions only for teams they are a member of.
CREATE POLICY "Allow team members to read chat sessions" ON public.chat_sessions
  FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()));

-- 2. INSERT Policy: Allow users to create chat sessions only for teams they are a member of.
CREATE POLICY "Allow team members to create chat sessions" ON public.chat_sessions
  FOR INSERT
  WITH CHECK (public.is_team_member(team_id, auth.uid()));

-- 3. UPDATE Policy: Who can update a session? (e.g., rename it)
--    Let's allow team admins/pms for now.
--    Ensure is_team_admin_or_pm function exists (created in team_members RLS migration)
CREATE POLICY "Allow team admins/pms to update chat sessions" ON public.chat_sessions
  FOR UPDATE
  USING (public.is_team_admin_or_pm(team_id, auth.uid()))
  WITH CHECK (public.is_team_admin_or_pm(team_id, auth.uid()));

-- 4. DELETE Policy: Who can delete a session?
--    Let's also restrict this to team admins/pms for now.
CREATE POLICY "Allow team admins/pms to delete chat sessions" ON public.chat_sessions
  FOR DELETE
  USING (public.is_team_admin_or_pm(team_id, auth.uid()));
