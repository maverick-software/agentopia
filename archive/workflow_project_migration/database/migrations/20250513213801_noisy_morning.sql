/*
  # Add Research States

  1. Changes
    - Add research_state column to workflow_steps table
    - Add research_state check constraint
    - Update trigger function to set initial research_state
    - Add research_state to existing workflow steps
*/

-- Add research_state column to workflow_steps
ALTER TABLE workflow_steps 
ADD COLUMN research_state text DEFAULT 'not_started';

-- Add check constraint for research_state
ALTER TABLE workflow_steps
ADD CONSTRAINT workflow_steps_research_state_check
CHECK (research_state = ANY (ARRAY[
  'not_started',
  'gathering_data',
  'analyzing',
  'documenting',
  'reviewing',
  'completed'
]::text[]));

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_workflow_steps_trigger ON projects;
DROP FUNCTION IF EXISTS create_workflow_steps_from_templates();

-- Create updated trigger function with research_state
CREATE OR REPLACE FUNCTION create_workflow_steps_from_templates()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workflow_steps (
    project_id,
    phase,
    step_number,
    name,
    description,
    status,
    research_state,
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
    CASE 
      WHEN phase = 'research' THEN 'not_started'
      ELSE NULL
    END,
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

-- Recreate trigger
CREATE TRIGGER create_workflow_steps_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_steps_from_templates();

-- Update existing workflow steps
UPDATE workflow_steps
SET research_state = 
  CASE 
    WHEN phase = 'research' AND status = 'completed' THEN 'completed'
    WHEN phase = 'research' AND status = 'in_progress' THEN 'analyzing'
    WHEN phase = 'research' THEN 'not_started'
    ELSE NULL
  END;