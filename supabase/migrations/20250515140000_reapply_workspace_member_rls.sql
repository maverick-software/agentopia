-- Re-apply RLS policies and helper functions for workspace members to ensure correctness

-- Re-define Helper Function can_manage_workspace_members (ensure it uses `workspaces`)
CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id AND wm.role = 'moderator' -- Or other managing roles
  );
$$;

-- Re-apply RLS for workspace_members INSERT (using the correct function)
-- Drop existing policy first to ensure clean application
DROP POLICY IF EXISTS "Allow insert for workspace managers" ON public.workspace_members;
-- Create the policy using the potentially updated function
CREATE POLICY "Allow insert for workspace managers" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_workspace_members(workspace_id, auth.uid()));

-- Re-apply other workspace_members policies just in case (using correct helper functions)
-- SELECT Policy (uses is_workspace_member - assumed correct from previous migrations)
DROP POLICY IF EXISTS "Allow select for workspace members" ON public.workspace_members;
CREATE POLICY "Allow select for workspace members" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- UPDATE Policy
DROP POLICY IF EXISTS "Allow update for workspace managers" ON public.workspace_members;
CREATE POLICY "Allow update for workspace managers" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.can_manage_workspace_members(workspace_id, auth.uid()))
  WITH CHECK (public.can_manage_workspace_members(workspace_id, auth.uid()));

-- DELETE Policy
DROP POLICY IF EXISTS "Allow delete for workspace managers" ON public.workspace_members;
CREATE POLICY "Allow delete for workspace managers" ON public.workspace_members FOR DELETE TO authenticated
  USING (public.can_manage_workspace_members(workspace_id, auth.uid())); 