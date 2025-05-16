-- Helper function to check if a user is a member of a chat room (directly or via team)
-- Renamed from is_workspace_member
CREATE OR REPLACE FUNCTION public.is_chat_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Necessary to check tables the user might not have direct access to
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is a direct member
    SELECT 1
    FROM public.workspace_members wm -- Use workspace_members table
    WHERE wm.workspace_id = p_room_id AND wm.user_id = p_user_id
    UNION ALL
    -- Check if user is a member of a team that is a member of the workspace
    SELECT 1
    FROM public.workspace_members wm_teams -- Use workspace_members table
    JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id
    WHERE wm_teams.workspace_id = p_room_id AND utm.user_id = p_user_id
    -- TODO: Consider if agent ownership implies membership? For now, no.
  );
$$;

-- Drop existing policies (if any) before creating new ones
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow select for owner or member" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow update for owner only" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow delete for owner only" ON public.chat_rooms;

-- Enable RLS (should already be enabled, but ensure it)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms FORCE ROW LEVEL SECURITY; -- Ensure RLS applies even to table owners

-- Policies for chat_rooms table

-- Allow authenticated users to insert (owner set automatically)
CREATE POLICY "Allow insert for authenticated users" 
ON public.chat_rooms 
FOR INSERT 
TO authenticated 
WITH CHECK (true); -- Simple check, owner should be set by default value or trigger if needed

-- Allow users to select chat_rooms they own or are members of
CREATE POLICY "Allow select for owner or member" 
ON public.chat_rooms 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = owner_user_id OR public.is_chat_room_member(id, auth.uid())
);

-- Allow owners to update their chat_rooms
CREATE POLICY "Allow update for owner only" 
ON public.chat_rooms 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

-- Allow owners to delete their chat_rooms
CREATE POLICY "Allow delete for owner only" 
ON public.chat_rooms 
FOR DELETE 
TO authenticated 
USING (auth.uid() = owner_user_id);
