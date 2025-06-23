/*
  # Fix clients table RLS policies
  
  1. Changes
    - Enable RLS on clients table
    - Add policies for CRUD operations with proper checks
  
  2. Security
    - Users can only insert their own clients
    - Users can only update their own clients
    - Users can only delete their own clients
    - Users can view their own clients and clients from projects they're members of
*/

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'clients' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
  DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
  DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;
  DROP POLICY IF EXISTS "Users can view their own clients and project-related clients" ON clients;
END $$;

-- Recreate policies
CREATE POLICY "Users can insert their own clients"
ON clients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own clients"
ON clients
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own clients"
ON clients
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can view their own clients and project-related clients"
ON clients
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by OR
  id IN (
    SELECT p.client_id
    FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
  )
);