-- Create project_flow_instances table
BEGIN;

CREATE TABLE project_flow_instances (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  flow_id uuid NOT NULL REFERENCES project_flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Flow execution state
  status text NOT NULL DEFAULT 'in_progress',
  current_step_id uuid REFERENCES project_flow_steps(id) ON DELETE SET NULL,
  current_step_number integer DEFAULT 1 NOT NULL,
  
  -- Completion tracking
  completed_steps jsonb DEFAULT '[]' NOT NULL, -- Array of completed step IDs
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Result tracking
  created_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  error_message text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  -- Status constraints
  CONSTRAINT valid_flow_instance_status CHECK (
    status IN ('in_progress', 'completed', 'abandoned', 'error')
  ),
  CONSTRAINT valid_completed_steps CHECK (is_valid_json(completed_steps)),
  CONSTRAINT valid_metadata CHECK (is_valid_json(metadata)),
  CONSTRAINT project_flow_instances_current_step_positive CHECK (current_step_number > 0)
);

-- Indexes
CREATE INDEX idx_project_flow_instances_flow_id ON project_flow_instances(flow_id);
CREATE INDEX idx_project_flow_instances_user_id ON project_flow_instances(user_id);
CREATE INDEX idx_project_flow_instances_client_id ON project_flow_instances(client_id);
CREATE INDEX idx_project_flow_instances_status ON project_flow_instances(status);
CREATE INDEX idx_project_flow_instances_activity ON project_flow_instances(last_activity_at);
CREATE INDEX idx_project_flow_instances_created_project ON project_flow_instances(created_project_id);

-- RLS Policies
ALTER TABLE project_flow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own flow instances" ON project_flow_instances
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Team members can view client flow instances" ON project_flow_instances
  FOR SELECT USING (
    is_team_member_of_client(auth.uid(), client_id, 'ACTIVE')
  );

-- Triggers
CREATE TRIGGER handle_project_flow_instances_updated_at 
  BEFORE UPDATE ON project_flow_instances 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE project_flow_instances IS 'User progress tracking through project creation flows';
COMMENT ON COLUMN project_flow_instances.completed_steps IS 'JSON array of completed step IDs for progress tracking';
COMMENT ON COLUMN project_flow_instances.created_project_id IS 'References the project created upon flow completion';

COMMIT; 