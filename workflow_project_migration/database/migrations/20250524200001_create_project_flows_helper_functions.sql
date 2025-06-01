-- Create helper functions for Project Flows system
BEGIN;

-- JSON validation function for element configurations
CREATE OR REPLACE FUNCTION is_valid_json(input_json jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Simple check - if we can access it as jsonb, it's valid
  RETURN input_json IS NOT NULL;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;

COMMIT; 