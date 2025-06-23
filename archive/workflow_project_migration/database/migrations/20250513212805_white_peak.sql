/*
  # Update workflow templates

  1. Changes
    - Update workflow templates with exact steps and descriptions from the SOP
    - Ensure proper ordering and phase assignments
    - Add detailed descriptions for each step

  2. Security
    - No changes to security policies required
*/

-- Clear existing templates
DELETE FROM workflow_templates;

-- Insert Research Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('research', 1, 'Existing Website Sitemap', 'Get a Sitemap of the existing website'),
('research', 2, 'Marketing Document Analysis', 'Generate a marketing document from the existing website'),
('research', 3, 'Ideal Customer Profile', 'Identify the Ideal Customer Profile (ICP)'),
('research', 4, 'Competitor Analysis', 'Identify the top 3 competitors'),
('research', 5, 'Competitor Sitemaps', 'Generate a sitemap of their existing websites'),
('research', 6, 'Competitor Marketing Analysis', 'Generate a marketing document for each competitor'),
('research', 7, 'Strategic Positioning', 'Identify the strategic positioning opportunities'),
('research', 8, 'Brand Assets Collection', 'Download the company logo, get brand colors'),
('research', 9, 'Brand Guide Creation', 'Generate the Brand Guide'),
('research', 10, 'Mood Board Development', 'Generate the Mood Board');

-- Insert Planning Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('planning', 1, 'Optimized Sitemap', 'Generate an optimized sitemap'),
('planning', 2, 'Information Architecture', 'Generate the Information Architecture Flowchart for the website'),
('planning', 3, 'Navigation Structure', 'Generate the Primary Menu and Submenu Options'),
('planning', 4, 'Footer Structure', 'Generate the Footer Menu Options'),
('planning', 5, 'Customer Journey Mapping', 'Generate the Customer Journey Map for each web page'),
('planning', 6, 'Marketing Copy', 'Generate the marketing copy for each page'),
('planning', 7, 'Content Roadmap', 'Generate the ideal content roadmap for each page'),
('planning', 8, 'Call-to-Action Strategy', 'Generate Call to Action (CTA)');

-- Insert Design Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('design', 1, 'Wireframes', 'Generate low-fidelity wireframes for each page'),
('design', 2, 'Image Requirements', 'Generate the image descriptions for each page'),
('design', 3, 'Image Assets', 'Generate or license the images from the descriptions'),
('design', 4, 'Video Script', 'Generate the script and scene descriptions for any required marketing videos (if applicable)'),
('design', 5, 'Video Production', 'Generate and edit the primary marketing video (if applicable)'),
('design', 6, 'High-Fidelity Mockups', 'Generate high-fidelity mockups');

-- Insert Development Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('development', 1, 'Sitemap Implementation', 'Insert Sitemap into page generator'),
('development', 2, 'Header Development', 'Import Header'),
('development', 3, 'Footer Development', 'Import Footer'),
('development', 4, 'Page Generation', 'Generate each page via Relume'),
('development', 5, 'WordPress Integration', 'Import pages into WordPress'),
('development', 6, 'Navigation Setup', 'Linkup all navigation links'),
('development', 7, 'Blog Setup', 'Generate blogs');