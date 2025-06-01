/*
  # Add detailed competitor tracking
  
  1. Changes
    - Adds competitors_info JSONB column to clients table
    - Adds validation for competitor information structure
    - Migrates existing competitor data to new format
    
  2. Structure
    competitors_info is an array of objects with:
    - business_name (required)
    - website
    - logo_url
    - google_business_url
    - social_media object
    - directory_listings array
    - staff array with name, linkedin_url, role
*/

-- Add competitors_info column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS competitors_info JSONB DEFAULT '[]'::jsonb;

-- Create validation functions
CREATE OR REPLACE FUNCTION is_valid_competitor(competitor JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    jsonb_typeof(competitor) = 'object' AND
    jsonb_typeof(competitor -> 'business_name') = 'string' AND
    (competitor -> 'website' IS NULL OR jsonb_typeof(competitor -> 'website') = 'string') AND
    (competitor -> 'logo_url' IS NULL OR jsonb_typeof(competitor -> 'logo_url') = 'string') AND
    (competitor -> 'google_business_url' IS NULL OR jsonb_typeof(competitor -> 'google_business_url') = 'string') AND
    (competitor -> 'social_media' IS NULL OR jsonb_typeof(competitor -> 'social_media') = 'object') AND
    (competitor -> 'directory_listings' IS NULL OR jsonb_typeof(competitor -> 'directory_listings') = 'array') AND
    (competitor -> 'staff' IS NULL OR jsonb_typeof(competitor -> 'staff') = 'array')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_staff_member(staff JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    jsonb_typeof(staff) = 'object' AND
    jsonb_typeof(staff -> 'name') = 'string' AND
    (staff -> 'linkedin_url' IS NULL OR jsonb_typeof(staff -> 'linkedin_url') = 'string') AND
    (staff -> 'role' IS NULL OR jsonb_typeof(staff -> 'role') = 'string')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_social_media(social JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    jsonb_typeof(social) = 'object' AND
    (social -> 'facebook' IS NULL OR jsonb_typeof(social -> 'facebook') = 'string') AND
    (social -> 'twitter' IS NULL OR jsonb_typeof(social -> 'twitter') = 'string') AND
    (social -> 'linkedin' IS NULL OR jsonb_typeof(social -> 'linkedin') = 'string') AND
    (social -> 'instagram' IS NULL OR jsonb_typeof(social -> 'instagram') = 'string')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function for validation
CREATE OR REPLACE FUNCTION validate_competitors_info()
RETURNS TRIGGER AS $$
DECLARE
  competitor JSONB;
  staff_member JSONB;
BEGIN
  IF NEW.competitors_info IS NULL OR jsonb_typeof(NEW.competitors_info) != 'array' THEN
    RAISE EXCEPTION 'competitors_info must be a JSON array';
  END IF;

  FOR competitor IN SELECT * FROM jsonb_array_elements(NEW.competitors_info)
  LOOP
    IF NOT is_valid_competitor(competitor) THEN
      RAISE EXCEPTION 'Invalid competitor structure';
    END IF;

    -- Validate social media if present
    IF competitor -> 'social_media' IS NOT NULL AND NOT is_valid_social_media(competitor -> 'social_media') THEN
      RAISE EXCEPTION 'Invalid social media structure';
    END IF;

    -- Validate staff if present
    IF competitor -> 'staff' IS NOT NULL THEN
      FOR staff_member IN SELECT * FROM jsonb_array_elements(competitor -> 'staff')
      LOOP
        IF NOT is_valid_staff_member(staff_member) THEN
          RAISE EXCEPTION 'Invalid staff member structure';
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS validate_competitors_info_trigger ON clients;
CREATE TRIGGER validate_competitors_info_trigger
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  WHEN (NEW.competitors_info IS NOT NULL)
  EXECUTE FUNCTION validate_competitors_info();

-- Add comment explaining the column
COMMENT ON COLUMN clients.competitors_info IS 'Detailed information about competitors including business details, social media, and staff';

-- Migrate existing competitors data
UPDATE clients
SET competitors_info = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'business_name', competitor,
      'website', NULL,
      'logo_url', NULL,
      'google_business_url', NULL,
      'social_media', '{}',
      'directory_listings', '[]',
      'staff', '[]'
    )
  )
  FROM jsonb_array_elements_text(competitors) competitor
)
WHERE competitors IS NOT NULL AND jsonb_array_length(competitors) > 0;