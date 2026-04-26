import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

type Action = 'start' | 'callback' | 'status' | 'refresh' | 'disconnect' | 'persist' | 'local_import';
type JsonObject = Record<string, unknown>;

interface AuthContext {
  userId: string | null;
  isService: boolean;
}

interface CredentialRow {
  id: string;
  user_id: string;
  oauth_provider_id: string;
  vault_access_token_id: string | null;
  vault_refresh_token_id: string | null;
  vault_id_token_id?: string | null;
  token_expires_at: string | null;
  connection_status: string;
  connection_metadata: JsonObject | null;
  external_username: string | null;
  connection_name: string | null;
  scopes_granted: string[] | null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const codexClientId = Deno.env.get('CODEX_OAUTH_CLIENT_ID') || 'app_EMoamEEZ73f0CkXaXp7hrann';
const defaultRedirectUri = Deno.env.get('CODEX_OAUTH_REDIRECT_URI') || 'http://localhost:1455/auth/callback';
const defaultOriginator = Deno.env.get('CODEX_OAUTH_ORIGINATOR') || 'opencode';
const stateTtlMs = Number(Deno.env.get('CODEX_OAUTH_STATE_TTL_MS') || 30 * 60_000);
const lockTtlMs = Number(Deno.env.get('CODEX_OAUTH_LOCK_TTL_MS') || 60_000);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await safeJson(req);
    const action = (stringParam(body.action) || 'status') as Action;
    const auth = await resolveAuth(req, stringParam(body.user_id));

    if (!auth.userId) return json({ success: false, error: 'Unauthorized' }, 401);
    switch (action) {
      case 'start':
        return await startOAuth(body, auth.userId);
      case 'callback':
        return await completeCallback(body, auth.userId);
      case 'status':
        return await getStatus(auth.userId);
      case 'refresh':
        return await refreshCredential(body, auth.userId);
      case 'disconnect':
        return await disconnectCredential(body, auth.userId);
      case 'persist':
        if (!auth.isService) return json({ success: false, error: 'Service role required' }, 403);
        return await persistRotatedTokens(body, auth.userId);
      case 'local_import':
        return await importLocalCodexAuth(body, auth.userId);
      default: return json({ success: false, error: `Unsupported action: ${action}` }, 400);
    }
  } catch (error: unknown) {
    console.error('[codex-oauth] Unhandled error:', errorMessage(error, 'Unknown error'));
    return json({ success: false, error: errorMessage(error, 'Internal server error') }, 500);
  }
});

async function startOAuth(body: JsonObject, userId: string): Promise<Response> {
  const verifier = randomBase64Url(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomBase64Url(32);
  const origin = stringParam(body.redirect_origin);
  const redirectUri = stringParam(body.redirect_uri)
    || (origin && Deno.env.get('CODEX_OAUTH_ALLOW_APP_REDIRECT') === 'true'
      ? `${origin.replace(/\/$/, '')}/integrations/openai-codex/callback`
      : defaultRedirectUri);
  const scopes = stringArray(body.scopes, ['openid', 'profile', 'email', 'offline_access']);
  const expiresAt = new Date(Date.now() + stateTtlMs).toISOString();

  const { error } = await supabase.from('codex_oauth_states').insert({
    state,
    user_id: userId,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    expires_at: expiresAt,
  });
  if (error) return json({ success: false, error: error.message }, 400);

  const authUrl = new URL('https://auth.openai.com/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', codexClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('id_token_add_organizations', 'true');
  authUrl.searchParams.set('codex_cli_simplified_flow', 'true');
  authUrl.searchParams.set('originator', stringParam(body.originator) || defaultOriginator);

  return json({
    success: true,
    data: {
      auth_url: authUrl.toString(),
      state,
      redirect_uri: redirectUri,
      fallback_redirect_uri: defaultRedirectUri,
      expires_at: expiresAt,
    },
  });
}

async function completeCallback(body: JsonObject, userId: string): Promise<Response> {
  const parsedRedirect = parseRedirectPayload(body);
  const code = stringParam(body.code) || parsedRedirect.code;
  const state = stringParam(body.state) || parsedRedirect.state;
  const oauthError = stringParam(body.error) || parsedRedirect.error;

  if (oauthError) {
    return json({ success: false, error: stringParam(body.error_description) || oauthError }, 400);
  }
  if (!code || !state) return json({ success: false, error: 'code and state are required' }, 400);

  const { data: stateRow, error: stateError } = await supabase
    .from('codex_oauth_states')
    .select('*')
    .eq('state', state)
    .eq('user_id', userId)
    .maybeSingle();
  if (stateError) return json({ success: false, error: stateError.message }, 400);
  if (!stateRow || stateRow.consumed_at) return json({ success: false, error: 'Invalid OAuth state' }, 400);
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return json({ success: false, error: 'OAuth state expired' }, 400);
  }

  let tokens: JsonObject;
  try {
    tokens = await exchangeTokens({
      grant_type: 'authorization_code',
      code,
      client_id: codexClientId,
      redirect_uri: stateRow.redirect_uri,
      code_verifier: stateRow.code_verifier,
    });
  } catch (error: unknown) {
    return json({ success: false, error: errorMessage(error, 'Codex token exchange failed'), stage: 'token_exchange' }, 400);
  }

  const providerId = await getProviderId();
  let credential: CredentialRow;
  try {
    credential = await storeTokens({ userId, providerId, existingCredential: null, tokens, source: 'callback' });
  } catch (error: unknown) {
    console.error('[codex-oauth] Credential storage failed:', errorMessage(error, 'Credential storage failed'));
    return json({ success: false, error: errorMessage(error, 'Credential storage failed'), stage: 'credential_storage' }, 400);
  }

  await supabase.from('codex_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('state', state);

  return json({ success: true, data: { credential: publicCredential(credential) } });
}

async function getStatus(userId: string): Promise<Response> {
  const credential = await getActiveCredential(userId);
  return json({
    success: true,
    data: {
      connected: Boolean(credential),
      credential: credential ? publicCredential(credential) : null,
    },
  });
}

async function refreshCredential(body: JsonObject, userId: string): Promise<Response> {
  const credential = await getCredentialForUser(userId, stringParam(body.credential_id));
  if (!credential) return json({ success: false, error: 'Codex OAuth connection not found' }, 404);

  const lock = await acquireRefreshLock(credential);
  if (!lock.ok) return json({ success: false, error: 'Codex OAuth refresh already in progress' }, 409);

  try {
    const latest = await getCredentialForUser(userId, credential.id);
    if (!latest) return json({ success: false, error: 'Codex OAuth connection not found' }, 404);
    if (isFresh(latest.token_expires_at, 5 * 60_000)) {
      return json({ success: true, data: { credential: publicCredential(latest), refreshed: false } });
    }

    const refreshToken = await readSecret(latest.vault_refresh_token_id);
    if (!refreshToken) {
      await markExpired(latest.id, 'Missing refresh token');
      return json({ success: false, error: 'Missing Codex refresh token' }, 409);
    }

    const tokens = await exchangeTokens({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: codexClientId,
    });

    const stored = await storeTokens({ userId, providerId: latest.oauth_provider_id, existingCredential: latest, tokens, source: 'refresh' });
    return json({ success: true, data: { credential: publicCredential(stored), refreshed: true } });
  } catch (error: unknown) {
    await markExpired(credential.id, errorMessage(error, 'Refresh failed'));
    return json({ success: false, error: errorMessage(error, 'Refresh failed') }, 400);
  } finally {
    await releaseRefreshLock(credential.id);
  }
}

async function persistRotatedTokens(body: JsonObject, userId: string): Promise<Response> {
  const credential = await getCredentialForUser(userId, stringParam(body.credential_id));
  if (!credential) return json({ success: false, error: 'Codex OAuth connection not found' }, 404);
  const tokens = asObject(body.tokens);
  const stored = await storeTokens({ userId, providerId: credential.oauth_provider_id, existingCredential: credential, tokens, source: 'runner' });
  return json({ success: true, data: { credential: publicCredential(stored) } });
}

async function importLocalCodexAuth(body: JsonObject, userId: string): Promise<Response> {
  const authPayload = asObject(body.auth || body.auth_json || body.payload);
  const tokens = normalizeLocalAuthPayload(authPayload);
  if (!tokens) {
    return json({ success: false, error: 'Local Codex auth payload does not contain OAuth tokens' }, 400);
  }

  const providerId = await getProviderId();
  try {
    const credential = await storeTokens({
      userId,
      providerId,
      existingCredential: await getCredentialForUser(userId, ''),
      tokens,
      source: 'local_codex_cli',
    });
    return json({ success: true, data: { credential: publicCredential(credential) } });
  } catch (error: unknown) {
    console.error('[codex-oauth] Local auth import failed:', errorMessage(error, 'Local auth import failed'));
    return json({ success: false, error: errorMessage(error, 'Local auth import failed'), stage: 'local_import' }, 400);
  }
}

async function disconnectCredential(body: JsonObject, userId: string): Promise<Response> {
  const credential = await getCredentialForUser(userId, stringParam(body.credential_id));
  if (!credential) return json({ success: true, data: { disconnected: true } });

  const { error } = await supabase
    .from('user_integration_credentials')
    .update({
      connection_status: 'disconnected',
      connection_metadata: {
        ...(credential.connection_metadata || {}),
        disconnected_at: new Date().toISOString(),
      },
    })
    .eq('id', credential.id)
    .eq('user_id', userId);
  if (error) return json({ success: false, error: error.message }, 400);
  return json({ success: true, data: { disconnected: true } });
}

async function storeTokens(input: {
  userId: string;
  providerId: string;
  existingCredential: CredentialRow | null;
  tokens: JsonObject;
  source: string;
}): Promise<CredentialRow> {
  const accessToken = stringParam(input.tokens.access_token);
  const refreshToken = stringParam(input.tokens.refresh_token);
  const idToken = stringParam(input.tokens.id_token);
  if (!accessToken) throw new Error('Token response did not include access_token');

  const metadata = tokenMetadata(input.tokens);
  const expiresAt = metadata.expires_at;
  const accessVaultId = await createSecret(accessToken, `openai_codex_access_${input.userId}`);
  const refreshVaultId = refreshToken
    ? await createSecret(refreshToken, `openai_codex_refresh_${input.userId}`)
    : input.existingCredential?.vault_refresh_token_id || null;
  const idVaultId = idToken
    ? await createSecret(idToken, `openai_codex_id_${input.userId}`)
    : input.existingCredential?.vault_id_token_id || null;

  const payload = {
    user_id: input.userId,
    oauth_provider_id: input.providerId,
    external_user_id: metadata.account_id || input.userId,
    external_username: metadata.email || metadata.account_id || 'ChatGPT Codex',
    connection_name: metadata.email ? `OpenAI Codex (${metadata.email})` : 'OpenAI Codex',
    scopes_granted: metadata.scope,
    vault_access_token_id: accessVaultId,
    vault_refresh_token_id: refreshVaultId,
    vault_id_token_id: idVaultId,
    token_expires_at: expiresAt,
    connection_status: 'active',
    credential_type: 'oauth',
    connection_metadata: {
      ...(input.existingCredential?.connection_metadata || {}),
      account_id: metadata.account_id,
      email: metadata.email,
      expires_at: expiresAt,
      auth_mode: 'chatgpt',
      provider: 'openai-codex',
      scope: metadata.scope,
      last_refresh: new Date().toISOString(),
      token_source: input.source,
    },
  };

  const query = input.existingCredential
    ? supabase.from('user_integration_credentials').update(payload).eq('id', input.existingCredential.id).select('*')
    : supabase.from('user_integration_credentials').upsert(payload, { onConflict: 'user_id,oauth_provider_id' }).select('*');
  const { data, error } = await query.single();
  if (error) throw error;
  return data as CredentialRow;
}

async function exchangeTokens(params: Record<string, string>): Promise<JsonObject> {
  const response = await fetch('https://auth.openai.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const responseText = await response.text();
  const data = parseJsonObject(responseText);
  if (!response.ok) {
    const detail = stringParam(data.error_description) || stringParam(data.error) || truncate(responseText, 240);
    throw new Error(`Codex token exchange failed (${response.status}): ${detail || response.statusText}`);
  }
  return data;
}

async function createSecret(secret: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_vault_secret', {
    p_secret: secret,
    p_name: `${name}_${Date.now()}`,
    p_description: 'OpenAI Codex OAuth token',
  });
  if (error || !data) throw new Error(`Failed to store Codex token in Vault: ${error?.message || 'missing id'}`);
  return String(data);
}

async function readSecret(secretId: string | null): Promise<string> {
  if (!secretId) return '';
  const { data, error } = await supabase.rpc('get_secret', { secret_id: secretId });
  if (error) throw error;
  return typeof data === 'string' ? data : '';
}

async function getProviderId(): Promise<string> {
  const { data, error } = await supabase.from('service_providers').select('id').eq('name', 'openai-codex').single();
  if (error || !data?.id) throw new Error('OpenAI Codex service provider is not installed');
  return data.id;
}

async function getActiveCredential(userId: string): Promise<CredentialRow | null> {
  return await getCredentialForUser(userId, '');
}

async function getCredentialForUser(userId: string, credentialId: string): Promise<CredentialRow | null> {
  const providerId = await getProviderId();
  let query = supabase
    .from('user_integration_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('oauth_provider_id', providerId)
    .neq('connection_status', 'disconnected')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (credentialId) query = query.eq('id', credentialId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as CredentialRow | null;
}

async function acquireRefreshLock(credential: CredentialRow): Promise<{ ok: boolean }> {
  const now = new Date();
  const lockUntil = new Date(Date.now() + lockTtlMs).toISOString();
  await supabase.from('codex_oauth_refresh_locks').delete().eq('credential_id', credential.id).lt('locked_until', now.toISOString());
  const { error } = await supabase.from('codex_oauth_refresh_locks').insert({
    credential_id: credential.id,
    user_id: credential.user_id,
    locked_until: lockUntil,
    locked_by: crypto.randomUUID(),
  });
  return { ok: !error };
}

async function releaseRefreshLock(credentialId: string) {
  await supabase.from('codex_oauth_refresh_locks').delete().eq('credential_id', credentialId);
}

async function markExpired(credentialId: string, reason: string) {
  await supabase.from('user_integration_credentials').update({
    connection_status: 'expired',
    connection_metadata: { expired_at: new Date().toISOString(), expired_reason: scrub(reason) },
  }).eq('id', credentialId);
}

function tokenMetadata(tokens: JsonObject) {
  const idClaims = decodeJwt(stringParam(tokens.id_token));
  const accessClaims = decodeJwt(stringParam(tokens.access_token));
  const expiresIn = numberParam(tokens.expires_in);
  const explicitExpiresAt = stringParam(tokens.expires_at) || dateFromMs(numberParam(tokens.expires));
  const expSeconds = numberParam(idClaims.exp) || numberParam(accessClaims.exp);
  const expiresAt = explicitExpiresAt || (expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : expSeconds
      ? new Date(expSeconds * 1000).toISOString()
      : null);
  return {
    account_id: stringParam(tokens.account_id)
      || stringParam(accessClaims.chatgpt_account_id)
      || stringParam(asObject(accessClaims['https://api.openai.com/auth']).chatgpt_account_id)
      || stringParam(idClaims.sub)
      || stringParam(accessClaims.sub),
    email: stringParam(idClaims.email) || stringParam(accessClaims.email),
    expires_at: expiresAt,
    scope: stringArray(tokens.scope, ['openid', 'profile', 'email', 'offline_access']),
  };
}

function normalizeLocalAuthPayload(auth: JsonObject): JsonObject | null {
  if (stringParam(auth.type) === 'oauth' && stringParam(auth.access) && stringParam(auth.refresh)) {
    return {
      access_token: stringParam(auth.access),
      refresh_token: stringParam(auth.refresh),
      expires: numberParam(auth.expires),
      account_id: stringParam(auth.accountId),
      scope: ['openid', 'profile', 'email', 'offline_access'],
    };
  }

  const tokens = asObject(auth.tokens);
  if (stringParam(auth.auth_mode) === 'chatgpt' && stringParam(tokens.access_token) && stringParam(tokens.refresh_token)) {
    return {
      access_token: stringParam(tokens.access_token),
      refresh_token: stringParam(tokens.refresh_token),
      id_token: stringParam(tokens.id_token),
      expires_at: stringParam(tokens.expires_at) || dateFromMs(numberParam(tokens.expiry_date)),
      account_id: stringParam(auth.accountId),
      scope: ['openid', 'profile', 'email', 'offline_access'],
    };
  }

  return null;
}

function publicCredential(credential: CredentialRow): JsonObject {
  return {
    id: credential.id,
    external_username: credential.external_username,
    connection_name: credential.connection_name,
    connection_status: credential.connection_status,
    token_expires_at: credential.token_expires_at,
    scopes_granted: credential.scopes_granted || [],
    connection_metadata: sanitizeMetadata(credential.connection_metadata || {}),
  };
}

async function resolveAuth(req: Request, bodyUserId?: string): Promise<AuthContext> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (token && token === serviceKey && bodyUserId) return { userId: bodyUserId, isService: true };
  if (!token) return { userId: null, isService: false };
  const { data } = await supabase.auth.getUser(token);
  return { userId: data?.user?.id || null, isService: false };
}

async function safeJson(req: Request): Promise<JsonObject> {
  try {
    return asObject(await req.json());
  } catch {
    return {};
  }
}

function parseRedirectPayload(body: JsonObject): JsonObject {
  const redirectUrl = stringParam(body.redirect_url);
  if (!redirectUrl) return {};
  try {
    const url = new URL(redirectUrl);
    return {
      code: url.searchParams.get('code') || '',
      state: url.searchParams.get('state') || '',
      error: url.searchParams.get('error') || '',
    };
  } catch {
    return {};
  }
}

function decodeJwt(jwt: string): JsonObject {
  const [, payload] = jwt.split('.');
  if (!payload) return {};
  try {
    const padded = payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '=');
    return asObject(JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch {
    return {};
  }
}

async function pkceChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(hash));
}

function randomBase64Url(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringParam(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberParam(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dateFromMs(value: number): string {
  return value > 0 ? new Date(value).toISOString() : '';
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function parseJsonObject(value: string): JsonObject {
  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function isFresh(expiresAt: string | null, skewMs: number): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() - Date.now() > skewMs);
}

function sanitizeMetadata(value: JsonObject): JsonObject {
  const blocked = ['token', 'secret', 'password', 'auth_json'];
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.some((word) => key.toLowerCase().includes(word))));
}

function scrub(value: string): string {
  return value.replace(/([A-Za-z0-9_-]{20,})/g, '[redacted]');
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
