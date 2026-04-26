ALTER TABLE public.codex_oauth_states
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 minutes');
