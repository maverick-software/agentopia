-- Migration to modify chat_messages table to use channel_id instead of session_id

-- 1. Drop existing foreign key constraint on session_id
-- Note: Constraint name might vary if not explicitly named. Assuming default naming pattern.
-- Use \d chat_messages in psql or Supabase Studio to confirm if needed.
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

-- 2. Rename the session_id column to channel_id
ALTER TABLE public.chat_messages
RENAME COLUMN session_id TO channel_id;

-- 3. Add new foreign key constraint referencing chat_channels(id)
ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_channel_id_fkey
FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;

-- 4. Update helper function to get team_id from channel_id

-- First, drop existing policies using the old function
DROP POLICY IF EXISTS "Allow team members to read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow team members to insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow team admins/pms to delete chat messages" ON public.chat_messages;

-- Now drop the old function
DROP FUNCTION IF EXISTS public.get_team_id_for_session(uuid);

-- Create the new function
CREATE OR REPLACE FUNCTION public.get_team_id_for_channel(p_channel_id uuid)
RETURNS uuid AS $$
DECLARE
  v_room_id uuid;
  v_team_id uuid;
BEGIN
  -- Get room_id from channel
  SELECT room_id INTO v_room_id
  FROM public.chat_channels
  WHERE id = p_channel_id;

  -- Get team_id from room
  IF v_room_id IS NOT NULL THEN
    SELECT team_id INTO v_team_id
    FROM public.chat_rooms
    WHERE id = v_room_id;
  END IF;

  RETURN v_team_id;
END;
$$ LANGUAGE 'plpgsql' SECURITY DEFINER STABLE; -- STABLE indicates the function cannot modify the database

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_team_id_for_channel(uuid) TO authenticated;

-- 5. Update RLS policies
-- Recreate policies using channel_id and the new helper function
CREATE POLICY "Allow team members to read chat messages" ON public.chat_messages
  FOR SELECT
  USING (
    public.is_team_member(public.get_team_id_for_channel(channel_id), auth.uid())
  );

CREATE POLICY "Allow team members to insert chat messages" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    public.is_team_member(public.get_team_id_for_channel(channel_id), auth.uid())
    AND (
      (sender_user_id IS NOT NULL AND sender_user_id = auth.uid())
      OR sender_agent_id IS NOT NULL
    )
  );

CREATE POLICY "Allow team admins/pms to delete chat messages" ON public.chat_messages
  FOR DELETE
  USING (
    public.is_team_admin_or_pm(public.get_team_id_for_channel(channel_id), auth.uid())
  );

-- 6. Update Index using channel_id
DROP INDEX IF EXISTS public.idx_chat_messages_session_id_created_at;
CREATE INDEX idx_chat_messages_channel_id_created_at ON public.chat_messages(channel_id, created_at ASC);

-- 7. Update trigger function to update chat_channels

-- First, drop the old trigger that uses the old function
DROP TRIGGER IF EXISTS trigger_update_session_last_message_at ON public.chat_messages;

-- Now, drop the old function
DROP FUNCTION IF EXISTS public.update_session_last_message_at();

-- Create the new function
CREATE OR REPLACE FUNCTION public.update_channel_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create the new trigger using the new function
CREATE TRIGGER trigger_update_channel_last_message_at
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_channel_last_message_at();

-- Re-grant execute permission on the trigger function
GRANT EXECUTE ON FUNCTION public.update_channel_last_message_at() TO authenticated;

-- 9. Re-add table to realtime publication if necessary (usually handled automatically by Supabase)
-- This ensures Realtime continues to work after potential schema changes.
-- Check Supabase dashboard -> Database -> Replication if issues arise.
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
-- Commented out as likely not needed, but keep for reference. 