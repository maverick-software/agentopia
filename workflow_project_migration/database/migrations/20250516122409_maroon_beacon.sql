/*
  # Fix role constraints and defaults

  1. Changes
    - Drop existing role check constraint
    - Add new role check constraint with correct values
    - Set default role for new users
    - Add NOT NULL constraint to role column
    - Add trigger to ensure role is never null
  
  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity with constraints
*/

-- First drop the existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add NOT NULL constraint to role column
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- Add new role check constraint with correct values
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'project_manager'::text, 'designer'::text, 'developer'::text]));

-- Set default role for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'developer'::text;

-- Create a trigger function to ensure role is never null
CREATE OR REPLACE FUNCTION ensure_user_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NULL THEN
    NEW.role := 'developer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_user_role_trigger ON users;
CREATE TRIGGER ensure_user_role_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_role();