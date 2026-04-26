import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = requiredEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const RUNNER_SECRET = process.env.CODEX_BRIDGE_RUNNER_SECRET || '';
const RUNNER_ID = process.env.CODEX_BRIDGE_RUNNER_ID || `codex-bridge-${process.pid}`;
const PORT = Number(process.env.CODEX_BRIDGE_PORT || 8787);
const POLL_MS = Number(process.env.CODEX_BRIDGE_POLL_MS || 5000);
const JOB_TIMEOUT_MS = Number(process.env.CODEX_BRIDGE_JOB_TIMEOUT_MS || 30 * 60 * 1000);
const MAX_OUTPUT_CHARS = Number(process.env.CODEX_BRIDGE_MAX_OUTPUT_CHARS || 16000);
const CODEX_BIN = process.env.CODEX_BRIDGE_CODEX_BIN || 'codex';
const EXTRA_CODEX_ARGS = splitArgs(process.env.CODEX_BRIDGE_CODEX_ARGS || '');
const ALLOWED_WORKDIRS = (process.env.CODEX_BRIDGE_ALLOWED_WORKDIRS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => resolve(value));

const QUESTION_PATTERN = /\[\[CODEX_BRIDGE_QUESTION:\s*([\s\S]*?)\]\]/;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let activeJob = null;
let wakeRequested = false;

createServer(async (req, res) => {
  if (!isAuthorized(req)) {
    send(res, 401, { success: false, error: 'Unauthorized' });
    return;
  }

  if (req.url === '/health') {
    send(res, 200, {
      success: true,
      runner_id: RUNNER_ID,
      active_job: activeJob,
      codex_auth: { mode: 'per-user-vault', ready: true },
      allowed_workdirs: ALLOWED_WORKDIRS,
    });
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/jobs/') && req.url.endsWith('/wake')) {
    wakeRequested = true;
    setTimeout(processQueue, 0);
    send(res, 202, { success: true });
    return;
  }

  send(res, 404, { success: false, error: 'Not found' });
}).listen(PORT, () => {
  console.log(`[codex-bridge-worker] ${RUNNER_ID} listening on ${PORT}`);
  console.log(`[codex-bridge-worker] Poll interval: ${POLL_MS}ms`);
});

setInterval(processQueue, POLL_MS);
setTimeout(processQueue, 0);

async function processQueue() {
  if (activeJob) return;
  wakeRequested = false;

  const job = await claimNextJob();
  if (!job) return;

  activeJob = job.id;
  try {
    await runJob(job);
  } catch (error) {
    await failJob(job, error);
  } finally {
    activeJob = null;
    if (wakeRequested) setTimeout(processQueue, 0);
  }
}

async function claimNextJob() {
  const { data: jobs, error } = await supabase
    .from('codex_bridge_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  const job = jobs?.[0];
  if (!job) return null;

  const workdirValidation = validateWorkdir(job.workdir);
  if (!workdirValidation.valid) {
    await failJob(job, new Error(workdirValidation.reason));
    return null;
  }

  const { data: claimed, error: claimError } = await supabase
    .from('codex_bridge_jobs')
    .update({
      status: 'running',
      runner_id: RUNNER_ID,
      started_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle();

  if (claimError) throw claimError;
  return claimed;
}

async function runJob(job) {
  await recordEvent(job, 'running', 'Codex bridge worker started job', {});
  const credential = await loadCodexCredential(job);
  const authContext = await materializeCodexHome(credential);

  const prompt = job.answer
    ? buildAnswerPrompt(job)
    : buildInitialPrompt(job);

  const args = job.answer && job.codex_session_id
    ? ['exec', 'resume', '--json', job.codex_session_id, prompt, ...EXTRA_CODEX_ARGS]
    : ['exec', '--json', prompt, ...EXTRA_CODEX_ARGS];

  try {
    const result = await runCodex(args, job.workdir, authContext.codexHome);
    await persistAuthJsonIfChanged(job, credential, authContext.authPath);
    const output = truncate(scrub(result.stdout || result.stderr || ''), MAX_OUTPUT_CHARS);
    const question = extractQuestion(output);
    const sessionId = extractSessionId(result.stdout) || job.codex_session_id || null;

    if (question) {
      await supabase
        .from('codex_bridge_jobs')
        .update({
          status: 'waiting_for_answer',
          question,
          answer: null,
          last_output: output,
          codex_session_id: sessionId,
        })
        .eq('id', job.id);
      await recordEvent(job, 'waiting_for_answer', 'Codex requested clarification', { question });
      return;
    }

    if (result.code !== 0) {
      throw new Error(`codex exited with ${result.code}: ${output || 'no output'}`);
    }

    await supabase
      .from('codex_bridge_jobs')
      .update({
        status: 'complete',
        result: output,
        last_output: output,
        codex_session_id: sessionId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    await recordEvent(job, 'complete', 'Codex bridge job completed', {
      output_chars: output.length,
      codex_session_id: sessionId,
    });
  } finally {
    cleanupCodexHome(authContext.codexHome);
  }
}

async function loadCodexCredential(job) {
  if (!job.credential_id) throw new Error('Codex OAuth connection required');
  const { data: credential, error } = await supabase
    .from('user_integration_credentials')
    .select('*')
    .eq('id', job.credential_id)
    .eq('user_id', job.user_id)
    .eq('connection_status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!credential) throw new Error('Codex OAuth connection required');

  const [accessToken, refreshToken, idToken] = await Promise.all([
    readVaultSecret(credential.vault_access_token_id),
    readVaultSecret(credential.vault_refresh_token_id),
    readVaultSecret(credential.vault_id_token_id),
  ]);
  if (!accessToken || !refreshToken) throw new Error('Codex OAuth token payload is incomplete');
  return { ...credential, accessToken, refreshToken, idToken };
}

async function readVaultSecret(secretId) {
  if (!secretId) return '';
  const { data, error } = await supabase.rpc('get_secret', { secret_id: secretId });
  if (error) throw error;
  return typeof data === 'string' ? data : '';
}

function materializeCodexHome(credential) {
  const codexHome = mkdtempSync(`${tmpdir()}${sep}agentopia-codex-`);
  mkdirSync(codexHome, { recursive: true });
  const authPath = `${codexHome}${sep}auth.json`;
  writeFileSync(authPath, JSON.stringify(buildAuthJson(credential), null, 2), { mode: 0o600 });
  return { codexHome, authPath };
}

function buildAuthJson(credential) {
  const metadata = credential.connection_metadata || {};
  const expiresAt = credential.token_expires_at || metadata.expires_at || null;
  return {
    type: 'oauth',
    access: credential.accessToken,
    refresh: credential.refreshToken,
    expires: expiresAt ? new Date(expiresAt).getTime() : undefined,
    accountId: metadata.account_id || undefined,
  };
}

async function persistAuthJsonIfChanged(job, credential, authPath) {
  if (!existsSync(authPath)) return;
  const auth = JSON.parse(readFileSync(authPath, 'utf8'));
  const tokens = normalizeCodexAuthFile(auth);
  if (!tokens?.access_token || !tokens?.refresh_token) return;
  if (
    tokens.access_token === credential.accessToken &&
    tokens.refresh_token === credential.refreshToken &&
    (tokens.id_token || '') === (credential.idToken || '')
  ) return;

  const metadata = credential.connection_metadata || {};
  const accessVaultId = await createVaultSecret(tokens.access_token, `openai_codex_access_${job.user_id}`);
  const refreshVaultId = await createVaultSecret(tokens.refresh_token, `openai_codex_refresh_${job.user_id}`);
  const idVaultId = tokens.id_token
    ? await createVaultSecret(tokens.id_token, `openai_codex_id_${job.user_id}`)
    : credential.vault_id_token_id;
  const expiresAt = tokens.expires_at || (tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : credential.token_expires_at);

  const { error } = await supabase
    .from('user_integration_credentials')
    .update({
      vault_access_token_id: accessVaultId,
      vault_refresh_token_id: refreshVaultId,
      vault_id_token_id: idVaultId,
      token_expires_at: expiresAt,
      connection_status: 'active',
      connection_metadata: {
        ...metadata,
        account_id: tokens.account_id || metadata.account_id,
        expires_at: expiresAt,
        last_refresh: new Date().toISOString(),
        token_source: 'runner',
      },
    })
    .eq('id', credential.id)
    .eq('user_id', job.user_id);
  if (error) throw error;
  await recordEvent(job, 'auth_refreshed', 'Codex OAuth tokens refreshed by CLI and persisted', {});
}

function normalizeCodexAuthFile(auth) {
  if (auth?.type === 'oauth' && auth.access && auth.refresh) {
    return {
      access_token: auth.access,
      refresh_token: auth.refresh,
      id_token: auth.id_token || null,
      expires_at: auth.expires ? new Date(auth.expires).toISOString() : null,
      expiry_date: auth.expires || null,
      account_id: auth.accountId || null,
    };
  }

  const tokens = auth?.tokens || {};
  if (auth?.auth_mode === 'chatgpt' && tokens.access_token && tokens.refresh_token) {
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token || null,
      expires_at: tokens.expires_at || null,
      expiry_date: tokens.expiry_date || null,
      account_id: auth.accountId || null,
    };
  }

  return null;
}

async function createVaultSecret(secret, name) {
  const { data, error } = await supabase.rpc('create_vault_secret', {
    p_secret: secret,
    p_name: `${name}_${Date.now()}`,
    p_description: 'OpenAI Codex OAuth token refreshed by bridge worker',
  });
  if (error || !data) throw new Error(`Failed to store Codex token in Vault: ${error?.message || 'missing id'}`);
  return data;
}

function cleanupCodexHome(codexHome) {
  if (process.env.CODEX_BRIDGE_KEEP_TEMP_AUTH === 'true') return;
  rmSync(codexHome, { recursive: true, force: true });
}

function runCodex(args, cwd, codexHome) {
  return new Promise((resolvePromise) => {
    const child = spawn(CODEX_BIN, args, {
      cwd,
      env: { ...process.env, CODEX_HOME: codexHome },
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      stderr += `\nCodex bridge timeout after ${JOB_TIMEOUT_MS}ms`;
    }, JOB_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      stdout = truncate(stdout, MAX_OUTPUT_CHARS * 2);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      stderr = truncate(stderr, MAX_OUTPUT_CHARS * 2);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolvePromise({ code, stdout, stderr });
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolvePromise({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });
  });
}

async function failJob(job, error) {
  const message = scrub(error?.message || String(error));
  console.error(`[codex-bridge-worker] Job ${job.id} failed:`, message);
  await supabase
    .from('codex_bridge_jobs')
    .update({
      status: 'error',
      error: message,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  await recordEvent(job, 'error', message, {});
}

async function recordEvent(job, eventType, message, payload) {
  await supabase.from('codex_bridge_events').insert({
    job_id: job.id,
    user_id: job.user_id,
    agent_id: job.agent_id,
    event_type: eventType,
    message: scrub(message),
    payload,
  });
}

function buildInitialPrompt(job) {
  return [
    'You are running through the Agentopia Codex CLI bridge.',
    'Complete the requested coding task in the provided working directory.',
    'If you need clarification, output exactly [[CODEX_BRIDGE_QUESTION: your question]] and stop.',
    '',
    job.prompt,
  ].join('\n');
}

function buildAnswerPrompt(job) {
  return [
    'The user answered your previous clarification question.',
    `Answer: ${job.answer}`,
    '',
    'Continue the original task and produce the final result.',
  ].join('\n');
}

function validateWorkdir(workdir) {
  const resolved = resolve(workdir);
  if (!existsSync(resolved)) return { valid: false, reason: `Workdir does not exist: ${resolved}` };
  if (ALLOWED_WORKDIRS.length === 0) return { valid: true };

  const allowed = ALLOWED_WORKDIRS.some((root) => resolved === root || resolved.startsWith(`${root}${sep}`));
  return allowed
    ? { valid: true }
    : { valid: false, reason: `Workdir is outside CODEX_BRIDGE_ALLOWED_WORKDIRS: ${resolved}` };
}

function extractQuestion(output) {
  const match = output.match(QUESTION_PATTERN);
  return match?.[1]?.trim() || null;
}

function extractSessionId(output) {
  for (const line of output.split(/\r?\n/)) {
    try {
      const parsed = JSON.parse(line);
      const value = parsed.session_id || parsed.sessionId || parsed.conversation_id || parsed.id;
      if (typeof value === 'string' && value.length > 8) return value;
    } catch {
      // Ignore non-JSON output.
    }
  }
  return null;
}

function isAuthorized(req) {
  if (!RUNNER_SECRET) return true;
  return req.headers['x-codex-bridge-secret'] === RUNNER_SECRET;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function splitArgs(value) {
  return value.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, '')) || [];
}

function truncate(value, max) {
  if (!value || value.length <= max) return value || '';
  return `${value.slice(0, max)}\n...[truncated]`;
}

function scrub(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, '[redacted-openai-key]')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/g, '"refresh_token":"[redacted]"')
    .replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token":"[redacted]"')
    .replace(/"id_token"\s*:\s*"[^"]+"/g, '"id_token":"[redacted]"');
}
