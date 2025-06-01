-- Create project_flow_step_data table
BEGIN;

CREATE TABLE project_flow_step_data (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES project_flow_instances(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES project_flow_steps(id) ON DELETE CASCADE,
  element_key text NOT NULL, -- References element_key from project_flow_elements
  
  -- Data storage (flexible JSON for different data types)
  data_value jsonb NOT NULL,
  data_type text NOT NULL, -- 'string', 'number', 'boolean', 'array', 'object', 'file'
  
  -- Validation status
  is_valid boolean DEFAULT true NOT NULL,
  validation_errors jsonb DEFAULT '[]',
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Unique constraint - one data entry per element per instance
  UNIQUE(instance_id, step_id, element_key),
  
  -- Validation constraints
  CONSTRAINT valid_data_type CHECK (
    data_type IN ('string', 'number', 'boolean', 'array', 'object', 'file')
  ),
  CONSTRAINT valid_data_value CHECK (is_valid_json(data_value)),
  CONSTRAINT valid_validation_errors CHECK (is_valid_json(validation_errors))
);

-- Indexes
CREATE INDEX idx_project_flow_step_data_instance_id ON project_flow_step_data(instance_id);
CREATE INDEX idx_project_flow_step_data_step_id ON project_flow_step_data(step_id);
CREATE INDEX idx_project_flow_step_data_element_key ON project_flow_step_data(element_key);

-- RLS Policies
ALTER TABLE project_flow_step_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own flow step data" ON project_flow_step_data
  USING (
    EXISTS (
      SELECT 1 FROM project_flow_instances pfi 
      WHERE pfi.id = project_flow_step_data.instance_id 
      AND pfi.user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER handle_project_flow_step_data_updated_at 
  BEFORE UPDATE ON project_flow_step_data 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE project_flow_step_data IS 'User-submitted data for each element in flow steps';
COMMENT ON COLUMN project_flow_step_data.element_key IS 'References element_key from project_flow_elements';
COMMENT ON COLUMN project_flow_step_data.data_value IS 'Flexible JSON storage for element values';

COMMIT; 