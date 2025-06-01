/*
  # Fix table dependencies

  1. Changes
    - Drop all policies before dropping tables
    - Drop tables in correct dependency order
    - Recreate tables without RLS policies
    - Add workflow steps trigger
*/

-- First drop all policies
DROP POLICY IF EXISTS "Users can read projects they are members of" ON projects;
DROP POLICY IF EXISTS "Project managers can read all projects" ON projects;
DROP POLICY IF EXISTS "Admins can read all projects" ON projects;
DROP POLICY IF EXISTS "Project managers can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can read workflow steps for their projects" ON workflow_steps;
DROP POLICY IF EXISTS "Users can update workflow steps for their projects" ON workflow_steps;
DROP POLICY IF EXISTS "Users can read assets for their projects" ON project_assets;
DROP POLICY IF EXISTS "Users can read intake forms for their projects" ON intake_forms;
DROP POLICY IF EXISTS "Project managers can manage project members" ON project_members;
DROP POLICY IF EXISTS "Users can read project members for their projects" ON project_members;
DROP POLICY IF EXISTS "Project managers can manage workflow templates" ON workflow_templates;
DROP POLICY IF EXISTS "Users can read workflow templates" ON workflow_templates;
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Project managers can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can read clients they created" ON clients;
DROP POLICY IF EXISTS "Project managers can read all clients" ON clients;
DROP POLICY IF EXISTS "Admins can read all clients" ON clients;

-- Drop RLS from all tables
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS intake_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;

-- Drop trigger first
DROP TRIGGER IF EXISTS create_workflow_steps_trigger ON projects;
DROP FUNCTION IF EXISTS create_workflow_steps_from_templates();

-- Drop tables in correct order
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS intake_forms;
DROP TABLE IF EXISTS project_assets;
DROP TABLE IF EXISTS workflow_steps;
DROP TABLE IF EXISTS workflow_templates;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS users;

-- Recreate tables without auth dependencies
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'project_manager', 'designer', 'developer')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id),
  status text NOT NULL CHECK (status IN ('active', 'completed', 'on-hold')),
  current_phase text NOT NULL CHECK (current_phase IN ('research', 'planning', 'design', 'development')),
  current_step integer NOT NULL,
  wordpress_url text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL,
  UNIQUE(project_id, user_id)
);

CREATE TABLE workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL CHECK (phase IN ('research', 'planning', 'design', 'development')),
  step_number integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

CREATE TABLE workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  phase text NOT NULL CHECK (phase IN ('research', 'planning', 'design', 'development')),
  step_number integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'awaiting_review', 'completed')),
  ai_model_used text,
  ai_prompt text,
  ai_output jsonb,
  human_edits jsonb,
  final_output jsonb,
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id)
);

CREATE TABLE project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('logo', 'brand_guide', 'image', 'document')),
  file_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  form_data jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'completed')),
  sent_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  type text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create workflow steps from templates function
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
    phase,
    step_number,
    name,
    description,
    'pending'
  FROM workflow_templates;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workflow steps
CREATE TRIGGER create_workflow_steps_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_steps_from_templates();