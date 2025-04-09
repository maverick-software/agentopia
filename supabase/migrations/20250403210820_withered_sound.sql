/*
  # Create datastores table with safe policy creation

  1. New Tables
    - `datastores`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `description` (text)
      - `type` (text) - Either 'pinecone' or 'getzep'
      - `config` (jsonb) - Store connection details
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on datastores table
    - Add policies for authenticated users to:
      - Read their own datastores
      - Create new datastores
      - Update their own datastores
      - Delete their own datastores
*/

-- Create datastores table
CREATE TABLE IF NOT EXISTS datastores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('pinecone', 'getzep')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE datastores ENABLE ROW LEVEL SECURITY;

-- Safely create policies
DO $$ 
BEGIN
  -- Check and create select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'datastores' 
    AND policyname = 'Users can read own datastores'
  ) THEN
    CREATE POLICY "Users can read own datastores"
      ON datastores
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Check and create insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'datastores' 
    AND policyname = 'Users can create datastores'
  ) THEN
    CREATE POLICY "Users can create datastores"
      ON datastores
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'datastores' 
    AND policyname = 'Users can update own datastores'
  ) THEN
    CREATE POLICY "Users can update own datastores"
      ON datastores
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check and create delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'datastores' 
    AND policyname = 'Users can delete own datastores'
  ) THEN
    CREATE POLICY "Users can delete own datastores"
      ON datastores
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_datastores_user_id ON datastores(user_id);
CREATE INDEX IF NOT EXISTS idx_datastores_type ON datastores(type);

-- Update trigger for datastores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_datastores_updated_at'
  ) THEN
    CREATE TRIGGER update_datastores_updated_at
      BEFORE UPDATE ON datastores
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;