-- Add sample flow steps and elements for testing Project Flows
BEGIN;

-- Get the Website Development Project flow ID
-- (Using the known ID from the sample data: 0fdc016a-5a9d-4ef8-8492-ae0593d0ceb5)

-- Create Step 1: Project Overview
INSERT INTO project_flow_steps (
  id,
  flow_id,
  name,
  description,
  step_number,
  is_required
) VALUES (
  gen_random_uuid(),
  '0fdc016a-5a9d-4ef8-8492-ae0593d0ceb5',
  'Project Overview',
  'Basic information about your website project',
  1,
  true
);

-- Create Step 2: Technical Requirements
INSERT INTO project_flow_steps (
  id,
  flow_id,
  name,
  description,
  step_number,
  is_required
) VALUES (
  gen_random_uuid(),
  '0fdc016a-5a9d-4ef8-8492-ae0593d0ceb5',
  'Technical Requirements',
  'Specify technical details and preferences',
  2,
  true
);

-- Get the step IDs for adding elements
-- We'll use a temporary function to get the step IDs

DO $$
DECLARE
  step1_id UUID;
  step2_id UUID;
BEGIN
  -- Get the step IDs
  SELECT id INTO step1_id FROM project_flow_steps 
  WHERE flow_id = '0fdc016a-5a9d-4ef8-8492-ae0593d0ceb5' AND step_number = 1;
  
  SELECT id INTO step2_id FROM project_flow_steps 
  WHERE flow_id = '0fdc016a-5a9d-4ef8-8492-ae0593d0ceb5' AND step_number = 2;

  -- Add elements to Step 1: Project Overview
  INSERT INTO project_flow_elements (
    step_id,
    element_type,
    element_key,
    label,
    help_text,
    element_order,
    config,
    is_required
  ) VALUES 
  (
    step1_id,
    'text_input',
    'project_name',
    'Project Name',
    'What would you like to call this website project?',
    1,
    '{"placeholder": "Enter project name...", "maxLength": 100}',
    true
  ),
  (
    step1_id,
    'textarea',
    'project_description',
    'Project Description',
    'Briefly describe what this website is for and its main purpose',
    2,
    '{"placeholder": "Describe your website project...", "rows": 4, "maxLength": 500}',
    true
  ),
  (
    step1_id,
    'dropdown',
    'website_type',
    'Website Type',
    'What type of website are you building?',
    3,
    '{"options": [{"value": "business", "label": "Business Website"}, {"value": "ecommerce", "label": "E-commerce Store"}, {"value": "portfolio", "label": "Portfolio"}, {"value": "blog", "label": "Blog"}, {"value": "other", "label": "Other"}]}',
    true
  );

  -- Add elements to Step 2: Technical Requirements
  INSERT INTO project_flow_elements (
    step_id,
    element_type,
    element_key,
    label,
    help_text,
    element_order,
    config,
    is_required
  ) VALUES 
  (
    step2_id,
    'email_input',
    'primary_contact_email',
    'Primary Contact Email',
    'Main email for project communications',
    1,
    '{"placeholder": "contact@company.com"}',
    true
  ),
  (
    step2_id,
    'number_input',
    'estimated_pages',
    'Estimated Number of Pages',
    'Approximately how many pages will the website have?',
    2,
    '{"min": 1, "max": 100, "step": 1, "placeholder": "Enter number of pages"}',
    false
  ),
  (
    step2_id,
    'text_input',
    'target_launch_date',
    'Target Launch Date',
    'When would you like to launch the website?',
    3,
    '{"placeholder": "e.g., January 2025"}',
    false
  );

END $$;

COMMIT; 