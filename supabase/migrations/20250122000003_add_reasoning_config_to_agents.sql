-- Add reasoning configuration to agents table
-- This allows per-agent reasoning settings and preferences

-- Add reasoning_config column to agents table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'reasoning_config'
  ) THEN
    ALTER TABLE agents ADD COLUMN reasoning_config JSONB DEFAULT '{
      "enabled": true,
      "threshold": 0.3,
      "max_iterations": 6,
      "confidence_threshold": 0.85,
      "preferred_styles": ["inductive", "deductive", "abductive"],
      "timeout_ms": 30000,
      "safety_switch_enabled": true
    }'::jsonb;
  END IF;
END $$;

-- Create index for reasoning config queries
CREATE INDEX IF NOT EXISTS idx_agents_reasoning_config ON agents USING GIN (reasoning_config);

-- Add comment
COMMENT ON COLUMN agents.reasoning_config IS 'JSON configuration for agent reasoning behavior including thresholds, styles, and safety settings';

-- Update existing agents to have default reasoning config if they don't have one
UPDATE agents 
SET reasoning_config = '{
  "enabled": true,
  "threshold": 0.3,
  "max_iterations": 6,
  "confidence_threshold": 0.85,
  "preferred_styles": ["inductive", "deductive", "abductive"],
  "timeout_ms": 30000,
  "safety_switch_enabled": true
}'::jsonb
WHERE reasoning_config IS NULL OR reasoning_config = '{}'::jsonb;
