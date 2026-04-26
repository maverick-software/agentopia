import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

type BridgeAction = 'dispatch' | 'status' | 'answer' | 'cancel' | 'result' | 'health';
type JsonObject = Record<string, unknown>;

interface CodexBridgeJob {
  id: string;
  user_id: string;
  agent_id: string | null;
  credential_id?: string | null;
  status: string;
  model?: string | null;
  approval_policy?: string;
  result?: string | null;
  error?: string | null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const runnerUrl = Deno.env.get('CODEX_BRIDGE_RUNNER_URL') || '';
const runnerSecret = Deno.env.get('CODEX_BRIDGE_RUNNER_SECRET') || '';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await safeJson(req);
    const action = (body.action || 'status') as BridgeAction;
    const auth = await resolveAuth(req, stringParam(body.user_id));

    if (!auth.userId) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    switch (action) {
      case 'dispatch':
        return await dispatchJob(body, auth.userId);
      case 'status':
        return await getStatus(body, auth.userId);
      case 'answer':
        return await answerQuestion(body, auth.userId);
      case 'cancel':
        return await cancelJob(body, auth.userId);
      case 'result':
        return await getResult(body, auth.userId);
      case 'health':
        return await getHealth();
      default:
        return json({ success: false, error: `Unsupported action: ${action}` }, 400);
    }
  } catch (error: unknown) {
    console.error('[codex-bridge] Unhandled error:', error);
    return json({ success: false, error: errorMessage(error, 'Internal server error') }, 500);
  }
});

async function dispatchJob(body: JsonObject, userId: string): Promise<Response> {
  const params = requestParams(body);
  const agentId = stringParam(body.agent_id || params.agent_id) || null;
  const prompt = stringParam(params.prompt || params.task || params.instructions);
  const workdir = stringParam(params.workdir || params.workspace_path);
  const credentialId = stringParam(params.credential_id) || await resolveCodexCredentialId(userId);

  if (!prompt) return json({ success: false, error: 'prompt is required' }, 400);
  if (!workdir) return json({ success: false, error: 'workdir is required' }, 400);
  if (!credentialId) return json({ success: false, error: 'Codex OAuth connection required' }, 409);

  if (agentId) {
    const allowed = await canUseAgent(agentId, userId);
    if (!allowed) return json({ success: false, error: 'Agent is not available to this user' }, 403);
  }

  const { data: job, error } = await supabase
    .from('codex_bridge_jobs')
    .insert({
      user_id: userId,
      agent_id: agentId,
      workdir,
      prompt,
      credential_id: credentialId,
      model: stringParam(params.model) || null,
      approval_policy: stringParam(params.approval_policy) || 'manual',
      metadata: sanitizeMetadata(asObject(params.metadata)),
    })
    .select('*')
    .single();

  if (error) return json({ success: false, error: error.message }, 400);

  await recordEvent(job.id, userId, agentId, 'queued', 'Codex bridge job queued', {
    model: job.model,
    approval_policy: job.approval_policy,
    credential_id: job.credential_id,
  });

  notifyRunner(job.id).catch((err) => {
    console.warn('[codex-bridge] Runner notify failed:', err?.message || err);
  });

  return json({ success: true, data: { job } });
}

async function getStatus(body: JsonObject, userId: string): Promise<Response> {
  const params = requestParams(body);
  const jobId = stringParam(body.job_id || params.job_id);
  if (!jobId) return json({ success: false, error: 'job_id is required' }, 400);

  const job = await fetchOwnedJob(jobId, userId);
  if (!job) return json({ success: false, error: 'Job not found' }, 404);

  const { data: events } = await supabase
    .from('codex_bridge_events')
    .select('event_type,message,payload,created_at')
    .eq('job_id', jobId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(25);

  return json({ success: true, data: { job, events: events || [] } });
}

async function answerQuestion(body: JsonObject, userId: string): Promise<Response> {
  const params = requestParams(body);
  const jobId = stringParam(params.job_id || body.job_id);
  const answer = stringParam(params.answer);
  if (!jobId || !answer) return json({ success: false, error: 'job_id and answer are required' }, 400);

  const job = await fetchOwnedJob(jobId, userId);
  if (!job) return json({ success: false, error: 'Job not found' }, 404);
  if (job.status !== 'waiting_for_answer') {
    return json({ success: false, error: `Job is ${job.status}, not waiting_for_answer` }, 409);
  }

  const { data, error } = await supabase
    .from('codex_bridge_jobs')
    .update({ status: 'queued', answer, question: null })
    .eq('id', jobId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return json({ success: false, error: error.message }, 400);

  await recordEvent(jobId, userId, job.agent_id, 'answered', 'Answer submitted for Codex bridge job', {});
  notifyRunner(jobId).catch(() => undefined);
  return json({ success: true, data: { job: data } });
}

async function cancelJob(body: JsonObject, userId: string): Promise<Response> {
  const params = requestParams(body);
  const jobId = stringParam(body.job_id || params.job_id);
  if (!jobId) return json({ success: false, error: 'job_id is required' }, 400);

  const job = await fetchOwnedJob(jobId, userId);
  if (!job) return json({ success: false, error: 'Job not found' }, 404);

  const { data, error } = await supabase
    .from('codex_bridge_jobs')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return json({ success: false, error: error.message }, 400);

  await recordEvent(jobId, userId, job.agent_id, 'cancelled', 'Codex bridge job cancelled', {});
  notifyRunner(jobId).catch(() => undefined);
  return json({ success: true, data: { job: data } });
}

async function getResult(body: JsonObject, userId: string): Promise<Response> {
  const params = requestParams(body);
  const jobId = stringParam(body.job_id || params.job_id);
  if (!jobId) return json({ success: false, error: 'job_id is required' }, 400);
  const job = await fetchOwnedJob(jobId, userId);
  if (!job) return json({ success: false, error: 'Job not found' }, 404);
  return json({ success: true, data: { status: job.status, result: job.result, error: job.error, job } });
}

async function getHealth(): Promise<Response> {
  if (!runnerUrl) {
    return json({ success: true, data: { runner_configured: false } });
  }

  try {
    const resp = await fetch(`${runnerUrl.replace(/\/$/, '')}/health`, {
      headers: runnerSecret ? { 'x-codex-bridge-secret': runnerSecret } : {},
    });
    const data = await resp.json().catch(() => ({}));
    return json({ success: resp.ok, data: { runner_configured: true, runner: data } }, resp.ok ? 200 : 502);
  } catch (error: unknown) {
    return json({ success: false, error: errorMessage(error, 'Runner health check failed') }, 502);
  }
}

async function resolveAuth(req: Request, bodyUserId?: string): Promise<{ userId: string | null }> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (token && token === serviceKey && bodyUserId) {
    return { userId: bodyUserId };
  }

  if (!token) return { userId: null };
  const { data } = await supabase.auth.getUser(token);
  return { userId: data?.user?.id || null };
}

async function canUseAgent(agentId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[codex-bridge] Agent permission check failed:', error.message);
    return false;
  }
  return !!data;
}

async function fetchOwnedJob(jobId: string, userId: string): Promise<CodexBridgeJob | null> {
  const { data, error } = await supabase
    .from('codex_bridge_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as CodexBridgeJob | null;
}

async function resolveCodexCredentialId(userId: string): Promise<string> {
  const { data: provider, error: providerError } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'openai-codex')
    .maybeSingle();
  if (providerError || !provider?.id) {
    console.warn('[codex-bridge] OpenAI Codex service provider missing:', providerError?.message);
    return '';
  }

  const { data: credential, error } = await supabase
    .from('user_integration_credentials')
    .select('id')
    .eq('user_id', userId)
    .eq('oauth_provider_id', provider.id)
    .eq('connection_status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[codex-bridge] Codex credential lookup failed:', error.message);
    return '';
  }
  return credential?.id || '';
}

async function recordEvent(
  jobId: string,
  userId: string,
  agentId: string | null,
  eventType: string,
  message: string,
  payload: JsonObject,
) {
  await supabase.from('codex_bridge_events').insert({
    job_id: jobId,
    user_id: userId,
    agent_id: agentId,
    event_type: eventType,
    message,
    payload: sanitizeMetadata(payload),
  });
}

async function notifyRunner(jobId: string) {
  if (!runnerUrl) return;
  await fetch(`${runnerUrl.replace(/\/$/, '')}/jobs/${jobId}/wake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(runnerSecret ? { 'x-codex-bridge-secret': runnerSecret } : {}),
    },
    body: JSON.stringify({ job_id: jobId }),
  });
}

function stringParam(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeMetadata(value: JsonObject) {
  const blocked = ['auth', 'token', 'secret', 'password', 'auth_json', 'refresh'];
  return Object.fromEntries(
    Object.entries(value || {}).filter(([key]) => !blocked.some((word) => key.toLowerCase().includes(word))),
  );
}

async function safeJson(req: Request): Promise<JsonObject> {
  try {
    const parsed = await req.json();
    return asObject(parsed);
  } catch {
    return {};
  }
}

function requestParams(body: JsonObject): JsonObject {
  return asObject(body.params) || asObject(body.parameters) || body;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function json(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
