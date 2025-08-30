-- Deploy task_steps migrations manually
-- This bypasses the migration conflict issue

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create task_step_status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_step_status') THEN
        CREATE TYPE public.task_step_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
    END IF;
END
$$;

-- Create task_steps table
CREATE TABLE IF NOT EXISTS public.task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  include_previous_context BOOLEAN DEFAULT false,
  context_data JSONB DEFAULT '{}'::jsonb,
  status public.task_step_status DEFAULT 'pending',
  execution_result JSONB DEFAULT '{}'::jsonb,
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  execution_duration_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_task_id') THEN
        CREATE INDEX idx_task_steps_task_id ON public.task_steps(task_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_step_order') THEN
        CREATE INDEX idx_task_steps_step_order ON public.task_steps(step_order);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_status') THEN
        CREATE INDEX idx_task_steps_status ON public.task_steps(status);
    END IF;
END
$$;

-- Enable RLS
ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'Allow read access to task steps for task owner') THEN
        CREATE POLICY "Allow read access to task steps for task owner" ON public.task_steps
          FOR SELECT USING (EXISTS (SELECT 1 FROM public.agent_tasks WHERE id = task_id AND user_id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'Allow insert access to task steps for task owner') THEN
        CREATE POLICY "Allow insert access to task steps for task owner" ON public.task_steps
          FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.agent_tasks WHERE id = task_id AND user_id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'Allow update access to task steps for task owner') THEN
        CREATE POLICY "Allow update access to task steps for task owner" ON public.task_steps
          FOR UPDATE USING (EXISTS (SELECT 1 FROM public.agent_tasks WHERE id = task_id AND user_id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'Allow delete access to task steps for task owner') THEN
        CREATE POLICY "Allow delete access to task steps for task owner" ON public.task_steps
          FOR DELETE USING (EXISTS (SELECT 1 FROM public.agent_tasks WHERE id = task_id AND user_id = auth.uid()));
    END IF;
END
$$;

-- Add columns to agent_tasks if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'is_multi_step') THEN
        ALTER TABLE public.agent_tasks ADD COLUMN is_multi_step BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'step_count') THEN
        ALTER TABLE public.agent_tasks ADD COLUMN step_count INTEGER DEFAULT 0;
    END IF;
END
$$;

-- Create execute_sql function for pg_cron operations
CREATE OR REPLACE FUNCTION public.execute_sql(sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO authenticated;

-- Function 1: Create Task Step
CREATE OR REPLACE FUNCTION public.create_task_step(
    p_task_id UUID,
    p_step_name TEXT,
    p_instructions TEXT,
    p_include_previous_context BOOLEAN DEFAULT FALSE,
    p_step_order INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_task_exists BOOLEAN;
    v_step_id UUID;
    v_final_step_order INTEGER;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User must be authenticated');
    END IF;

    -- Verify task exists and belongs to the user
    SELECT EXISTS (SELECT 1 FROM public.agent_tasks WHERE id = p_task_id AND user_id = v_user_id) INTO v_task_exists;

    IF NOT v_task_exists THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Task not found or access denied');
    END IF;

    -- Determine the step order if not provided
    IF p_step_order IS NULL THEN
        SELECT COALESCE(MAX(step_order), 0) + 1 INTO v_final_step_order
        FROM public.task_steps
        WHERE task_id = p_task_id;
    ELSE
        -- If a specific order is provided, shift existing steps
        UPDATE public.task_steps
        SET step_order = step_order + 1
        WHERE task_id = p_task_id AND step_order >= p_step_order;
        v_final_step_order := p_step_order;
    END IF;

    INSERT INTO public.task_steps (
        task_id,
        step_order,
        step_name,
        instructions,
        include_previous_context
    ) VALUES (
        p_task_id,
        v_final_step_order,
        p_step_name,
        p_instructions,
        p_include_previous_context
    )
    RETURNING id INTO v_step_id;

    -- Update task's step_count and is_multi_step flag
    UPDATE public.agent_tasks
    SET
        step_count = (SELECT COUNT(*) FROM public.task_steps WHERE task_id = p_task_id),
        is_multi_step = TRUE,
        updated_at = NOW()
    WHERE id = p_task_id;

    RETURN jsonb_build_object('success', TRUE, 'step_id', v_step_id, 'step_order', v_final_step_order);

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$$;

-- Function 2: Update Task Step
CREATE OR REPLACE FUNCTION public.update_task_step(
    p_step_id UUID,
    p_step_name TEXT DEFAULT NULL,
    p_instructions TEXT DEFAULT NULL,
    p_include_previous_context BOOLEAN DEFAULT NULL,
    p_step_order INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_task_id UUID;
    v_old_step_order INTEGER;
    v_task_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User must be authenticated');
    END IF;

    -- Get task_id and old_step_order, and verify ownership
    SELECT ts.task_id, ts.step_order INTO v_task_id, v_old_step_order
    FROM public.task_steps ts
    JOIN public.agent_tasks at ON ts.task_id = at.id
    WHERE ts.id = p_step_id AND at.user_id = v_user_id;

    IF v_task_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Task step not found or access denied');
    END IF;

    -- Handle reordering if p_step_order is provided and different
    IF p_step_order IS NOT NULL AND p_step_order != v_old_step_order THEN
        IF p_step_order < v_old_step_order THEN
            -- Shift steps up
            UPDATE public.task_steps
            SET step_order = step_order + 1
            WHERE task_id = v_task_id AND step_order >= p_step_order AND step_order < v_old_step_order;
        ELSE
            -- Shift steps down
            UPDATE public.task_steps
            SET step_order = step_order - 1
            WHERE task_id = v_task_id AND step_order > v_old_step_order AND step_order <= p_step_order;
        END IF;
    END IF;

    UPDATE public.task_steps
    SET
        step_name = COALESCE(p_step_name, step_name),
        instructions = COALESCE(p_instructions, instructions),
        include_previous_context = COALESCE(p_include_previous_context, include_previous_context),
        step_order = COALESCE(p_step_order, step_order),
        updated_at = NOW()
    WHERE id = p_step_id
    RETURNING task_id INTO v_task_id;

    -- Update task's updated_at
    UPDATE public.agent_tasks
    SET updated_at = NOW()
    WHERE id = v_task_id;

    RETURN jsonb_build_object('success', TRUE, 'step_id', p_step_id);

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$$;

-- Function 3: Delete Task Step
CREATE OR REPLACE FUNCTION public.delete_task_step(
    p_step_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_task_id UUID;
    v_deleted_step_order INTEGER;
    v_remaining_steps INTEGER;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User must be authenticated');
    END IF;

    -- Get task_id and step_order, and verify ownership
    SELECT ts.task_id, ts.step_order INTO v_task_id, v_deleted_step_order
    FROM public.task_steps ts
    JOIN public.agent_tasks at ON ts.task_id = at.id
    WHERE ts.id = p_step_id AND at.user_id = v_user_id;

    IF v_task_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Task step not found or access denied');
    END IF;

    DELETE FROM public.task_steps
    WHERE id = p_step_id;

    -- Shift remaining steps up
    UPDATE public.task_steps
    SET step_order = step_order - 1
    WHERE task_id = v_task_id AND step_order > v_deleted_step_order;

    -- Update task's step_count and is_multi_step flag
    SELECT COUNT(*) INTO v_remaining_steps FROM public.task_steps WHERE task_id = v_task_id;

    UPDATE public.agent_tasks
    SET
        step_count = v_remaining_steps,
        is_multi_step = (v_remaining_steps > 0),
        updated_at = NOW()
    WHERE id = v_task_id;

    RETURN jsonb_build_object('success', TRUE, 'deleted_step_id', p_step_id);

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$$;

-- Grant execute permissions for task step functions
GRANT EXECUTE ON FUNCTION public.create_task_step(UUID, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_task_step(UUID, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_task_step(UUID) TO authenticated;
