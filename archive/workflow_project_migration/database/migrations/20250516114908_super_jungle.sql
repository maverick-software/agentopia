/*
  # Add business details to clients table

  1. New Fields
    - `business_name` (text) - Legal business name
    - `business_type` (text) - Type of business (e.g., LLC, Corporation)
    - `industry` (text) - Business industry
    - `website` (text) - Business website URL
    - `address` (text) - Business address
    - `social_media` (jsonb) - Social media profiles
    - `brand_colors` (jsonb) - Brand color palette
    - `logo_url` (text) - URL to company logo
    - `business_description` (text) - Brief description of the business
    - `target_audience` (jsonb) - Target audience details
    - `competitors` (jsonb) - List of main competitors
    - `goals` (jsonb) - Business goals and objectives

  2. Security
    - Enable RLS on clients table
    - Add policies for authenticated users
*/

-- Add new columns to clients table
ALTER TABLE clients ADD COLUMN business_name text;
ALTER TABLE clients ADD COLUMN business_type text;
ALTER TABLE clients ADD COLUMN industry text;
ALTER TABLE clients ADD COLUMN website text;
ALTER TABLE clients ADD COLUMN address text;
ALTER TABLE clients ADD COLUMN social_media jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN brand_colors jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN logo_url text;
ALTER TABLE clients ADD COLUMN business_description text;
ALTER TABLE clients ADD COLUMN target_audience jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN competitors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN goals jsonb DEFAULT '[]'::jsonb;

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their own clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT client_id 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());