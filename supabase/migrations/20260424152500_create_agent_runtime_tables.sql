-- Agentic runtime state for strict, retry-aware agent execution.
-- Mirrors OpenClaw-style run attempts, liveness, replay safety, plan events,
-- approvals, and resumable checkpoints using tenant-scoped Supabase storage.

CREATE TABLE IF NOT EXISTS public.agent_run_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  workspace_id UUID,
  execution_contract TEXT NOT NULL DEFAULT 'default'
    CHECK (execution_contract IN ('default', 'strict-agentic')),
  liveness_state TEXT NOT NULL DEFAULT 'working'
    CHECK (liveness_state IN ('working', 'paused', 'blocked', 'abandoned')),
  retry_budgets JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id)
);

CREATE TABLE IF NOT EXISTS public.agent_run_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_state_id UUID NOT NULL REFERENCES public.agent_run_states(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  retry_mode TEXT CHECK (retry_mode IN ('planning_only', 'reasoning_only', 'empty_response', 'incomplete_tool_use')),
  steering_instruction TEXT,
  assistant_text TEXT,
  stop_reason TEXT,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  replay_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_state_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.agent_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_state_id UUID REFERENCES public.agent_run_states(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  stream TEXT NOT NULL CHECK (stream IN ('lifecycle', 'assistant', 'tool', 'plan', 'approval', 'checkpoint', 'memory', 'compaction')),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_plan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_state_id UUID NOT NULL REFERENCES public.agent_run_states(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  explanation TEXT,
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'update_plan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_run_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_state_id UUID NOT NULL REFERENCES public.agent_run_states(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('manual', 'auto', 'interval', 'error', 'compaction')),
  description TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_tool_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_state_id UUID REFERENCES public.agent_run_states(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT NOT NULL,
  tool_arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'timeout', 'cancelled')),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_replay_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_state_id UUID NOT NULL REFERENCES public.agent_run_states(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.agent_run_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  had_potential_side_effects BOOLEAN NOT NULL DEFAULT false,
  replay_safe BOOLEAN NOT NULL DEFAULT true,
  mutating_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_sent BOOLEAN NOT NULL DEFAULT false,
  cron_changed BOOLEAN NOT NULL DEFAULT false,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_states_user_agent
  ON public.agent_run_states(user_id, agent_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_states_conversation
  ON public.agent_run_states(conversation_id, session_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_attempts_run
  ON public.agent_run_attempts(run_state_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_session
  ON public.agent_run_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_stream
  ON public.agent_run_events(stream, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_plan_snapshots_run
  ON public.agent_plan_snapshots(run_state_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_checkpoints_run
  ON public.agent_run_checkpoints(run_state_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_approvals_pending
  ON public.agent_tool_approvals(user_id, status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_replay_metadata_run
  ON public.agent_replay_metadata(run_state_id, created_at DESC);

ALTER TABLE public.agent_run_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_plan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_replay_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent run states"
  ON public.agent_run_states FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage agent run states"
  ON public.agent_run_states FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own agent run attempts"
  ON public.agent_run_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.agent_run_states ars
    WHERE ars.id = agent_run_attempts.run_state_id
      AND ars.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage agent run attempts"
  ON public.agent_run_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own agent run events"
  ON public.agent_run_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage agent run events"
  ON public.agent_run_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own plan snapshots"
  ON public.agent_plan_snapshots FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage plan snapshots"
  ON public.agent_plan_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own run checkpoints"
  ON public.agent_run_checkpoints FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage run checkpoints"
  ON public.agent_run_checkpoints FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own tool approvals"
  ON public.agent_tool_approvals FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own tool approvals"
  ON public.agent_tool_approvals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage tool approvals"
  ON public.agent_tool_approvals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own replay metadata"
  ON public.agent_replay_metadata FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage replay metadata"
  ON public.agent_replay_metadata FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.agent_run_states TO authenticated;
GRANT SELECT ON public.agent_run_attempts TO authenticated;
GRANT SELECT ON public.agent_run_events TO authenticated;
GRANT SELECT ON public.agent_plan_snapshots TO authenticated;
GRANT SELECT ON public.agent_run_checkpoints TO authenticated;
GRANT SELECT, UPDATE ON public.agent_tool_approvals TO authenticated;
GRANT SELECT ON public.agent_replay_metadata TO authenticated;

GRANT ALL ON public.agent_run_states TO service_role;
GRANT ALL ON public.agent_run_attempts TO service_role;
GRANT ALL ON public.agent_run_events TO service_role;
GRANT ALL ON public.agent_plan_snapshots TO service_role;
GRANT ALL ON public.agent_run_checkpoints TO service_role;
GRANT ALL ON public.agent_tool_approvals TO service_role;
GRANT ALL ON public.agent_replay_metadata TO service_role;

COMMENT ON TABLE public.agent_run_states IS 'Per-session agent runtime state for execution contracts and liveness.';
COMMENT ON TABLE public.agent_run_attempts IS 'One row per bounded model attempt in the retry-aware agent runtime.';
COMMENT ON TABLE public.agent_run_events IS 'Durable lifecycle/tool/plan/approval/memory/compaction events for chat streaming and audit.';
COMMENT ON TABLE public.agent_plan_snapshots IS 'Plan snapshots emitted by update_plan and runtime plan events.';
COMMENT ON TABLE public.agent_tool_approvals IS 'Human approval requests for risky agent tool calls.';
COMMENT ON TABLE public.agent_replay_metadata IS 'Replay-safety records that prevent unsafe automatic retries after side effects.';
