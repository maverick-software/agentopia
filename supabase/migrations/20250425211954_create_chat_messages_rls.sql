-- RLS Policies for the 'chat_messages' table

-- Ensure the helper function exists (created in team_members RLS migration)
-- CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid) ...

-- Helper function to get the team_id associated with a session_id
CREATE OR REPLACE FUNCTION public.get_team_id_for_session(p_session_id uuid)
RETURNS uuid AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT team_id INTO v_team_id
  FROM public.chat_sessions
  WHERE id = p_session_id;
  RETURN v_team_id;
END;
$$ language 'plpgsql' SECURITY DEFINER;
-- SECURITY DEFINER needed if chat_sessions has RLS that prevents direct lookup otherwise

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_team_id_for_session(uuid) TO authenticated;

-- 1. SELECT Policy: Allow users to read messages only in sessions belonging to teams they are members of.
CREATE POLICY "Allow team members to read chat messages" ON public.chat_messages
  FOR SELECT
  USING (
    public.is_team_member(public.get_team_id_for_session(session_id), auth.uid())
  );

-- 2. INSERT Policy: Allow users to insert messages only into sessions belonging to teams they are members of.
--    Also, ensure the sender_user_id matches the authenticated user.
CREATE POLICY "Allow team members to insert chat messages" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    public.is_team_member(public.get_team_id_for_session(session_id), auth.uid())
    AND (
      (sender_user_id IS NOT NULL AND sender_user_id = auth.uid()) -- User is sending
      OR sender_agent_id IS NOT NULL -- Agent is sending (needs separate auth mechanism/trusted caller)
      -- TODO: Add check for agent sender authorization if necessary
    )
  );

-- 3. UPDATE Policy: Generally, messages shouldn't be updatable by users.
--    Maybe allow updating the 'embedding' or 'metadata' field later by specific processes?
--    For now, disallow updates.
--    CREATE POLICY "Disallow updates to chat messages" ON public.chat_messages FOR UPDATE USING (false);

-- 4. DELETE Policy: Who can delete messages?
--    Restrictive: Maybe only team admins/pms, or potentially nobody via RLS.
--    Let's start by allowing team admins/pms to delete.
--    Ensure is_team_admin_or_pm function exists (created in team_members RLS migration)
CREATE POLICY "Allow team admins/pms to delete chat messages" ON public.chat_messages
  FOR DELETE
  USING (
    public.is_team_admin_or_pm(public.get_team_id_for_session(session_id), auth.uid())
  );
