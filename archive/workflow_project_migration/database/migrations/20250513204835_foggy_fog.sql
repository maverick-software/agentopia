/*
  # Initial Schema Setup
  
  This migration creates the core database schema for the WebDevFlow application.
  
  1. Tables
    - Users
    - Clients
    - Projects
    - Project Members
    - Workflow Templates
    - Workflow Steps
    - Intake Forms
    - Project Assets
    - Notifications
    
  2. Security
    - Enables RLS on all tables
    - Creates appropriate policies for each table
    
  3. Functions & Triggers
    - Creates workflow steps from templates on project creation
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert for registration" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can read clients they created" ON clients;
DROP POLICY IF EXISTS "Project managers can read all clients" ON clients;
DROP POLICY IF EXISTS "Admins can read all clients" ON clients;
DROP POLICY IF EXISTS "Project managers can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can read projects they are members of" ON projects;
DROP POLICY IF EXISTS "Project managers can read all projects" ON projects;
DROP POLICY IF EXISTS "Admins can read all projects" ON projects;
DROP POLICY IF EXISTS "Project managers can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can read project members for their projects" ON project_members;
DROP POLICY IF EXISTS "Project managers can manage project members" ON project_members;
DROP POLICY IF EXISTS "Project managers can manage workflow templates" ON workflow_templates;
DROP POLICY IF EXISTS "Users can read workflow templates" ON workflow_templates;
DROP POLICY IF EXISTS "Users can read workflow steps for their projects" ON workflow_steps;
DROP POLICY IF EXISTS "Users can update workflow steps for their projects" ON workflow_steps;
DROP POLICY IF EXISTS "Users can read intake forms for their projects" ON intake_forms;
DROP POLICY IF EXISTS "Users can read assets for their projects" ON project_assets;
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'project_manager', 'designer', 'developer'))
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for registration"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read clients they created"
  ON clients
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Project managers can read all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'project_manager'
    )
  );

CREATE POLICY "Admins can read all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Project managers can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'project_manager' OR users.role = 'admin')
    )
  );

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'on-hold')),
  current_phase TEXT NOT NULL CHECK (current_phase IN ('research', 'planning', 'design', 'development')),
  current_step INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  wordpress_url TEXT
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read projects they are members of"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Project managers can read all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'project_manager'
    )
  );

CREATE POLICY "Admins can read all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Project managers can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'project_manager' OR users.role = 'admin')
    )
  );

CREATE POLICY "Users can read project members for their projects"
  ON project_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'project_manager' OR users.role = 'admin')
    )
  );

CREATE POLICY "Project managers can manage project members"
  ON project_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'project_manager' OR users.role = 'admin')
    )
  );

-- Workflow templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL CHECK (phase IN ('research', 'planning', 'design', 'development')),
  step_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project managers can manage workflow templates"
  ON workflow_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'project_manager' OR users.role = 'admin')
    )
  );

CREATE POLICY "Users can read workflow templates"
  ON workflow_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Workflow steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  phase TEXT NOT NULL CHECK (phase IN ('research', 'planning', 'design', 'development')),
  step_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'awaiting_review', 'completed')),
  ai_model_used TEXT,
  ai_prompt TEXT,
  ai_output JSONB,
  human_edits JSONB,
  final_output JSONB,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id)
);

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read workflow steps for their projects"
  ON workflow_steps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workflow steps for their projects"
  ON workflow_steps
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- Intake forms table
CREATE TABLE IF NOT EXISTS intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  form_data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'completed')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read intake forms for their projects"
  ON intake_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- Project assets table
CREATE TABLE IF NOT EXISTS project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('logo', 'brand_guide', 'image', 'document')),
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read assets for their projects"
  ON project_assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to create workflow steps from templates
CREATE OR REPLACE FUNCTION create_workflow_steps_from_templates()
RETURNS TRIGGER AS $$
BEGIN
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
    wt.phase,
    wt.step_number,
    wt.name,
    wt.description,
    'pending'
  FROM workflow_templates wt;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create workflow steps
DROP TRIGGER IF EXISTS create_workflow_steps_trigger ON projects;
CREATE TRIGGER create_workflow_steps_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_steps_from_templates();

-- Insert default workflow templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
-- Research Phase
('research', 1, 'Client Requirements Analysis', 'Review client questionnaire and document key requirements'),
('research', 2, 'Competitor Analysis', 'Research and analyze 3-5 competitor websites'),
('research', 3, 'Target Audience Research', 'Define user personas and audience demographics'),
('research', 4, 'Technical Requirements', 'Document hosting, performance, and technical specifications'),

-- Planning Phase
('planning', 1, 'Information Architecture', 'Create sitemap and define content structure'),
('planning', 2, 'User Flow Mapping', 'Design user journey maps for key interactions'),
('planning', 3, 'Content Planning', 'Create content inventory and writing guidelines'),
('planning', 4, 'Project Timeline', 'Define milestones and delivery schedule'),

-- Design Phase
('design', 1, 'Mood Board Creation', 'Develop visual direction with colors, typography, and imagery'),
('design', 2, 'Wireframe Development', 'Create low-fidelity wireframes for key pages'),
('design', 3, 'UI Design - Desktop', 'Design high-fidelity mockups for desktop'),
('design', 4, 'UI Design - Mobile', 'Design high-fidelity mockups for mobile'),
('design', 5, 'Design System', 'Create component library and style guide'),

-- Development Phase
('development', 1, 'Environment Setup', 'Configure development and staging environments'),
('development', 2, 'Frontend Development', 'Build responsive frontend components'),
('development', 3, 'CMS Integration', 'Set up WordPress and create custom post types'),
('development', 4, 'Testing & QA', 'Perform cross-browser and device testing'),
('development', 5, 'Content Migration', 'Import and format client content'),
('development', 6, 'Launch Preparation', 'Final checks and deployment planning');

-- Insert admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'fd3d4c8e-9f8d-4c3e-b5f0-a2d2c0379f1a',
  'authenticated',
  'authenticated',
  'admin@webdevflow.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id,
  email,
  role,
  created_at
)
VALUES (
  'fd3d4c8e-9f8d-4c3e-b5f0-a2d2c0379f1a',
  'admin@webdevflow.com',
  'admin',
  now()
)
ON CONFLICT (id) DO NOTHING;