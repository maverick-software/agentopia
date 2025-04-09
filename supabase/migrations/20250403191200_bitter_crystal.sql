/*
  # Fix schema constraints and indexes

  1. Changes
    - Add NOT NULL constraints to required fields
    - Add indexes for frequently queried columns
    - Add cascade delete for user_id foreign key
    - Add check constraint for active status

  2. Security
    - Maintain existing RLS policies
*/

-- Add NOT NULL constraints to required fields
ALTER TABLE agents 
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN personality SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);

-- Add cascade delete for user_id foreign key
ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS agents_user_id_fkey,
  ADD CONSTRAINT agents_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Add check constraint for active status
ALTER TABLE agents
  ADD CONSTRAINT check_active_boolean 
  CHECK (active IS NULL OR active IN (true, false));