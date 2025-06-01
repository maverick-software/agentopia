/*
  # Create workflow steps trigger

  1. New Function
    - Creates a trigger function that automatically creates workflow steps from templates
    - Runs after a new project is created
    - Copies steps from workflow_templates table
    - Sets initial status to 'pending'

  2. Security
    - Function is owned by postgres
    - Function has standard security definer wrapper
*/

-- Create the trigger function
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
    status
  )
  SELECT
    NEW.id,
    phase,
    step_number,
    name,
    description,
    'pending'
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_workflow_steps_trigger ON projects;

-- Create the trigger
CREATE TRIGGER create_workflow_steps_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_steps_from_templates();