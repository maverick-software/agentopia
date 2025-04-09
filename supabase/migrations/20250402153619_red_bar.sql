/*
  # Add instruction fields to agents table

  1. Changes
    - Add new columns to `agents` table:
      - `discord_bot_key` (text, nullable) - For storing Discord bot authentication
      - `system_instructions` (text, nullable) - For storing system-level LLM instructions
      - `assistant_instructions` (text, nullable) - For storing assistant-specific instructions

  2. Security
    - Maintain existing RLS policies
    - No changes to security configuration needed
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'discord_bot_key'
  ) THEN
    ALTER TABLE agents ADD COLUMN discord_bot_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'system_instructions'
  ) THEN
    ALTER TABLE agents ADD COLUMN system_instructions text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'assistant_instructions'
  ) THEN
    ALTER TABLE agents ADD COLUMN assistant_instructions text;
  END IF;
END $$;