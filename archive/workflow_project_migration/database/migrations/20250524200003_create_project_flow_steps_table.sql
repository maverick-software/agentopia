-- Create project_flow_steps table
BEGIN;

CREATE TABLE project_flow_steps (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  flow_id uuid NOT NULL REFERENCES project_flows(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  step_number integer NOT NULL,
  is_required boolean DEFAULT true NOT NULL,
  
  -- Step behavior configuration
  allow_skip boolean DEFAULT false NOT NULL,
  show_progress boolean DEFAULT true NOT NULL,
  auto_advance boolean DEFAULT false NOT NULL,
  
  -- Conditional logic
  condition_logic jsonb DEFAULT '{}',
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Unique constraint on step ordering within flow
  UNIQUE(flow_id, step_number),
  
  -- Validation constraints
  CONSTRAINT project_flow_steps_name_not_empty CHECK (trim(name) != ''),
  CONSTRAINT project_flow_steps_step_number_positive CHECK (step_number > 0),
  CONSTRAINT valid_condition_logic CHECK (is_valid_json(condition_logic))
);

-- Indexes
CREATE INDEX idx_project_flow_steps_flow_id ON project_flow_steps(flow_id);
CREATE INDEX idx_project_flow_steps_step_number ON project_flow_steps(flow_id, step_number);

-- RLS Policies
ALTER TABLE project_flow_steps ENABLE ROW LEVEL SECURITY;

-- Inherit permissions from parent flow
CREATE POLICY "Admin full access on project_flow_steps" ON project_flow_steps
  USING (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid())
    AND EXISTS (SELECT 1 FROM project_flows pf WHERE pf.id = project_flow_steps.flow_id)
  );

CREATE POLICY "Authenticated users read flow steps" ON project_flow_steps
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND EXISTS (SELECT 1 FROM project_flows pf WHERE pf.id = project_flow_steps.flow_id AND pf.is_active = true)
  );

-- Triggers
CREATE TRIGGER handle_project_flow_steps_updated_at 
  BEFORE UPDATE ON project_flow_steps 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE project_flow_steps IS 'Individual steps within project flows with ordered sequence';
COMMENT ON COLUMN project_flow_steps.condition_logic IS 'JSON configuration for conditional step display logic';
COMMENT ON COLUMN project_flow_steps.auto_advance IS 'Whether to automatically advance to next step on completion';

COMMIT; 