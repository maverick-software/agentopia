/*
  # Fix role constraint for users table
  
  1. Changes
    - Drop existing role check constraint
    - Add new role check constraint with correct values
    - Add default role for new users
*/

-- Drop existing role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new role check constraint with correct values
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'project_manager'::text, 'designer'::text, 'developer'::text]));

-- Set default role for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'developer'::text;