import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, sep } from 'node:path';

const HOST = process.env.CODEX_LOCAL_AUTH_HOST || '127.0.0.1';
const PORT = Number(process.env.CODEX_LOCAL_AUTH_PORT || 1456);
const CODEX_BIN = process.env.CODEX_LOCAL_AUTH_CODEX_BIN || 'codex';
const CODEX_HOME = resolve(process.env.CODEX_LOCAL_AUTH_HOME || `${homedir()}${sep}.agentopia${sep}codex-auth`);
const AUTH_PATH = `${CODEX_HOME}${sep}auth.json`;
const CONFIG_PATH = `${CODEX_HOME}${sep}config.toml`;
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CODEX_LOCAL_AUTH_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);

let loginProcess = null;
let lastLogin = null;

ensureCodexHome();

createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    send(res, 204, null, origin);
    return;
  }

  if (!isOriginAllowed(origin)) {
    send(res, 403, { success: false, error: 'Origin not allowed' }, origin);
    return;
  }

  try {
    if (req.method === 'GET' && req.url === '/health') {
      const codex = await inspectCodexCli();
      send(res, 200, {
        success: true,
        codex_cli_available: codex.available,
        codex_version: codex.version,
        codex_home: CODEX_HOME,
        auth_ready: inspectAuth().ready,
        login_running: Boolean(loginProcess),
        last_login: publicLoginState(),
      }, origin);
      return;
    }

    if (req.method === 'POST' && req.url === '/login') {
      const result = await startLogin();
      send(res, result.started ? 202 : 200, { success: true, ...result }, origin);
      return;
    }

    if (req.method === 'GET' && req.url === '/auth') {
      const auth = readAuth();
      send(res, 200, { success: true, auth }, origin);
      return;
    }

    send(res, 404, { success: false, error: 'Not found' }, origin);
  } catch (error) {
    send(res, 500, { success: false, error: errorMessage(error) }, origin);
  }
}).listen(PORT, HOST, () => {
  console.log(`[codex-local-auth-helper] Listening on http://${HOST}:${PORT}`);
  console.log(`[codex-local-auth-helper] CODEX_HOME=${CODEX_HOME}`);
});

function ensureCodexHome() {
  mkdirSync(CODEX_HOME, { recursive: true });
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, 'cli_auth_credentials_store = "file"\n', { mode: 0o600 });
  }
}

async function startLogin() {
  if (loginProcess) {
    return { started: false, login_running: true, codex_home: CODEX_HOME };
  }

  const codex = await inspectCodexCli();
  if (!codex.available) {
    throw new Error('Codex CLI is not available on PATH. Install it with: npm install -g @openai/codex');
  }

  lastLogin = { started_at: new Date().toISOString(), exit_code: null, error: null };
  loginProcess = spawn(CODEX_BIN, ['login'], {
    env: { ...process.env, CODEX_HOME },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  loginProcess.once('error', (error) => {
    lastLogin = { ...lastLogin, completed_at: new Date().toISOString(), error: error.message };
    loginProcess = null;
  });
  loginProcess.once('exit', (code) => {
    lastLogin = { ...lastLogin, completed_at: new Date().toISOString(), exit_code: code };
    loginProcess = null;
  });
  return { started: true, login_running: true, codex_home: CODEX_HOME };
}

function inspectCodexCli() {
  return new Promise((resolve) => {
    const child = spawn(CODEX_BIN, ['--version'], {
      env: { ...process.env, CODEX_HOME },
      shell: process.platform === 'win32',
    });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ available: false, version: null });
    }, 3000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.once('error', () => {
      clearTimeout(timeout);
      resolve({ available: false, version: null });
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolve({ available: code === 0, version: output.trim() || null });
    });
  });
}

function readAuth() {
  if (!existsSync(AUTH_PATH)) {
    throw new Error(`Codex auth cache not found at ${AUTH_PATH}. Complete codex login first.`);
  }
  const auth = JSON.parse(readFileSync(AUTH_PATH, 'utf8'));
  const normalized = normalizeAuth(auth);
  if (!normalized) throw new Error('Codex auth cache does not contain ChatGPT OAuth tokens.');
  return normalized;
}

function normalizeAuth(auth) {
  if (auth?.type === 'oauth' && auth?.access && auth?.refresh) {
    return {
      type: 'oauth',
      access: auth.access,
      refresh: auth.refresh,
      expires: auth.expires || null,
      accountId: auth.accountId || null,
      source: 'codex_cli_file',
    };
  }

  const tokens = auth?.tokens || {};
  if (auth?.auth_mode === 'chatgpt' && tokens.access_token && tokens.refresh_token) {
    return {
      auth_mode: 'chatgpt',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token || null,
        expires_at: tokens.expires_at || null,
        expiry_date: tokens.expiry_date || null,
      },
      accountId: auth.accountId || null,
      source: 'codex_cli_tokens',
    };
  }

  return null;
}

function inspectAuth() {
  try {
    return { ready: Boolean(normalizeAuth(JSON.parse(readFileSync(AUTH_PATH, 'utf8')))) };
  } catch {
    return { ready: false };
  }
}

function publicLoginState() {
  if (!lastLogin) return null;
  return {
    started_at: lastLogin.started_at,
    completed_at: lastLogin.completed_at,
    exit_code: lastLogin.exit_code,
    error: lastLogin.error,
  };
}

function isOriginAllowed(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function send(res, status, body, origin) {
  const headers = {
    'Access-Control-Allow-Origin': isOriginAllowed(origin) && origin ? origin : 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  res.writeHead(status, headers);
  res.end(body === null ? '' : JSON.stringify(body));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Unexpected local Codex auth helper error';
}
