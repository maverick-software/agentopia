export const PIPEDREAM_API_BASE_URL = 'https://api.pipedream.com';
export const PIPEDREAM_MCP_SERVER_URL = 'https://remote.mcp.pipedream.net/v3';

const accessTokenCache: {
  token: string | null;
  expiresAt: number;
  scope: string;
} = {
  token: null,
  expiresAt: 0,
  scope: '',
};

export interface PipedreamConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
  environment: 'development' | 'production';
}

export interface PipedreamMcpAuthConfig {
  provider?: string;
  external_user_id?: string;
  app_slug?: string;
  app_discovery?: boolean;
  account_id?: string;
}

export function getPipedreamConfig(): PipedreamConfig {
  const clientId = Deno.env.get('PIPEDREAM_CLIENT_ID');
  const clientSecret = Deno.env.get('PIPEDREAM_CLIENT_SECRET');
  const projectId = Deno.env.get('PIPEDREAM_PROJECT_ID');
  const environment = Deno.env.get('PIPEDREAM_ENVIRONMENT') || 'development';

  if (!clientId || !clientSecret || !projectId) {
    throw new Error('Pipedream is not configured. Missing PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, or PIPEDREAM_PROJECT_ID.');
  }

  if (environment !== 'development' && environment !== 'production') {
    throw new Error('PIPEDREAM_ENVIRONMENT must be development or production.');
  }

  return {
    clientId,
    clientSecret,
    projectId,
    environment,
  };
}

export function getPipedreamAllowedOrigins(): string[] {
  const configured = Deno.env.get('PIPEDREAM_ALLOWED_ORIGINS');
  if (!configured) return [];

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export async function getPipedreamAccessToken(scope = 'connect:*'): Promise<string> {
  const now = Date.now();
  if (
    accessTokenCache.token &&
    accessTokenCache.scope === scope &&
    accessTokenCache.expiresAt - 60_000 > now
  ) {
    return accessTokenCache.token;
  }

  const config = getPipedreamConfig();
  const response = await fetch(`${PIPEDREAM_API_BASE_URL}/v1/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Pipedream OAuth failed: ${data?.error || response.statusText}`);
  }

  const token = data.access_token || data.token;
  if (!token) {
    throw new Error('Pipedream OAuth response did not include an access token.');
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  accessTokenCache.token = token;
  accessTokenCache.expiresAt = now + expiresIn * 1000;
  accessTokenCache.scope = scope;

  return token;
}

export async function buildPipedreamMcpHeaders(authConfig: PipedreamMcpAuthConfig): Promise<Record<string, string>> {
  const config = getPipedreamConfig();
  const accessToken = await getPipedreamAccessToken('connect:*');
  const externalUserId = authConfig.external_user_id;

  if (!externalUserId) {
    throw new Error('Pipedream MCP auth requires external_user_id.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2024-11-05',
    'x-pd-project-id': config.projectId,
    'x-pd-environment': config.environment,
    'x-pd-external-user-id': externalUserId,
  };

  if (authConfig.account_id) {
    headers['x-pd-account-id'] = authConfig.account_id;
  }

  if (authConfig.app_discovery) {
    headers['x-pd-app-discovery'] = 'true';
  } else if (authConfig.app_slug) {
    headers['x-pd-app-slug'] = authConfig.app_slug;
  } else {
    throw new Error('Pipedream MCP auth requires app_slug or app_discovery.');
  }

  return headers;
}

export async function pipedreamApiRequest<T>(
  path: string,
  options: RequestInit = {},
  scope = 'connect:*',
): Promise<T> {
  const config = getPipedreamConfig();
  const accessToken = await getPipedreamAccessToken(scope);
  const url = path.startsWith('http') ? path : `${PIPEDREAM_API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-pd-environment': config.environment,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Pipedream API request failed: ${data?.error || data?.message || response.statusText}`);
  }

  return data as T;
}

export function namespacePipedreamToolName(appSlug: string, remoteToolName: string): string {
  const normalizedApp = appSlug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const normalizedTool = remoteToolName.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return `pipedream_${normalizedApp}_${normalizedTool}`;
}
