/*
  # Add competitor information structure
  
  1. New Columns
    - competitors_info: JSONB array to store detailed competitor information including:
      - Business details (name, website, logo)
      - Social media profiles
      - Directory listings
      - Staff information
      
  2. Validation
    - Ensures competitors_info is a valid JSON array
    - Validates structure of each competitor entry
    - Validates staff member information
    - Validates social media links
    
  3. Data Migration
    - Converts existing competitor data to new format
*/

-- Add competitors_info column with default empty array
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS competitors_info JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN clients.competitors_info IS 'Detailed information about competitors including business details, social media, and staff';

-- Create validation functions
CREATE OR REPLACE FUNCTION is_valid_competitor(competitor JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    competitor IS NOT NULL AND
    jsonb_typeof(competitor) = 'object' AND
    competitor ? 'business_name' AND
    jsonb_typeof(competitor -> 'business_name') = 'string'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_staff_member(staff JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    staff IS NOT NULL AND
    jsonb_typeof(staff) = 'object' AND
    staff ? 'name' AND
    jsonb_typeof(staff -> 'name') = 'string'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function for validation
CREATE OR REPLACE FUNCTION validate_competitors_info()
RETURNS TRIGGER AS $$
DECLARE
  competitor JSONB;
  staff_member JSONB;
  social_media JSONB;
BEGIN
  -- Basic array validation
  IF NEW.competitors_info IS NULL OR jsonb_typeof(NEW.competitors_info) != 'array' THEN
    RAISE EXCEPTION 'competitors_info must be a JSON array';
  END IF;

  -- Validate each competitor
  FOR competitor IN SELECT * FROM jsonb_array_elements(NEW.competitors_info)
  LOOP
    -- Check basic competitor structure
    IF NOT is_valid_competitor(competitor) THEN
      RAISE EXCEPTION 'Invalid competitor structure: must include business_name';
    END IF;

    -- Validate optional fields if present
    IF competitor ? 'website' AND jsonb_typeof(competitor -> 'website') != 'string' THEN
      RAISE EXCEPTION 'website must be a string';
    END IF;

    IF competitor ? 'logo_url' AND jsonb_typeof(competitor -> 'logo_url') != 'string' THEN
      RAISE EXCEPTION 'logo_url must be a string';
    END IF;

    IF competitor ? 'google_business_url' AND jsonb_typeof(competitor -> 'google_business_url') != 'string' THEN
      RAISE EXCEPTION 'google_business_url must be a string';
    END IF;

    -- Validate social media if present
    IF competitor ? 'social_media' THEN
      social_media := competitor -> 'social_media';
      IF jsonb_typeof(social_media) != 'object' THEN
        RAISE EXCEPTION 'social_media must be an object';
      END IF;

      -- Validate social media fields if present
      IF social_media ? 'facebook' AND jsonb_typeof(social_media -> 'facebook') != 'string' THEN
        RAISE EXCEPTION 'facebook URL must be a string';
      END IF;
      IF social_media ? 'twitter' AND jsonb_typeof(social_media -> 'twitter') != 'string' THEN
        RAISE EXCEPTION 'twitter URL must be a string';
      END IF;
      IF social_media ? 'linkedin' AND jsonb_typeof(social_media -> 'linkedin') != 'string' THEN
        RAISE EXCEPTION 'linkedin URL must be a string';
      END IF;
      IF social_media ? 'instagram' AND jsonb_typeof(social_media -> 'instagram') != 'string' THEN
        RAISE EXCEPTION 'instagram URL must be a string';
      END IF;
    END IF;

    -- Validate directory listings if present
    IF competitor ? 'directory_listings' THEN
      IF jsonb_typeof(competitor -> 'directory_listings') != 'array' THEN
        RAISE EXCEPTION 'directory_listings must be an array';
      END IF;
    END IF;

    -- Validate staff if present
    IF competitor ? 'staff' THEN
      IF jsonb_typeof(competitor -> 'staff') != 'array' THEN
        RAISE EXCEPTION 'staff must be an array';
      END IF;

      FOR staff_member IN SELECT * FROM jsonb_array_elements(competitor -> 'staff')
      LOOP
        IF NOT is_valid_staff_member(staff_member) THEN
          RAISE EXCEPTION 'Invalid staff member structure: must include name';
        END IF;

        -- Validate optional staff fields
        IF staff_member ? 'linkedin_url' AND jsonb_typeof(staff_member -> 'linkedin_url') != 'string' THEN
          RAISE EXCEPTION 'staff linkedin_url must be a string';
        END IF;
        IF staff_member ? 'role' AND jsonb_typeof(staff_member -> 'role') != 'string' THEN
          RAISE EXCEPTION 'staff role must be a string';
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