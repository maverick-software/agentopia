-- Create project_flow_elements table
BEGIN;

CREATE TABLE project_flow_elements (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  step_id uuid NOT NULL REFERENCES project_flow_steps(id) ON DELETE CASCADE,
  element_type text NOT NULL,
  element_key text NOT NULL, -- Unique key for data binding
  label text,
  placeholder text,
  help_text text,
  element_order integer NOT NULL,
  
  -- Element configuration (JSON structure varies by type)
  config jsonb DEFAULT '{}' NOT NULL,
  
  -- Validation rules
  is_required boolean DEFAULT false NOT NULL,
  validation_rules jsonb DEFAULT '{}',
  
  -- Conditional display
  condition_logic jsonb DEFAULT '{}',
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Unique constraint on element ordering within step
  UNIQUE(step_id, element_order),
  -- Unique constraint on element key within step
  UNIQUE(step_id, element_key),
  
  -- Element type constraints
  CONSTRAINT valid_element_type CHECK (
    element_type IN (
      -- Form Elements
      'text_input', 'textarea', 'number_input', 'email_input', 'url_input',
      'dropdown', 'radio_group', 'checkbox_group', 'date_picker', 'file_upload',
      -- Content Elements  
      'heading', 'paragraph', 'instructions', 'link', 'divider', 'image',
      -- Integration Elements
      'products_services_selector', 'template_selector', 'client_info_display',
      -- Validation Elements
      'confirmation_checkbox', 'signature_pad',
      -- Review Elements
      'summary_display', 'data_review',
      -- AI Elements (Future)
      'ai_project_analysis', 'ai_recommendation', 'ai_form_prefill', 'ai_template_suggestion'
    )
  ),
  CONSTRAINT valid_element_config CHECK (is_valid_json(config)),
  CONSTRAINT valid_validation_rules CHECK (is_valid_json(validation_rules)),
  CONSTRAINT valid_condition_logic_elements CHECK (is_valid_json(condition_logic)),
  CONSTRAINT project_flow_elements_element_order_positive CHECK (element_order > 0)
);

-- Indexes
CREATE INDEX idx_project_flow_elements_step_id ON project_flow_elements(step_id);
CREATE INDEX idx_project_flow_elements_type ON project_flow_elements(element_type);
CREATE INDEX idx_project_flow_elements_order ON project_flow_elements(step_id, element_order);
CREATE INDEX idx_project_flow_elements_key ON project_flow_elements(step_id, element_key);

-- RLS Policies
ALTER TABLE project_flow_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on project_flow_elements" ON project_flow_elements
  USING (
    ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid())
    AND EXISTS (
      SELECT 1 FROM project_flow_steps pfs 
      JOIN project_flows pf ON pf.id = pfs.flow_id 
      WHERE pfs.id = project_flow_elements.step_id
    )
  );

CREATE POLICY "Authenticated users read flow elements" ON project_flow_elements
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM project_flow_steps pfs 
      JOIN project_flows pf ON pf.id = pfs.flow_id 
      WHERE pfs.id = project_flow_elements.step_id AND pf.is_active = true
    )
  );

-- Triggers
CREATE TRIGGER handle_project_flow_elements_updated_at 
  BEFORE UPDATE ON project_flow_elements 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE project_flow_elements IS 'Configurable elements within flow steps (forms, content, integrations)';
COMMENT ON COLUMN project_flow_elements.element_key IS 'Unique key within step for data binding and references';
COMMENT ON COLUMN project_flow_elements.config IS 'JSON configuration object specific to element type';

COMMIT; 