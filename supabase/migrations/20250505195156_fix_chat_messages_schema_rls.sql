-- Migration to align chat_messages with workspace/channel structure

BEGIN;

-- 1. Drop the trigger and function related to chat_sessions.last_message_at (if they exist)
DROP TRIGGER IF EXISTS trigger_update_session_last_message_at ON public.chat_messages;
DROP FUNCTION IF EXISTS public.update_session_last_message_at();

-- 2. Drop old RLS policies and helper function (if they exist) 
--    These were based on session_id/chat_sessions/teams
DROP POLICY IF EXISTS "Allow team members to read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow team members to insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow team admins/pms to delete chat messages" ON public.chat_messages;
DROP FUNCTION IF EXISTS public.get_team_id_for_session(uuid);

-- 3. Drop old foreign key constraint and index on session_id (if they exist)
--    NOTE: Constraint name might differ if created manually or by older migrations.
--    Check pg_constraint if this fails.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;
DROP INDEX IF EXISTS idx_chat_messages_session_id_created_at;

-- 4. Rename the column - COMMENTED OUT assuming it was already done by a previous (possibly unrecorded) migration
-- ALTER TABLE public.chat_messages RENAME COLUMN session_id TO channel_id;

-- 5. Add the new foreign key constraint referencing chat_channels
--    Drop the constraint first IF it exists, then add it.
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_channel_id_fkey;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id)
REFERENCES public.chat_channels(id) ON DELETE CASCADE;

-- 6. Create new index on channel_id (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id_created_at ON public.chat_messages(channel_id, created_at ASC);

-- 7. Recreate RLS policies based on workspace membership via channel_id

-- Drop potentially existing workspace-based policies first to ensure idempotency
DROP POLICY IF EXISTS "Allow workspace members to read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow workspace members to insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow workspace owner to delete messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Disallow updates to chat messages" ON public.chat_messages;
DROP FUNCTION IF EXISTS public.get_workspace_id_for_channel(uuid);
DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid, uuid);

-- Helper function to get workspace_id from channel_id.
CREATE OR REPLACE FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid)
RETURNS uuid AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.chat_channels
  WHERE id = p_channel_id;
  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_workspace_id_for_channel(uuid) TO authenticated;

-- Helper function to check workspace ownership.
CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_user_id INTO v_owner_id
  FROM public.workspaces
  WHERE id = p_workspace_id;
  RETURN v_owner_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;


-- SELECT Policy: Allow workspace members to read messages.
CREATE POLICY "Allow workspace members to read messages" ON public.chat_messages
  FOR SELECT
  USING (
    public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid())
  );

-- INSERT Policy: Allow workspace members to insert messages.
CREATE POLICY "Allow workspace members to insert messages" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid())
    AND (
      (sender_user_id IS NOT NULL AND sender_user_id = auth.uid()) -- User is sending
      OR sender_agent_id IS NOT NULL -- Agent is sending (Assume authorized via edge function)
    )
  );

-- DELETE Policy: Allow workspace owners to delete messages.
CREATE POLICY "Allow workspace owner to delete messages" ON public.chat_messages
  FOR DELETE
  USING (
    public.is_workspace_owner(public.get_workspace_id_for_channel(channel_id), auth.uid())
  );

-- UPDATE Policy: Disallow updates.
CREATE POLICY "Disallow updates to chat messages" ON public.chat_messages
  FOR UPDATE
  USING (false);


COMMIT; 