-- supabase/migrations/20250522072300_fix_project_members_rls_recursion_v4.sql

-- Helper functions (kept for potential re-use later)
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

-- Drop ALL specific RLS policies on project_members for this diagnostic step
DROP POLICY IF EXISTS "Admin full access on project_members" ON public.project_members;
DROP POLICY IF EXISTS "Project leads can manage project_members" ON public.project_members;
DROP POLICY IF EXISTS "Project members can view project_members" ON public.project_members;

/* -- All policy creations for project_members are commented out for this diagnostic version
CREATE POLICY "Project leads can manage project_members" ... 
CREATE POLICY "Project members can view project_members" ...
*/

-- Note: The "Admin full access on project_members" was originally created in a different migration file.
-- Dropping it here ensures it's removed for this test. If this test passes (error gone),
-- we will re-introduce policies one by one in subsequent migration versions. 