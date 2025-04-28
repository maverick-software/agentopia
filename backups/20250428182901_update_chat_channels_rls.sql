-- Ensure helper functions exist (defined in previous migrations)
-- public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
-- public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid) -- Use this or owner check

-- Drop existing policies before creating new ones
DROP POLICY IF EXISTS "Allow room members to view channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to create channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to delete channels" ON public.chat_channels;

-- Renamed Policies:
DROP POLICY IF EXISTS "Allow workspace members to view channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to create channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to delete channels" ON public.chat_channels;

-- Enable RLS (should already be enabled, but ensure it)
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels FORCE ROW LEVEL SECURITY;

-- Policy: Allow workspace members to view channels in their workspace
CREATE POLICY "Allow workspace members to view channels"
ON public.chat_channels
FOR SELECT
TO authenticated
USING (
    public.is_chat_room_member(room_id, auth.uid()) -- Use room_id AND is_chat_room_member helper
);

-- Policy: Allow workspace owner to create channels
-- TODO: Allow moderators too?
CREATE POLICY "Allow workspace owner to create channels"
ON public.chat_channels
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workspaces w -- Use workspaces table (already renamed by this point)
        WHERE w.id = chat_channels.room_id -- Check using room_id column before it's renamed
        AND w.owner_user_id = auth.uid()
    )
);

-- Policy: Allow workspace owner to update channels
-- TODO: Allow moderators too?
CREATE POLICY "Allow workspace owner to update channels"
ON public.chat_channels
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspaces w -- Use workspaces table (already renamed by this point)
        WHERE w.id = chat_channels.room_id -- Check using room_id column before it's renamed
        AND w.owner_user_id = auth.uid()
    )
);

-- Policy: Allow workspace owner to delete channels
-- TODO: Allow moderators too?
CREATE POLICY "Allow workspace owner to delete channels"
ON public.chat_channels
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspaces w -- Use workspaces table (already renamed by this point)
        WHERE w.id = chat_channels.room_id -- Check using room_id column before it's renamed
        AND w.owner_user_id = auth.uid()
    )
);
