-- Ensure the is_workspace_member function exists (defined in previous migration)
-- CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid) ...

-- Helper function to check if user can manage members (is owner or moderator)
-- Renamed from can_manage_workspace_members
CREATE OR REPLACE FUNCTION public.can_manage_chat_room_members(p_room_id uuid, p_user_id uuid) 
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is the chat_room owner
    SELECT 1
    FROM public.chat_rooms w -- Check chat_rooms table
    WHERE w.id = p_room_id AND w.owner_user_id = p_user_id
    UNION ALL
    -- Check if user is a direct member with the 'moderator' role
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_room_id 
      AND wm.user_id = p_user_id 
      AND wm.role = 'moderator'
  );
$$;

-- Ensure RLS is enabled (should be from table creation)
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;

-- Drop existing policies (if any) before creating new ones
DROP POLICY IF EXISTS "Allow select for workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow insert for workspace managers" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow update for workspace managers" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow delete for workspace managers" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow insert for workspace owners" ON public.workspace_members; 
DROP POLICY IF EXISTS "Allow update for workspace owners" ON public.workspace_members; 
DROP POLICY IF EXISTS "Allow delete for workspace owners" ON public.workspace_members; 

-- Policies for workspace_members table

-- Allow users to see members of workspaces they are also members of
CREATE POLICY "Allow select for workspace members" 
ON public.workspace_members 
FOR SELECT 
TO authenticated 
USING (
  public.is_chat_room_member(workspace_id, auth.uid()) -- Use renamed helper
);

-- Allow workspace owners or moderators to insert new members
CREATE POLICY "Allow insert for workspace managers" 
ON public.workspace_members 
FOR INSERT 
TO authenticated 
WITH CHECK (
  public.can_manage_chat_room_members(workspace_id, auth.uid()) -- Use renamed helper
);

-- Allow workspace owners or moderators to update member roles
CREATE POLICY "Allow update for workspace managers" 
ON public.workspace_members 
FOR UPDATE 
TO authenticated 
USING (
  public.can_manage_chat_room_members(workspace_id, auth.uid()) -- Use renamed helper
)
WITH CHECK (
  public.can_manage_chat_room_members(workspace_id, auth.uid()) -- Use renamed helper
);

-- Allow workspace owners or moderators to delete members
-- TODO: Add check to prevent owner from being removed? Or moderator from removing owner?
CREATE POLICY "Allow delete for workspace managers" 
ON public.workspace_members 
FOR DELETE 
TO authenticated 
USING (
  public.can_manage_chat_room_members(workspace_id, auth.uid()) -- Use renamed helper
  -- Add checks here to prevent removing owner/self if needed
);
