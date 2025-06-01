-- Migration: Add Project-Workflow Integration Columns
-- Description: Add columns to projects table for unified workflow integration
-- and create indexes for performance

-- Add columns to projects table for workflow integration
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS unified_template_id UUID REFERENCES unified_workflow_templates(id),
ADD COLUMN IF NOT EXISTS workflow_instance_id UUID REFERENCES unified_workflow_instances(id),
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'discovery';

-- Add columns to unified_workflow_instances for project linking
ALTER TABLE unified_workflow_instances
ADD COLUMN IF NOT EXISTS created_project_id UUID REFERENCES projects(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_unified_template_id ON projects(unified_template_id);
CREATE INDEX IF NOT EXISTS idx_projects_workflow_instance_id ON projects(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_created_project_id ON unified_workflow_instances(created_project_id);

-- Create new RPC function for unified workflow project creation
CREATE OR REPLACE FUNCTION create_project_from_unified_workflow(
  p_client_id UUID,
  p_template_id UUID,
  p_project_name TEXT,
  p_created_by_user_id UUID,
  p_workflow_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_project_id UUID;
  v_template_type TEXT;
  v_stage_record RECORD;
  v_task_record RECORD;
  v_project_stage_id UUID;
BEGIN
  -- Get template type
  SELECT template_type INTO v_template_type
  FROM unified_workflow_templates
  WHERE id = p_template_id;

  -- Create the project
  INSERT INTO projects (
    name,
    client_id,
    unified_template_id,
    created_by_user_id,
    status,
    current_phase
  ) VALUES (
    p_project_name,
    p_client_id,
    p_template_id,
    p_created_by_user_id,
    'planning',
    'discovery'
  ) RETURNING id INTO v_project_id;

  -- Create project structure based on template type
  IF v_template_type = 'standard' THEN
    -- Create stages and tasks from template
    FOR v_stage_record IN
      SELECT * FROM unified_workflow_stages
      WHERE template_id = p_template_id
      ORDER BY stage_order
    LOOP
      -- Create project stage
      INSERT INTO project_stages (
        project_id,
        name,
        description,
        "order"
      ) VALUES (
        v_project_id,
        v_stage_record.name,
        v_stage_record.description,
        v_stage_record.stage_order
      ) RETURNING id INTO v_project_stage_id;

      -- Create project tasks for this stage
      FOR v_task_record IN
        SELECT * FROM unified_workflow_tasks
        WHERE stage_id = v_stage_record.id
        ORDER BY task_order
      LOOP
        INSERT INTO project_tasks (
          project_stage_id,
          name,
          description,
          "order",
          priority,
          estimated_duration_hours
        ) VALUES (
          v_project_stage_id,
          v_task_record.name,
          v_task_record.description,
          v_task_record.task_order,
          COALESCE(v_task_record.priority, 'medium'),
          CASE 
            WHEN v_task_record.estimated_duration_minutes IS NOT NULL 
            THEN CEIL(v_task_record.estimated_duration_minutes::NUMERIC / 60)
            ELSE NULL
          END
        );
      END LOOP;
    END LOOP;
  ELSIF v_template_type = 'flow_based' THEN
    -- Create project structure from workflow data
    -- For flow-based templates, we'll create a simple structure
    -- and let the workflow data drive the actual project content
    INSERT INTO project_stages (
      project_id,
      name,
      description,
      "order"
    ) VALUES (
      v_project_id,
      'Workflow Completion',
      'Complete the workflow to define project structure',
      1
    ) RETURNING id INTO v_project_stage_id;

    INSERT INTO project_tasks (
      project_stage_id,
      name,
      description,
      "order",
      priority,
      status
    ) VALUES (
      v_project_stage_id,
      'Complete Project Workflow',
      'Follow the workflow steps to define project requirements and structure',
      1,
      'high',
      'pending'
    );
  ELSE
    -- Handle hybrid workflows
    -- Create basic structure that can be enhanced by workflow data
    INSERT INTO project_stages (
      project_id,
      name,
      description,
      "order"
    ) VALUES (
      v_project_id,
      'Project Setup',
      'Initial project setup and workflow completion',
      1
    ) RETURNING id INTO v_project_stage_id;

    INSERT INTO project_tasks (
      project_stage_id,
      name,
      description,
      "order",
      priority,
      status
    ) VALUES (
      v_project_stage_id,
      'Complete Setup Workflow',
      'Complete the setup workflow to configure project details',
      1,
      'high',
      'pending'
    );
  END IF;

  -- Add creator as project lead
  INSERT INTO project_members (
    project_id,
    user_id,
    role
  ) VALUES (
    v_project_id,
    p_created_by_user_id,
    'PROJECT_LEAD'
  );

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the migration
COMMENT ON FUNCTION create_project_from_unified_workflow IS 'Creates a project from a unified workflow template, supporting standard, flow-based, and hybrid template types'; 