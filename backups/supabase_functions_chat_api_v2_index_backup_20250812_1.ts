// Backup of supabase/functions/chat/api/v2/index.ts on 2025-08-12
// Do not modify. Created to satisfy Rule #3 (backups before edits).
//
// Original contents:
export const APIConfig = {
  version: '2.0.0',
  basePath: '/v2',
  
  // Rate limiting defaults
  rateLimits: {
    default: {
      windowMs: 60 * 1000, // 1 minute
      max: 100,
    },
    streaming: {
      windowMs: 60 * 1000,
      max: 30,
    },
    batch: {
      windowMs: 60 * 1000,
      max: 10,
    },
  },
  
  // Response defaults
  defaults: {
    maxTokens: 4096,
    temperature: 0.7,
    model: 'gpt-4',
    memoryMaxResults: 10,
    contextWindowSize: 50,
  },
  
  // Limits
  limits: {
    maxMessageLength: 100000,
    maxBatchSize: 50,
    maxMemoryResults: 100,
    maxConversationMessages: 1000,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  
  // Timeouts
  timeouts: {
    default: 30000, // 30 seconds
    streaming: 300000, // 5 minutes
    toolExecution: 60000, // 1 minute
    migration: 600000, // 10 minutes
  },
};

export const ContentTypes = {
  JSON: 'application/json',
  JSON_V2: 'application/vnd.agentopia.v2+json',
  STREAM: 'text/event-stream',
  ERROR: 'application/problem+json',
} as const;

export const Headers = {
  API_VERSION: 'X-API-Version',
  REQUEST_ID: 'X-Request-ID',
  RATE_LIMIT: 'X-RateLimit-Limit',
  RATE_REMAINING: 'X-RateLimit-Remaining',
  RATE_RESET: 'X-RateLimit-Reset',
  RESPONSE_TIME: 'X-Response-Time',
  DEPRECATION: 'X-Deprecation',
} as const;

export function createResponseHeaders(options?: {
  requestId?: string;
  processingTime?: number;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  deprecations?: string[];
}): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': ContentTypes.JSON,
    [Headers.API_VERSION]: APIConfig.version,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    ...CORS_HEADERS,
  };
  if (options?.requestId) headers[Headers.REQUEST_ID] = options.requestId;
  if (options?.processingTime !== undefined) headers[Headers.RESPONSE_TIME] = `${options.processingTime}ms`;
  if (options?.rateLimit) {
    headers[Headers.RATE_LIMIT] = String(options.rateLimit.limit);
    headers[Headers.RATE_REMAINING] = String(options.rateLimit.remaining);
    headers[Headers.RATE_RESET] = String(options.rateLimit.reset);
  }
  if (options?.deprecations && options.deprecations.length > 0) {
    headers[Headers.DEPRECATION] = options.deprecations.join('; ');
  }
  return headers;
}

export function compose(...middlewares: Array<(req: Request) => Promise<Response | void>>) {
  return async (req: Request): Promise<Response> => {
    for (const middleware of middlewares) {
      const result = await middleware(req);
      if (result) return result;
    }
    throw new Error('No middleware returned a response');
  };
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Version, X-Request-ID',
  'Access-Control-Max-Age': '86400',
} as const;

export function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  return null;
}

