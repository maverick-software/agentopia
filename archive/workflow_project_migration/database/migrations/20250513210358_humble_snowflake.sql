/*
  # Add workflow templates for website development

  1. Changes
    - Insert workflow templates for each phase:
      - Research phase (10 steps)
      - Planning phase (8 steps)
      - Design phase (6 steps)
      - Development phase (7 steps)
*/

-- Insert Research Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('research', 1, 'Existing Website Sitemap', 'Generate a comprehensive sitemap of the client''s existing website'),
('research', 2, 'Marketing Document Analysis', 'Generate a detailed marketing document analyzing the existing website content and messaging'),
('research', 3, 'Ideal Customer Profile', 'Identify and document the Ideal Customer Profile (ICP)'),
('research', 4, 'Competitor Analysis - Selection', 'Identify the top 3 competitors in the market'),
('research', 5, 'Competitor Sitemaps', 'Generate sitemaps for each competitor''s website'),
('research', 6, 'Competitor Marketing Analysis', 'Generate marketing documents analyzing each competitor''s content and strategy'),
('research', 7, 'Strategic Positioning', 'Identify and document strategic positioning opportunities based on competitor analysis'),
('research', 8, 'Brand Assets Collection', 'Download and organize company logo and identify brand colors'),
('research', 9, 'Brand Guide Creation', 'Generate a comprehensive brand guide'),
('research', 10, 'Mood Board Development', 'Generate a mood board for the project');

-- Insert Planning Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('planning', 1, 'Optimized Sitemap', 'Generate an optimized sitemap based on research findings'),
('planning', 2, 'Information Architecture', 'Create an Information Architecture Flowchart for the website'),
('planning', 3, 'Primary Navigation', 'Generate Primary Menu and Submenu Options'),
('planning', 4, 'Footer Structure', 'Generate Footer Menu Options'),
('planning', 5, 'Customer Journey Mapping', 'Create Customer Journey Maps for each web page'),
('planning', 6, 'Marketing Copy', 'Generate marketing copy for each page'),
('planning', 7, 'Content Roadmap', 'Create ideal content roadmap for each page'),
('planning', 8, 'Call to Action Design', 'Generate Call to Action (CTA) strategy and design');

-- Insert Design Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('design', 1, 'Wireframes', 'Generate low-fidelity wireframes for each page'),
('design', 2, 'Image Planning', 'Generate image descriptions for each page'),
('design', 3, 'Image Acquisition', 'Generate or license images based on descriptions'),
('design', 4, 'Video Script', 'Generate script and scene descriptions for marketing videos'),
('design', 5, 'Video Production', 'Generate and edit primary marketing video'),
('design', 6, 'High-Fidelity Mockups', 'Generate high-fidelity mockups for all pages');

-- Insert Development Phase Templates
INSERT INTO workflow_templates (phase, step_number, name, description) VALUES
('development', 1, 'Sitemap Implementation', 'Insert Sitemap into page generator'),
('development', 2, 'Header Development', 'Import and customize Header'),
('development', 3, 'Footer Development', 'Import and customize Footer'),
('development', 4, 'Page Generation', 'Generate each page via Relume'),
('development', 5, 'WordPress Integration', 'Import pages into WordPress'),
('development', 6, 'Navigation Setup', 'Link up all navigation links'),
('development', 7, 'Blog Setup', 'Generate and configure blog section');