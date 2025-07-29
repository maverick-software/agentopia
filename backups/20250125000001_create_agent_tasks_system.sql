-- Migration: Create Agent Tasks System
-- Purpose: Enable agents to have scheduled and event-based tasks

-- Create enum for task types
CREATE TYPE task_type_enum AS ENUM ('scheduled', 'event_based');

-- Create enum for task status
CREATE TYPE task_status_enum AS ENUM ('active', 'paused', 'completed', 'failed', 'cancelled');

-- Create enum for event trigger types
CREATE TYPE event_trigger_type_enum AS ENUM (
    'email_received', 
    'integration_webhook', 
    'time_based', 
    'manual',
    'agent_mentioned',
    'file_uploaded',
    'workspace_message'
);

-- Create enum for task execution status
CREATE TYPE task_execution_status_enum AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Main agent tasks table
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic task information
    name TEXT NOT NULL,
    description TEXT,
    task_type task_type_enum NOT NULL DEFAULT 'scheduled',
    status task_status_enum NOT NULL DEFAULT 'active',
    
    -- Task configuration
    instructions TEXT NOT NULL, -- The prompt/instructions for the agent
    selected_tools JSONB DEFAULT '[]'::jsonb, -- Array of tool IDs that the agent can use for this task
    
    -- Scheduling configuration (for scheduled tasks)
    cron_expression TEXT, -- Cron expression for scheduled tasks
    timezone TEXT DEFAULT 'UTC', -- Timezone for scheduling
    next_run_at TIMESTAMPTZ, -- Next scheduled execution time
    last_run_at TIMESTAMPTZ, -- Last execution time
    
    -- Event-based configuration (for event-based tasks)
    event_trigger_type event_trigger_type_enum,
    event_trigger_config JSONB DEFAULT '{}'::jsonb, -- Configuration for event triggers
    
    -- Execution tracking
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    max_executions INTEGER, -- Optional limit on total executions
    
    -- Timing constraints
    start_date TIMESTAMPTZ, -- When the task becomes active
    end_date TIMESTAMPTZ, -- When the task expires
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_cron_for_scheduled CHECK (
        (task_type = 'scheduled' AND cron_expression IS NOT NULL) OR 
        (task_type = 'event_based')
    ),
    CONSTRAINT valid_event_for_event_based CHECK (
        (task_type = 'event_based' AND event_trigger_type IS NOT NULL) OR 
        (task_type = 'scheduled')
    ),
    CONSTRAINT max_executions_positive CHECK (max_executions IS NULL OR max_executions > 0),
    CONSTRAINT valid_date_range CHECK (start_date IS NULL OR end_date IS NULL OR start_date < end_date)
);

-- Task executions table to track individual runs
CREATE TABLE IF NOT EXISTS agent_task_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Execution details
    status task_execution_status_enum NOT NULL DEFAULT 'pending',
    trigger_type TEXT NOT NULL, -- 'scheduled', 'event', 'manual'
    trigger_data JSONB DEFAULT '{}'::jsonb, -- Data about what triggered the execution
    
    -- Execution context
    instructions_used TEXT NOT NULL, -- The actual instructions that were used
    tools_used JSONB DEFAULT '[]'::jsonb, -- Tools that were actually used
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER, -- Execution duration in milliseconds
    
    -- Results
    output TEXT, -- The agent's output/response
    tool_outputs JSONB DEFAULT '[]'::jsonb, -- Outputs from tool executions
    error_message TEXT, -- Error message if failed
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional execution metadata
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_duration CHECK (
        (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND duration_ms IS NOT NULL) OR
        (status != 'completed')
    ),
    CONSTRAINT valid_timing CHECK (started_at IS NULL OR completed_at IS NULL OR started_at <= completed_at)
);

-- Event triggers table for complex event-based tasks
CREATE TABLE IF NOT EXISTS agent_task_event_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    
    -- Trigger configuration
    trigger_type event_trigger_type_enum NOT NULL,
    trigger_name TEXT NOT NULL, -- Human-readable name for the trigger
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Specific configuration for this trigger type
    
    -- State tracking
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    
    -- Constraints and filters
    conditions JSONB DEFAULT '{}'::jsonb, -- Conditions that must be met for trigger to fire
    cooldown_minutes INTEGER DEFAULT 0, -- Minimum minutes between triggers
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT cooldown_non_negative CHECK (cooldown_minutes >= 0)
);

-- Indexes for performance
CREATE INDEX idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_task_type ON agent_tasks(task_type);
CREATE INDEX idx_agent_tasks_next_run_at ON agent_tasks(next_run_at) WHERE status = 'active' AND task_type = 'scheduled';
CREATE INDEX idx_agent_tasks_event_trigger_type ON agent_tasks(event_trigger_type) WHERE task_type = 'event_based';

CREATE INDEX idx_agent_task_executions_task_id ON agent_task_executions(task_id);
CREATE INDEX idx_agent_task_executions_agent_id ON agent_task_executions(agent_id);
CREATE INDEX idx_agent_task_executions_status ON agent_task_executions(status);
CREATE INDEX idx_agent_task_executions_created_at ON agent_task_executions(created_at);

CREATE INDEX idx_agent_task_event_triggers_task_id ON agent_task_event_triggers(task_id);
CREATE INDEX idx_agent_task_event_triggers_trigger_type ON agent_task_event_triggers(trigger_type);
CREATE INDEX idx_agent_task_event_triggers_is_active ON agent_task_event_triggers(is_active);
CREATE INDEX idx_agent_task_event_triggers_last_triggered_at ON agent_task_event_triggers(last_triggered_at);

-- Row Level Security (RLS) Policies
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_event_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_tasks
CREATE POLICY "Users can view their own agent tasks" ON agent_tasks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create tasks for their own agents" ON agent_tasks
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_tasks.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own agent tasks" ON agent_tasks
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own agent tasks" ON agent_tasks
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for agent_task_executions
CREATE POLICY "Users can view their own task executions" ON agent_task_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agent_tasks 
            WHERE agent_tasks.id = agent_task_executions.task_id 
            AND agent_tasks.user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage task executions" ON agent_task_executions
    FOR ALL USING (true); -- This will be restricted to service role in practice

-- RLS Policies for agent_task_event_triggers
CREATE POLICY "Users can view their own task event triggers" ON agent_task_event_triggers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agent_tasks 
            WHERE agent_tasks.id = agent_task_event_triggers.task_id 
            AND agent_tasks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own task event triggers" ON agent_task_event_triggers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agent_tasks 
            WHERE agent_tasks.id = agent_task_event_triggers.task_id 
            AND agent_tasks.user_id = auth.uid()
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_task_executions_updated_at BEFORE UPDATE ON agent_task_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_task_event_triggers_updated_at BEFORE UPDATE ON agent_task_event_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next run time for scheduled tasks
CREATE OR REPLACE FUNCTION calculate_next_run_time(
    cron_expr TEXT,
    timezone_name TEXT DEFAULT 'UTC',
    from_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
    -- This is a placeholder. In practice, you'd implement proper cron parsing
    -- or call out to a function that uses a cron library
    -- For now, we'll return a simple future time
    RETURN from_time + INTERVAL '1 hour';
END;
$$;

-- Comments for documentation
COMMENT ON TABLE agent_tasks IS 'Stores scheduled and event-based tasks for agents';
COMMENT ON TABLE agent_task_executions IS 'Tracks individual executions of agent tasks';
COMMENT ON TABLE agent_task_event_triggers IS 'Defines event triggers for event-based tasks';

COMMENT ON COLUMN agent_tasks.instructions IS 'The prompt/instructions that will be given to the agent when the task executes';
COMMENT ON COLUMN agent_tasks.selected_tools IS 'Array of tool IDs that the agent is allowed to use for this specific task';
COMMENT ON COLUMN agent_tasks.cron_expression IS 'Cron expression for scheduled tasks (required for scheduled tasks)';
COMMENT ON COLUMN agent_tasks.event_trigger_config IS 'Configuration specific to the event trigger type';
COMMENT ON COLUMN agent_task_executions.trigger_data IS 'Data about what triggered this execution (e.g., email content, webhook payload)';
COMMENT ON COLUMN agent_task_executions.tool_outputs IS 'Outputs from each tool that was used during execution'; 