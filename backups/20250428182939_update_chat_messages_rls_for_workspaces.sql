-- Drop the old helper function and related policies first
DROP POLICY IF EXISTS "Allow room members to read channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow room members to insert channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Disallow updates to channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow room owner to delete channel messages" ON public.chat_messages;
DROP FUNCTION IF EXISTS public.get_room_id_for_channel(uuid);

-- Renamed Policies:
DROP POLICY IF EXISTS "Allow workspace members to read channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow workspace members to insert channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Disallow updates to channel messages" ON public.chat_messages; -- Keeping this one
DROP POLICY IF EXISTS "Allow workspace managers to delete channel messages" ON public.chat_messages;

-- Helper function to get the workspace_id (currently room_id) for a given channel_id
CREATE OR REPLACE FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE -- Function is read-only
SECURITY DEFINER -- Needed to read chat_channels potentially restricted by RLS
SET search_path = public
AS $$
  SELECT room_id -- Select the column using its name *before* the rename
  FROM chat_channels
  WHERE id = p_channel_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_workspace_id_for_channel(uuid) TO authenticated;

-- Ensure the is_workspace_member and can_manage_workspace_members helpers exist (created previously)
-- These helpers should reference the table/columns as they exist *after* the rename
-- CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid) ...
-- CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid) ...

-- RLS Policies for chat_messages table

-- 1. SELECT Policy: Allow members of the parent workspace to read messages in a channel.
CREATE POLICY "Allow workspace members to read channel messages" ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid())
  );

-- 2. INSERT Policy: Allow members of the parent workspace to insert messages into a channel.
CREATE POLICY "Allow workspace members to insert channel messages" ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid())
    AND (
      (sender_user_id IS NOT NULL AND sender_user_id = auth.uid()) -- User is sending
      OR sender_agent_id IS NOT NULL -- Agent is sending (agent permissions handled elsewhere)
    )
  );

-- 3. UPDATE Policy: Disallow updates generally.
CREATE POLICY "Disallow updates to channel messages" ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (false);

-- 4. DELETE Policy: Allow workspace owners or moderators to delete messages.
CREATE POLICY "Allow workspace managers to delete channel messages" ON public.chat_messages
  FOR DELETE
  TO authenticated
  USING (
    public.can_manage_workspace_members(public.get_workspace_id_for_channel(channel_id), auth.uid())
  );
