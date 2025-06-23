-- Fix RLS policy for project_flow_elements to allow admin users to INSERT/UPDATE/DELETE
-- The original policy was missing the WITH CHECK clause

-- Drop the existing policy
DROP POLICY IF EXISTS "Admin full access on project_flow_elements" ON project_flow_elements;

-- Recreate with proper WITH CHECK clause for INSERT/UPDATE/DELETE operations
CREATE POLICY "Admin full access on project_flow_elements" ON project_flow_elements
  USING (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()) AND
    EXISTS (
      SELECT 1 
      FROM project_flow_steps pfs
      JOIN project_flows pf ON pf.id = pfs.flow_id
      WHERE pfs.id = project_flow_elements.step_id
    )
  )
  WITH CHECK (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()) AND
    EXISTS (
      SELECT 1 
      FROM project_flow_steps pfs
      JOIN project_flows pf ON pf.id = pfs.flow_id
      WHERE pfs.id = project_flow_elements.step_id
    )
  );

-- Also fix the project_flow_steps policy if it has the same issue
DROP POLICY IF EXISTS "Admin full access on project_flow_steps" ON project_flow_steps;

CREATE POLICY "Admin full access on project_flow_steps" ON project_flow_steps
  USING (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()) AND
    EXISTS (
      SELECT 1 
      FROM project_flows pf
      WHERE pf.id = project_flow_steps.flow_id
    )
  )
  WITH CHECK (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()) AND
    EXISTS (
      SELECT 1 
      FROM project_flows pf
      WHERE pf.id = project_flow_steps.flow_id
    )
  ); 