/*
  # Add branding fields to clients table

  1. New Fields
    - `brand_fonts` (jsonb) - Font specifications for brand
    - `positioning_statement` (text) - Positioning statement
    - `value_proposition` (text) - Value proposition
    - `key_messages` (jsonb) - Array of key messages
*/

-- Add new columns to clients table for branding
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_fonts jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS positioning_statement text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS value_proposition text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS key_messages jsonb DEFAULT '[]'::jsonb;

-- Add comments to describe the fields
COMMENT ON COLUMN clients.brand_fonts IS 'Typography specifications for the brand';
COMMENT ON COLUMN clients.positioning_statement IS 'How the brand is positioned in the market';
COMMENT ON COLUMN clients.value_proposition IS 'The unique value the business offers to customers';
COMMENT ON COLUMN clients.key_messages IS 'Array of key messages for brand communications'; 