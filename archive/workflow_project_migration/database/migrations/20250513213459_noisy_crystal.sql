/*
  # Update workflow trigger function

  1. Changes
    - Modify the trigger function to properly handle workflow steps
    - Ensure steps are created in the correct order
    - Set proper default values

  2. Security
    - Enable RLS on workflow_steps table
    - Add policies for authenticated users
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_workflow_steps_trigger ON projects;
DROP FUNCTION IF EXISTS create_workflow_steps_from_templates();

-- Create the updated trigger function
CREATE OR REPLACE FUNCTION create_workflow_steps_from_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert workflow steps from templates
  INSERT INTO workflow_steps (
    project_id,
    phase,
    step_number,
    name,
    description,
    status,
    ai_model_used,
    ai_prompt,
    ai_output,
    human_edits,
    final_output
  )
  SELECT
    NEW.id,
    phase,
    step_number,
    name,
    description,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '{}'::jsonb
  FROM workflow_templates
  ORDER BY
    CASE phase
      WHEN 'research' THEN 1
      WHEN 'planning' THEN 2
      WHEN 'design' THEN 3
      WHEN 'development' THEN 4
    END,
    step_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER create_workflow_steps_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_steps_from_templates();

-- Enable RLS on workflow_steps
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

-- Add policies for workflow_steps
CREATE POLICY "Users can view workflow steps for their projects"
  ON workflow_steps
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workflow steps for their projects"
  ON workflow_steps
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = auth.uid()
    )
  );