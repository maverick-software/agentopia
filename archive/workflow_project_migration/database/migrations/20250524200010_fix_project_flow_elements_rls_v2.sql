-- Fix RLS policy for project_flow_elements with a simpler approach
-- Drop existing policy and create a new comprehensive one

-- Drop the existing policy
DROP POLICY IF EXISTS "Admin full access on project_flow_elements" ON project_flow_elements;

-- Create a simpler admin policy that allows all operations
CREATE POLICY "Admin can manage project flow elements" ON project_flow_elements
  FOR ALL 
  TO authenticated
  USING (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid())
  )
  WITH CHECK (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid())
  );

-- Create a read policy for authenticated users (for flow execution)
CREATE POLICY "Authenticated users can view project flow elements" ON project_flow_elements
  FOR SELECT
  TO authenticated
  USING (true); -- Allow all authenticated users to read flow elements 