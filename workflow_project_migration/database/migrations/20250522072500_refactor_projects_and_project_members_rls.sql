-- supabase/migrations/20250522072500_refactor_projects_and_project_members_rls.sql

-- Helper function to check if a user is a member of a specific project
CREATE OR REPLACE FUNCTION public.is_user_project_member(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.user_id = p_user_id AND pm.project_id = p_project_id
  );
END;
$$;

COMMENT ON FUNCTION public.is_user_project_member(uuid, uuid) IS 'Checks if a given user is a member of a given project. SECURITY DEFINER. STABLE.';

-- Helper function to check if a user is a project lead for a specific project
CREATE OR REPLACE FUNCTION public.is_user_project_lead(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.user_id = p_user_id AND pm.project_id = p_project_id AND pm.role = 'PROJECT_LEAD'
  );
END;
$$;

COMMENT ON FUNCTION public.is_user_project_lead(uuid, uuid) IS 'Checks if a given user is a PROJECT_LEAD for a given project. SECURITY DEFINER. STABLE.';

-- RLS for public.projects table
DROP POLICY IF EXISTS "Project members can access their projects" ON public.projects;
CREATE POLICY "Project members can access their projects"
ON public.projects
FOR ALL -- Keep FOR ALL for now, can be refined to SELECT, UPDATE, DELETE separately if needed
USING (
    -- Users can generally interact with projects they are a member of.
    public.is_user_project_member(auth.uid(), projects.id)
)
WITH CHECK (
    -- For creating/updating a project (directly on the projects table):
    -- User must be a project lead of that specific project.
    -- Initial creation is handled by the calling function (e.g. create_project_from_template) which adds user as lead.
    public.is_user_project_lead(auth.uid(), projects.id)
);

-- RLS for public.project_members table

-- 1. Admin full access (no change from original, does not use project-specific helpers)
DROP POLICY IF EXISTS "Admin full access on project_members" ON public.project_members;
CREATE POLICY "Admin full access on project_members"
ON public.project_members
FOR ALL
USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

-- 2. Project leads can manage members of their project
DROP POLICY IF EXISTS "Project leads can manage project_members" ON public.project_members;
CREATE POLICY "Project leads can manage project_members"
ON public.project_members
FOR ALL -- Allows SELECT, INSERT, UPDATE, DELETE for leads on members of their project
USING (
    public.is_user_project_lead(auth.uid(), project_members.project_id) 
)
WITH CHECK (
    public.is_user_project_lead(auth.uid(), project_members.project_id)
);

-- 3. Project members can view other members of the same project
DROP POLICY IF EXISTS "Project members can view project_members" ON public.project_members;
CREATE POLICY "Project members can view project_members"
ON public.project_members
FOR SELECT
USING (
    public.is_user_project_member(auth.uid(), project_members.project_id)
); 