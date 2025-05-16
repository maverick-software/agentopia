-- Ensure helper function exists by including its definition here
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$
  SELECT EXISTS (
    -- Check if user is directly a member
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id
    UNION ALL
    -- Check if user is a member of a team that is a member of the workspace
    SELECT 1 
    FROM public.workspace_members wm_teams 
    JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id 
    WHERE wm_teams.workspace_id = p_workspace_id AND utm.user_id = p_user_id
    UNION ALL
    -- Check if user is the owner of the workspace (owners should implicitly be members for RLS checks)
    SELECT 1 
    FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
  );
$$;
-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;

-- Drop incorrect policies if they exist (using names from previous attempts)
DROP POLICY IF EXISTS "Allow room members to view channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to create channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow room owner to delete channels" ON public.chat_channels;

DROP POLICY IF EXISTS "Allow workspace members to view channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to create channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Allow workspace owner to delete channels" ON public.chat_channels;

-- Ensure RLS is enabled
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels FORCE ROW LEVEL SECURITY;

-- CORRECTED Policy: Allow workspace members to view channels in their workspace
CREATE POLICY "Allow workspace members SELECT" 
ON public.chat_channels
FOR SELECT
TO authenticated
USING (
    public.is_workspace_member(workspace_id, auth.uid()) -- Use correct column and helper
);

-- CORRECTED Policy: Allow workspace members to create channels in their workspace
CREATE POLICY "Allow workspace members INSERT" 
ON public.chat_channels
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid()) -- Use correct column and helper
);

-- CORRECTED Policy: Allow workspace owner to update channels
-- TODO: Consider allowing moderators later using can_manage_workspace_members?
CREATE POLICY "Allow workspace owner UPDATE" 
ON public.chat_channels
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspaces w
        WHERE w.id = chat_channels.workspace_id -- Use correct column name
        AND w.owner_user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workspaces w
        WHERE w.id = chat_channels.workspace_id -- Use correct column name
        AND w.owner_user_id = auth.uid()
    )
);

-- CORRECTED Policy: Allow workspace owner to delete channels
-- TODO: Consider allowing moderators later?
CREATE POLICY "Allow workspace owner DELETE" 
ON public.chat_channels
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspaces w
        WHERE w.id = chat_channels.workspace_id -- Use correct column name
        AND w.owner_user_id = auth.uid()
    )
);
