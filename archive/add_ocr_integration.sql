-- First, let's check if we have the integrations table and what categories exist
-- Add OCR.Space to the integrations table

-- Insert OCR.Space integration into the API category
INSERT INTO integrations (
  category_id,
  name,
  description,
  icon_name,
  status,
  agent_classification,
  is_popular,
  display_order,
  is_active
) VALUES (
  (SELECT id FROM integration_categories WHERE name = 'API Integrations' OR name ILIKE '%api%' LIMIT 1),
  'OCR.Space API',
  'Extract text from PDFs and images with high accuracy OCR. Perfect for document processing and text recognition with 500 free requests per month.',
  'ScanText',
  'available',
  'tool',
  false,
  10,
  true
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  agent_classification = EXCLUDED.agent_classification,
  display_order = EXCLUDED.display_order;
