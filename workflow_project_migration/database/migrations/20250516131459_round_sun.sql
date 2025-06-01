/*
  # Fix competitors info structure

  1. Changes
    - Add competitors_info column with proper validation
    - Add trigger for validating competitor information
    - Add comment explaining the column purpose
    - Migrate existing competitors data
*/

-- Add competitors_info column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS competitors_info JSONB DEFAULT '[]'::jsonb;

-- Create a function to validate competitor staff information
CREATE OR REPLACE FUNCTION validate_competitors_info()
RETURNS TRIGGER AS $$
DECLARE
  competitor JSONB;
  staff_member JSONB;
BEGIN
  -- Basic array check
  IF jsonb_typeof(NEW.competitors_info) != 'array' THEN
    RAISE EXCEPTION 'competitors_info must be an array';
  END IF;

  -- Validate each competitor
  FOR competitor IN SELECT * FROM jsonb_array_elements(NEW.competitors_info)
  LOOP
    -- Check required fields
    IF competitor->>'business_name' IS NULL THEN
      RAISE EXCEPTION 'business_name is required for each competitor';
    END IF;

    -- Validate social media structure if present
    IF competitor->'social_media' IS NOT NULL THEN
      IF jsonb_typeof(competitor->'social_media') != 'object' THEN
        RAISE EXCEPTION 'social_media must be an object';
      END IF;
    END IF;

    -- Validate staff array if present
    IF competitor->'staff' IS NOT NULL THEN
      IF jsonb_typeof(competitor->'staff') != 'array' THEN
        RAISE EXCEPTION 'staff must be an array';
      END IF;

      -- Validate each staff member
      FOR staff_member IN SELECT * FROM jsonb_array_elements(competitor->'staff')
      LOOP
        IF staff_member->>'name' IS NULL THEN
          RAISE EXCEPTION 'name is required for each staff member';
        END IF;
      END LOOP;
    END IF;

    -- Validate directory_listings if present
    IF competitor->'directory_listings' IS NOT NULL THEN
      IF jsonb_typeof(competitor->'directory_listings') != 'array' THEN
        RAISE EXCEPTION 'directory_listings must be an array';
      END IF;
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

-- Migrate existing competitors data if any exists
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