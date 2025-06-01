-- Create project_flows table
BEGIN;

CREATE TABLE project_flows (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  estimated_duration_minutes integer,
  icon text, -- For UI display (e.g., 'website', 'mobile-app', 'consulting')
  color text, -- Hex color for flow cards
  sort_order integer DEFAULT 0 NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Metadata for flow configuration
  requires_products_services boolean DEFAULT false NOT NULL,
  requires_template_selection boolean DEFAULT false NOT NULL,
  auto_create_project boolean DEFAULT true NOT NULL,
  
  -- Validation constraints
  CONSTRAINT project_flows_name_not_empty CHECK (trim(name) != ''),
  CONSTRAINT project_flows_sort_order_positive CHECK (sort_order >= 0)
);

-- Indexes
CREATE INDEX idx_project_flows_active ON project_flows(is_active);
CREATE INDEX idx_project_flows_sort_order ON project_flows(sort_order);
CREATE INDEX idx_project_flows_created_by ON project_flows(created_by_user_id);

-- RLS Policies
ALTER TABLE project_flows ENABLE ROW LEVEL SECURITY;

-- Admins and Site Managers can manage flows
CREATE POLICY "Admin full access on project_flows" ON project_flows
  USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
  WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

-- Authenticated users can read active flows
CREATE POLICY "Authenticated users can read active project_flows" ON project_flows
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

-- Triggers
CREATE TRIGGER handle_project_flows_updated_at 
  BEFORE UPDATE ON project_flows 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE project_flows IS 'Core flow definitions for project creation workflows managed by admins';
COMMENT ON COLUMN project_flows.requires_products_services IS 'Whether this flow requires products/services selection';
COMMENT ON COLUMN project_flows.requires_template_selection IS 'Whether this flow requires project template selection';
COMMENT ON COLUMN project_flows.auto_create_project IS 'Whether to automatically create project on flow completion';

COMMIT; 