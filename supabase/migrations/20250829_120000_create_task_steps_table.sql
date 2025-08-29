-- Create Multi-Step Task Workflow System
-- Date: August 29, 2025
-- Purpose: Add sequential step support to scheduled tasks with context passing

BEGIN;

-- Create enum for task step status
CREATE TYPE task_step_status AS ENUM (
    'pending',
    'running', 
    'completed',
    'failed',
    'skipped'
);

-- Task Steps Table
-- Stores individual steps within a scheduled task for sequential execution
CREATE TABLE task_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    
    -- Step identification and ordering
    step_order INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    instructions TEXT NOT NULL,
    
    -- Context management
    include_previous_context BOOLEAN NOT NULL DEFAULT false,
    context_data JSONB DEFAULT '{}'::jsonb,
    
    -- Execution tracking
    status task_step_status NOT NULL DEFAULT 'pending',
    execution_result JSONB DEFAULT '{}'::jsonb,
    execution_started_at TIMESTAMPTZ,
    execution_completed_at TIMESTAMPTZ,
    execution_duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT task_steps_step_order_positive CHECK (step_order > 0),
    CONSTRAINT task_steps_retry_count_non_negative CHECK (retry_count >= 0),
    CONSTRAINT task_steps_step_name_length CHECK (char_length(step_name) BETWEEN 1 AND 100),
    CONSTRAINT task_steps_instructions_length CHECK (char_length(instructions) BETWEEN 10 AND 5000),
    CONSTRAINT unique_task_step_order UNIQUE (task_id, step_order)
);

-- Performance indexes for common query patterns
CREATE INDEX idx_task_steps_task_id ON task_steps(task_id);
CREATE INDEX idx_task_steps_task_order ON task_steps(task_id, step_order);
CREATE INDEX idx_task_steps_status ON task_steps(status);
CREATE INDEX idx_task_steps_pending_order ON task_steps(task_id, step_order) WHERE status = 'pending';
CREATE INDEX idx_task_steps_execution_time ON task_steps(execution_started_at, execution_completed_at);

-- JSONB indexes for context and result queries
CREATE INDEX idx_task_steps_context_gin ON task_steps USING GIN (context_data);
CREATE INDEX idx_task_steps_result_gin ON task_steps USING GIN (execution_result);

-- Enable Row Level Security
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can access steps for their own agent tasks
CREATE POLICY task_steps_user_access ON task_steps
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM agent_tasks at
            WHERE at.id = task_id
            AND at.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agent_tasks at
            WHERE at.id = task_id
            AND at.user_id = auth.uid()
        )
    );

-- Service role has full access for system operations
CREATE POLICY task_steps_service_access ON task_steps
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Update trigger for task_steps
CREATE OR REPLACE FUNCTION update_task_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_steps_updated_at_trigger
    BEFORE UPDATE ON task_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_task_steps_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON task_steps TO authenticated;
GRANT USAGE ON TYPE task_step_status TO authenticated;

-- Add table comments for documentation
COMMENT ON TABLE task_steps IS 'Individual steps within scheduled tasks supporting sequential execution with context passing';
COMMENT ON COLUMN task_steps.step_order IS 'Execution order of steps within a task (1, 2, 3...)';
COMMENT ON COLUMN task_steps.include_previous_context IS 'Whether to include previous step execution result as context';
COMMENT ON COLUMN task_steps.context_data IS 'JSONB storage for context data passed from previous steps';
COMMENT ON COLUMN task_steps.execution_result IS 'JSONB storage for step execution results and agent responses';
COMMENT ON TYPE task_step_status IS 'Enum defining step execution states: pending, running, completed, failed, skipped';

COMMIT;
