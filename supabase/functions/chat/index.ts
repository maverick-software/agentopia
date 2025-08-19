// Chat Function Entry Point (Advanced JSON System)
// Main handler for the advanced JSON-based chat system

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';

// Import components
import { MessageProcessor } from './processor/index.ts';
import { MemoryManager } from './core/memory/memory_manager.ts';
import { ContextEngine } from './core/context/context_engine.ts';
import { StateManager } from './core/state/state_manager.ts';
import { MonitoringSystem } from './core/monitoring/monitoring_system.ts';
import { APIVersionRouter, MessageAdapter, getFeatureFlags, isFeatureEnabled, DualWriteService } from './adapters/index.ts';
import { FunctionCallingManager } from './function_calling.ts';
import { SchemaValidator } from './validation/index.ts';

// Import API handlers
import { 
  handleError,
  withErrorHandling,
  CORS_HEADERS,
  handleCORS,
  getAPIVersion,
  createResponseHeaders,
  StreamResponse,
} from './api/v2/index.ts';
import { logger, createLogger, metrics } from './utils/index.ts';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
// Pinecone keys are NEVER read from env. They are stored per-user in Vault via integrations

// Initialize services
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = null; // Do not initialize a global Pinecone client

// Initialize core components
const memoryManager = new MemoryManager(supabase, pinecone, openai, {
  index_name: 'agentopia',
  namespace: 'memories',
  embedding_model: 'text-embedding-3-small',
  max_memories_per_agent: 1000,
});

const stateManager = new StateManager(supabase, {
  auto_checkpoint: true,
  checkpoint_interval: 3600000, // 1 hour
  max_checkpoints: 10,
  validation_enabled: true,
});

const contextEngine = new ContextEngine(supabase, {
  default_token_budget: 4096,
  max_candidates: 100,
  relevance_threshold: 0.3,
  compression_enabled: true,
  caching_enabled: true,
  monitoring_enabled: true,
});

const monitoringSystem = new MonitoringSystem(supabase, {
  metrics_buffer_size: 1000,
  export_interval: 60000, // 1 minute
  error_sample_rate: 1.0,
  health_check_interval: 300000, // 5 minutes
});

const messageProcessor = new MessageProcessor(
  memoryManager,
  contextEngine,
  stateManager,
  monitoringSystem,
  openai,
  supabase,
  {
    max_tokens: 8192,
    timeout: 30000,
    enable_streaming: true,
  }
);

// Initialize API components
const validator = new SchemaValidator();

// Utility: Generate a short conversation title from initial user text
async function generateConversationTitleFromText(text: string): Promise<string> {
  try {
    const prompt = `Create a concise 3-6 word title for a chat based on the user's first message. 
Rules: Title Case, no quotes, no trailing punctuation.
User message: "${text.slice(0, 500)}"`;
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You generate short, informative chat titles.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 24,
    });
    const out = (resp.choices?.[0]?.message?.content || '').trim();
    // Basic sanitation fallback
    return out.replace(/^"|"$/g, '').replace(/[.!?\s]+$/g, '').slice(0, 80) ||
      text.trim().split(/\s+/).slice(0, 6).join(' ').replace(/(^.|\s+.)/g, s => s.toUpperCase());
  } catch (_e) {
    // Fallback to truncated text if OpenAI fails
    const base = text.trim().split(/\s+/).slice(0, 6).join(' ');
    // Title Case simple fallback
    const titled = base.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return titled || 'New Conversation';
  }
}

// Ensure a conversation_sessions row exists and has a title
async function ensureConversationSession(convId: string, agentId: string, userId: string, firstUserText?: string) {
  try {
    const { data: existing } = await supabase
      .from('conversation_sessions')
      .select('conversation_id, title')
      .eq('conversation_id', convId)
      .maybeSingle();
    // Update rules:
    // - If no row: insert with AI title
    // - If title is empty or a generic placeholder ('New Conversation', 'Conversation', 'Untitled'): replace with AI title
    const isGeneric = (t?: string | null) => {
      if (!t) return true;
      const s = t.trim().toLowerCase();
      return s === 'new conversation' || s === 'conversation' || s === 'untitled' || s.length < 3;
    };

    if (!existing || isGeneric(existing.title)) {
      const title = firstUserText ? await generateConversationTitleFromText(firstUserText) : 'New Conversation';
      await supabase
        .from('conversation_sessions')
        .upsert({
          conversation_id: convId,
          agent_id: agentId,
          user_id: userId,
          title,
          status: 'active',
          last_active: new Date().toISOString(),
        }, { onConflict: 'conversation_id' });
    }
  } catch (err) {
    // Non-fatal; proceed without title
    logger.warn('ensureConversationSession failed', err as any);
  }
}

// Feature flags are configured via environment variables
// Advanced JSON chat system is controlled by getFeatureFlags()

// Main handler
async function handler(req: Request): Promise<Response> {
  const timer = metrics.startTimer('request_handling');
  const requestId = crypto.randomUUID();
  
  // Set up logging context
      const log = createLogger({ request_id: requestId });
  
  try {
    // Handle CORS
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;
    
    // Validate Authorization for non-preflight requests
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const serviceHeader = req.headers.get('X-Agentopia-Service') || req.headers.get('x-agentopia-service');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }
    
    // Verify the JWT token unless invoked by approved service
    let token: string | undefined;
    const isServiceCall = !!serviceHeader && serviceHeader === 'task-executor';
    if (!isServiceCall) {
      try {
        token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await (supabase as any).auth.getUser(token);
        if (userError || !user) {
          return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...CORS_HEADERS,
            },
          });
        }
      } catch (_authErr) {
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        });
      }
    }
    
    // Parse request body
    const body = await req.json();
    // Inject auth token for downstream tool execution (FunctionCallingManager)
    try {
      const opts = (body.options ||= {});
      const auth = (opts.auth ||= {});
      if (token) auth.token = token;
    } catch (_) { /* non-fatal */ }
    // Sanitize optional string fields that may arrive as null from legacy clients
    if (body?.context) {
      for (const key of ['channel_id','workspace_id','agent_id','user_id','conversation_id','session_id']) {
        if (body.context[key] === null) delete body.context[key];
      }
    }
    
    // Infer API version: prefer explicit, but fall back to body shape
    let apiVersion = APIVersionRouter.detectVersion(req);
    // If no explicit version header/path, detect by payload
    const looksLikeV2 = body?.version === '2.0.0' || (body?.message && typeof body.message === 'object' && body.message.content);
    const looksLikeV1 = !looksLikeV2; // legacy shape `{ agentId, message }`
    if (!req.headers.get('X-API-Version')) {
      apiVersion = looksLikeV2 ? '2.0' : '1.0';
    }
    log.info('Processing request', { api_version: apiVersion, method: req.method, url: req.url });
    
    // Initialize message adapter for conversions
    const messageAdapter = new MessageAdapter();
    
    if (apiVersion.startsWith('2')) {
      // Handle v2 requests
      log.info('Processing v2 request');
      
      // Validate as v2 request
      const validation = validator.validateChatRequest(body);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: validation.errors }),
          { status: 400, headers: createResponseHeaders() }
        );
      }
      
      const acceptHeader = req.headers.get('Accept');
      const wantsStream = acceptHeader?.includes('text/event-stream');
      
      if (wantsStream && body.options?.response?.stream) {
        log.info('Processing streaming request');
        return handleStreamingRequest(body, requestId);
      }
      
      // Process regular request
      log.info('Processing standard request');
      // Ensure conversation record + AI title (only for first user message flows)
      try {
        const convId = body?.context?.conversation_id;
        const agentId = body?.context?.agent_id || body?.message?.context?.agent_id;
        const userId = body?.context?.user_id || body?.message?.context?.user_id;
        const userText = (body?.message?.content?.text ?? '') as string;
        if (convId && agentId && userId && userText) {
          await ensureConversationSession(convId, agentId, userId, userText);
        }
      } catch (_e) {}
      // Robust overflow handling: retry up to 3 times trimming history via max_messages
      let response: any = null;
      const originalMax = Number((body?.options?.context?.max_messages ?? 0)) || undefined;
      let attempt = 0;
      let currentMax = originalMax;
      while (attempt < 3) {
        try {
          response = await messageProcessor.process(body, { validate: true, timeout: 30000 });
          break;
        } catch (err: any) {
          const msg = String(err?.message || '');
          const code = String((err as any)?.code || '');
          const looksLikeOverflow =
            code === 'context_length_exceeded' ||
            /context[_\s-]?length|maximum context|token limit|too many tokens/i.test(msg);
          if (!looksLikeOverflow) throw err;
          // Reduce max_messages aggressively but safely
          const prev = currentMax ?? 20;
          const next = Math.max(1, prev > 10 ? Math.floor(prev * 0.5) : prev - 1);
          currentMax = next;
          body.options = body.options || {};
          body.options.context = { ...(body.options.context || {}), max_messages: next };
          attempt += 1;
          if (attempt >= 3) {
            const headers = createResponseHeaders({ requestId });
            return new Response(
              JSON.stringify({
                error: 'context_overflow',
                title: 'Message is too long to process',
                message:
                  'I tried trimming older history three times, but this request still exceeds the model\'s limits.',
                tips: [
                  'Clear chat history or start a new conversation',
                  'Shorten the message or remove large attachments',
                  'Choose a model with a larger context window',
                ],
              }),
              { status: 413, headers: { ...headers, ...CORS_HEADERS } }
            );
          }
          // Continue loop with reduced history
          continue;
        }
      }
      // Persist assistant message (dual-write v1/v2) so the UI can load it later
      try {
        const dual = new DualWriteService(supabase as any);
        await dual.saveMessage(response.data.message, {
          context: {
            channel_id: body?.context?.channel_id ?? body?.channelId ?? null,
            sender_user_id: response.data.message?.context?.user_id,
            sender_agent_id: response.data.message?.context?.agent_id,
          },
        });
      } catch (persistErr) {
        log.warn('Assistant message persistence failed (non-fatal)', persistErr as Error);
      }
      
      // Create response headers
      const headers = createResponseHeaders({
        requestId,
        processingTime: response.metrics?.processing_time_ms,
      });
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...headers,
          ...CORS_HEADERS,
        },
      });
    } else {
      // Handle v1 requests (backward compatibility)
      log.info('Processing v1 request (backward compatibility)');
      
      // Convert v1 to v2 format
      const v2Request = messageAdapter.v1ToV2(body);
      
      // Process with v2 processor
      const v2Response = await messageProcessor.process(v2Request, {
        validate: true,
        timeout: 30000,
      });
      // Persist assistant message (dual-write v1/v2) for legacy clients
      try {
        const dual = new DualWriteService(supabase as any);
        await dual.saveMessage(v2Response.data.message, {
          context: {
            channel_id: body?.channelId ?? null,
            sender_user_id: v2Response.data.message?.context?.user_id,
            sender_agent_id: v2Response.data.message?.context?.agent_id,
          },
        });
      } catch (persistErr) {
        log.warn('Assistant message persistence failed (non-fatal)', persistErr as Error);
      }
      
      // Convert response back to v1 format
      const v1Response = messageAdapter.v2ToV1Response(v2Response);
      
      return new Response(JSON.stringify(v1Response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-API-Version': '1.0',
          ...CORS_HEADERS,
        },
      });
    }
    
  } catch (error) {
    log.error('Request handling failed', error as Error);
    const errResp = await handleError(error, requestId);
    const hdrs = new Headers(errResp.headers);
    Object.entries(CORS_HEADERS).forEach(([k,v])=>hdrs.set(k as string, v as string));
    return new Response(errResp.body, { status: errResp.status, headers: hdrs });
  } finally {
    timer.stop();
  }
}

// Streaming request handler
async function handleStreamingRequest(body: any, requestId: string): Promise<Response> {
        const log = createLogger({ request_id: requestId, streaming: true });
  const stream = new StreamResponse();
  
  // Process in background
  (async () => {
    try {
      log.info('Starting stream');
      
      for await (const event of messageProcessor.processStream(body)) {
        stream.send(event);
      }
      
      log.info('Stream completed');
      stream.close();
      
    } catch (error) {
      log.error('Stream error', error as Error);
      
      stream.send({
        event: 'error',
        error: {
          message: error instanceof Error ? error.message : 'Stream error',
          code: 'stream_error',
        },
        recoverable: false,
      });
      
      stream.close();
    }
  })();
  
  const resp = stream.getResponse();
  const hdrs = new Headers(resp.headers);
  Object.entries(CORS_HEADERS).forEach(([k,v])=>hdrs.set(k as string, v as string));
  return new Response(resp.body, { status: resp.status, headers: hdrs });
}

// Health check endpoint
async function handleHealthCheck(): Promise<Response> {
  const health = await monitoringSystem.checkHealth();
  
  return new Response(JSON.stringify(health), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
  });
}

// Metrics endpoint
async function handleMetrics(): Promise<Response> {
  const allMetrics = await monitoringSystem.exportMetrics();
  
  return new Response(JSON.stringify(allMetrics), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
  });
}

// Route handler
async function routeHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Handle CORS preflight at top-level as well
  const preflight = handleCORS(req);
  if (preflight) return preflight;
  
  // Special endpoints
  if (url.pathname === '/health') {
    return handleHealthCheck();
  }
  
  if (url.pathname === '/metrics') {
    return handleMetrics();
  }

  // Diagnostics: list discovered tools for an agent+user
  if (url.pathname === '/tools/diagnostics') {
    try {
      const agentId = url.searchParams.get('agent_id') || '';
      const userId = url.searchParams.get('user_id') || '';
      const fcm = new FunctionCallingManager(supabase as any);
      const tools = await fcm.getAvailableTools(agentId, userId);
      return new Response(JSON.stringify({ agent_id: agentId, user_id: userId, tools }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || 'diagnostics_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }
  
  // API routes (treat root path as chat entrypoint)
  if (url.pathname === '/' || url.pathname === '' || url.pathname.startsWith('/v2/') || url.pathname === '/chat') {
    return handler(req);
  }
  
  // 404 for unknown routes
  return new Response(JSON.stringify({
    error: 'Not found',
    path: url.pathname,
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

// Start server
serve(withErrorHandling(routeHandler));

// Log startup
logger.info('Advanced JSON Chat System started', {
  version: '2.0.0',
  features: {
    memory: true,
    state: isFeatureEnabled('enable_state_management'),
    advanced_json: isFeatureEnabled('use_advanced_messages'),
  },
  environment: { supabase_url: SUPABASE_URL },
});