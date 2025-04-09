/*
  # Create datastores and datastore connections tables

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
    
    - `agent_datastores`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references agents)
      - `datastore_id` (uuid, references datastores)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - Read their own datastores
      - Create new datastores
      - Update their own datastores
      - Delete their own datastores
      - Manage agent-datastore connections
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

-- Create agent_datastores junction table
CREATE TABLE IF NOT EXISTS agent_datastores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents ON DELETE CASCADE NOT NULL,
  datastore_id uuid REFERENCES datastores ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, datastore_id)
);

-- Enable RLS
ALTER TABLE datastores ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_datastores ENABLE ROW LEVEL SECURITY;

-- Policies for datastores
CREATE POLICY "Users can read own datastores"
  ON datastores
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create datastores"
  ON datastores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own datastores"
  ON datastores
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own datastores"
  ON datastores
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for agent_datastores
CREATE POLICY "Users can manage own agent datastores"
  ON agent_datastores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_datastores.agent_id
      AND agents.user_id = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_datastores_user_id ON datastores(user_id);
CREATE INDEX IF NOT EXISTS idx_datastores_type ON datastores(type);
CREATE INDEX IF NOT EXISTS idx_agent_datastores_agent_id ON agent_datastores(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_datastores_datastore_id ON agent_datastores(datastore_id);

-- Update trigger for datastores
CREATE TRIGGER update_datastores_updated_at
  BEFORE UPDATE ON datastores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();