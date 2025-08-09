// Chat Function Entry Point (Advanced JSON System)
// Main handler for the advanced JSON-based chat system

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import OpenAI from 'npm:openai@4.28.0';

// Import components
import { MessageProcessor } from './processor/index.ts';
import { MemoryManager } from './core/memory/memory_manager.ts';
import { ContextEngine } from './core/context/context_engine.ts';
import { StateManager } from './core/state/state_manager.ts';
import { MonitoringSystem } from './core/monitoring/monitoring_system.ts';
import { APIVersionRouter, MessageAdapter, getFeatureFlags, isFeatureEnabled } from './adapters/index.ts';
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
const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
const PINECONE_INDEX = Deno.env.get('PINECONE_INDEX') || 'agentopia';

// Initialize services
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = PINECONE_API_KEY ? new Pinecone({ apiKey: PINECONE_API_KEY }) : null;

// Initialize core components
const memoryManager = new MemoryManager(supabase, pinecone, openai, {
  index_name: PINECONE_INDEX,
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
    
    // Parse request body
    const body = await req.json();
    
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
      const response = await messageProcessor.process(body, {
        validate: true,
        timeout: 30000,
      });
      
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
    return handleError(error, requestId);
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
  
  return stream.getResponse();
}

// Health check endpoint
async function handleHealthCheck(): Promise<Response> {
  const health = await monitoringSystem.checkHealth();
  
  return new Response(JSON.stringify(health), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
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
    },
  });
}

// Route handler
async function routeHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
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
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || 'diagnostics_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // API routes
  if (url.pathname.startsWith('/v2/') || url.pathname === '/chat') {
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
    },
  });
}

// Start server
serve(withErrorHandling(routeHandler));

// Log startup
logger.info('Advanced JSON Chat System started', {
  version: '2.0.0',
  features: {
    memory: isFeatureEnabled('enable_memory_system'),
    state: isFeatureEnabled('enable_state_management'),
    advanced_json: isFeatureEnabled('use_advanced_messages'),
  },
  environment: {
    supabase_url: SUPABASE_URL,
    pinecone_index: PINECONE_INDEX,
  },
});