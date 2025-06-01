/*
  # Add vision, mission, and ethos fields to clients table

  1. New Fields
    - `vision` (text) - Vision statement
    - `mission` (text) - Mission statement
    - `ethos` (jsonb) - Array of core values/ethos
*/

-- Add new columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vision text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mission text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ethos jsonb DEFAULT '[]'::jsonb;

-- Add comments to describe the fields
COMMENT ON COLUMN clients.vision IS 'Vision statement for the client company';
COMMENT ON COLUMN clients.mission IS 'Mission statement for the client company';
COMMENT ON COLUMN clients.ethos IS 'Array of core values/ethos of the client company'; 