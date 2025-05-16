/*
  # Create agents table and security policies

  1. New Tables
    - `agents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `description` (text)
      - `personality` (text)
      - `active` (boolean)
      - `discord_channel` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `agents` table
    - Add policies for authenticated users to:
      - Read their own agents
      - Create new agents
      - Update their own agents
      - Delete their own agents
*/

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  personality text NOT NULL,
  active boolean DEFAULT true,
  discord_channel text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own agents
CREATE POLICY "Users can read own agents"
  ON agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create agents
CREATE POLICY "Users can create agents"
  ON agents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own agents
CREATE POLICY "Users can update own agents"
  ON agents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own agents
CREATE POLICY "Users can delete own agents"
  ON agents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Update updated_at on agent update
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();