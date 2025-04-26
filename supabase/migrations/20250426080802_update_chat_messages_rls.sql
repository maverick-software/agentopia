-- Migration to update RLS policies for chat_messages based on channel_id and room membership

-- Drop existing RLS policies on chat_messages if they exist
-- (Use IF EXISTS to avoid errors if they were already dropped or renamed)
DROP POLICY IF EXISTS "Allow team members to read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow team members to insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow team admins/pms to delete chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Disallow updates to chat messages" ON public.chat_messages; -- If this was ever created

-- Drop the old helper function if it exists
DROP FUNCTION IF EXISTS public.get_team_id_for_session(uuid);

-- Helper function to get the room_id for a given channel_id
CREATE OR REPLACE FUNCTION public.get_room_id_for_channel(p_channel_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE -- Function is read-only
SECURITY DEFINER -- Needed to read chat_channels potentially restricted by RLS
SET search_path = public
AS $$
  SELECT room_id
  FROM chat_channels
  WHERE id = p_channel_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_room_id_for_channel(uuid) TO authenticated;

-- Ensure the is_room_member helper exists (created in chat_rooms RLS migration)
-- CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid) ...

-- 1. SELECT Policy: Allow members of the parent room to read messages in a channel.
CREATE POLICY "Allow room members to read channel messages" ON public.chat_messages
  FOR SELECT
  USING (
    public.is_room_member(public.get_room_id_for_channel(channel_id), auth.uid())
  );

-- 2. INSERT Policy: Allow members of the parent room to insert messages into a channel.
--    Ensure the sender matches the authenticated user or is an agent.
CREATE POLICY "Allow room members to insert channel messages" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    public.is_room_member(public.get_room_id_for_channel(channel_id), auth.uid())
    AND (
      (sender_user_id IS NOT NULL AND sender_user_id = auth.uid()) -- User is sending
      OR sender_agent_id IS NOT NULL -- Agent is sending (assuming agents operate under service role or specific permissions)
      -- Agent authorization check might be needed depending on implementation
    )
  );

-- 3. UPDATE Policy: Disallow updates generally.
CREATE POLICY "Disallow updates to channel messages" ON public.chat_messages
  FOR UPDATE
  USING (false);

-- 4. DELETE Policy: Allow the room owner to delete messages.
--    (Alternative: allow message author to delete own messages within a time window - more complex)
CREATE POLICY "Allow room owner to delete channel messages" ON public.chat_messages
  FOR DELETE
  USING (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        JOIN public.chat_channels cc ON cr.id = cc.room_id
        WHERE cc.id = chat_messages.channel_id
        AND cr.owner_user_id = auth.uid()
    )
  ); 