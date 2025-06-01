-- Create sample data for Project Flows system
BEGIN;

-- Sample Project Flow: Website Development
INSERT INTO project_flows (
  name,
  description,
  estimated_duration_minutes,
  icon,
  color,
  sort_order,
  requires_products_services,
  requires_template_selection
) VALUES (
  'Website Development Project',
  'Comprehensive workflow for website development projects including requirements gathering, design preferences, and technical specifications.',
  30,
  'globe',
  '#3B82F6',
  1,
  true,
  true
);

-- Sample Project Flow: Mobile App Development
INSERT INTO project_flows (
  name,
  description,
  estimated_duration_minutes,
  icon,
  color,
  sort_order,
  requires_products_services,
  requires_template_selection
) VALUES (
  'Mobile App Development Project',
  'Structured workflow for mobile application projects covering platform selection, feature requirements, and development approach.',
  45,
  'smartphone',
  '#10B981',
  2,
  true,
  true
);

-- Sample Project Flow: Consulting Project
INSERT INTO project_flows (
  name,
  description,
  estimated_duration_minutes,
  icon,
  color,
  sort_order,
  requires_products_services,
  requires_template_selection
) VALUES (
  'Consulting Project',
  'Simple workflow for consulting engagements focusing on scope definition and deliverables.',
  15,
  'briefcase',
  '#8B5CF6',
  3,
  false,
  false
);

COMMIT; 