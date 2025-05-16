/*
  # Safe update to agent_datastores schema

  1. Changes
    - Safely check for table existence before creating
    - Add missing indexes if needed
    - Add table comment
    - Ensure proper foreign key constraints
*/

-- Safely add comment to the table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_description 
    JOIN pg_class ON pg_description.objoid = pg_class.oid 
    WHERE pg_class.relname = 'agent_datastores'
  ) THEN
    COMMENT ON TABLE agent_datastores IS 
      'Junction table connecting agents to their associated datastores';
  END IF;
END $$;

-- Safely create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_agent_datastores_agent_id 
  ON agent_datastores(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_datastores_datastore_id 
  ON agent_datastores(datastore_id);

-- Ensure foreign key constraints have ON DELETE CASCADE
DO $$ 
BEGIN
  -- Check agent_id foreign key
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'agent_datastores'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'agent_datastores_agent_id_fkey'
  ) THEN
    ALTER TABLE agent_datastores
      ADD CONSTRAINT agent_datastores_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
  END IF;

  -- Check datastore_id foreign key
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'agent_datastores'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'agent_datastores_datastore_id_fkey'
  ) THEN
    ALTER TABLE agent_datastores
      ADD CONSTRAINT agent_datastores_datastore_id_fkey
      FOREIGN KEY (datastore_id) REFERENCES datastores(id) ON DELETE CASCADE;
  END IF;
END $$;