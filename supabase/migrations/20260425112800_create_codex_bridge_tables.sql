-- Codex CLI bridge job state.
-- The Codex CLI owns ChatGPT OAuth in CODEX_HOME/auth.json on the trusted runner.
-- Do not store Codex OAuth tokens or auth.json contents in these tables.

CREATE TABLE IF NOT EXISTS public.codex_bridge_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'waiting_for_answer', 'complete', 'error', 'cancelled')),
  workdir text NOT NULL,
  prompt text NOT NULL,
  model text,
  approval_policy text NOT NULL DEFAULT 'manual'
    CHECK (approval_policy IN ('manual', 'auto', 'readonly')),
  question text,
  answer text,
  last_output text,
  result text,
  error text,
  runner_id text,
  codex_session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.codex_bridge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.codex_bridge_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codex_bridge_jobs_user_created
  ON public.codex_bridge_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_codex_bridge_jobs_status_created
  ON public.codex_bridge_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_codex_bridge_jobs_agent
  ON public.codex_bridge_jobs(agent_id);

CREATE INDEX IF NOT EXISTS idx_codex_bridge_events_job_created
  ON public.codex_bridge_events(job_id, created_at);

CREATE OR REPLACE FUNCTION public.update_codex_bridge_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_codex_bridge_jobs_updated_at ON public.codex_bridge_jobs;
CREATE TRIGGER trg_codex_bridge_jobs_updated_at
  BEFORE UPDATE ON public.codex_bridge_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_codex_bridge_jobs_updated_at();

ALTER TABLE public.codex_bridge_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codex_bridge_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Codex bridge jobs" ON public.codex_bridge_jobs;
CREATE POLICY "Users can view own Codex bridge jobs"
  ON public.codex_bridge_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own Codex bridge jobs" ON public.codex_bridge_jobs;
CREATE POLICY "Users can insert own Codex bridge jobs"
  ON public.codex_bridge_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own Codex bridge jobs" ON public.codex_bridge_jobs;
CREATE POLICY "Users can update own Codex bridge jobs"
  ON public.codex_bridge_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own Codex bridge events" ON public.codex_bridge_events;
CREATE POLICY "Users can view own Codex bridge events"
  ON public.codex_bridge_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own Codex bridge events" ON public.codex_bridge_events;
CREATE POLICY "Users can insert own Codex bridge events"
  ON public.codex_bridge_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.codex_bridge_jobs TO authenticated;
GRANT SELECT, INSERT ON public.codex_bridge_events TO authenticated;
GRANT ALL ON public.codex_bridge_jobs TO service_role;
GRANT ALL ON public.codex_bridge_events TO service_role;

COMMENT ON TABLE public.codex_bridge_jobs IS
  'Async Codex CLI bridge jobs. OAuth material remains on the trusted runner in CODEX_HOME/auth.json.';

COMMENT ON TABLE public.codex_bridge_events IS
  'Append-only status/log events for Codex CLI bridge jobs with secret-scrubbed payloads.';
