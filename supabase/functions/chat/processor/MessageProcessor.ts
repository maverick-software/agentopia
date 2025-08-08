// Message Processor
// Core component for processing advanced JSON chat messages

// Avoid importing Supabase types here to prevent Deno/IDE resolution issues
type SupabaseClient = any;
import type { ChatRequestV2 } from '../types/message.types.ts';
import type { MessageResponse } from '../api/v2/schemas/responses.ts';
import { ValidationError } from '../api/v2/errors.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import { ContextEngine } from '../core/context/context_engine.ts';
import { StateManager } from '../core/state/state_manager.ts';
import { MonitoringSystem } from '../core/monitoring/monitoring_system.ts';
import { 
  ProcessingStage, 
  ParsingStage, 
  ValidationStage, 
  EnrichmentStage, 
  MainProcessingStage, 
  ResponseStage 
} from './stages.ts';
import { ReasoningScorer } from '../core/reasoning/reasoning_scorer.ts';
import { ReasoningSelector } from '../core/reasoning/reasoning_selector.ts';
import { ReasoningMarkov } from '../core/reasoning/reasoning_markov.ts';
import type { ReasoningOptions, ReasoningStyle } from '../core/reasoning/types.ts';
import { 
  TextMessageHandler, 
  StructuredMessageHandler, 
  ToolCallHandler, 
  MessageHandler 
} from './handlers.ts';
import { getRelevantChatHistory } from '../chat_history.ts';
import { SchemaValidator } from '../validation/SchemaValidator.ts';
import { 
  createMessage, 
  buildSuccessResponse, 
  errorToDetails, 
  chunkText 
} from './builder.ts';
import type { 
  ProcessingContext, 
  ProcessingMetrics, 
  ProcessingOptions, 
  StreamEvent 
} from './types.ts';

// ============================
// Message Processor Implementation
// ============================

export class MessageProcessor {
  private pipeline: ProcessingStage[];
  private handlers: Map<string, MessageHandler>;
  private validator: SchemaValidator;
  
  constructor(
    private _memoryManager: MemoryManager,
    private contextEngine: ContextEngine,
    private _stateManager: StateManager,
    private monitoring: MonitoringSystem,
    private openai: any,
    private supabase: SupabaseClient,
    private _config: {
      max_tokens?: number;
      timeout?: number;
      enable_streaming?: boolean;
    }
  ) {
    // Initialize validator
    this.validator = new SchemaValidator();
    
    // Initialize handlers first (needed by pipeline)
    this.handlers = new Map([
      ['text', new TextMessageHandler(this.openai, this.supabase)],
      ['structured', new StructuredMessageHandler()],
      ['tool_call', new ToolCallHandler()],
    ]);
    
    // Initialize pipeline with enrichment before reasoning
    this.pipeline = [
      new ParsingStage(),
      new ValidationStage(this.validator),
      new EnrichmentStage(this.contextEngine, this._memoryManager),
      // Reasoning stage using scorer+selector+markov
      new (class ReasoningStage extends ProcessingStage {
        constructor(private outerOpenAI: any, private outerMonitoring: MonitoringSystem) { super(); }
        get name() { return 'reasoning'; }
        async process(message: any, context: ProcessingContext, metrics: ProcessingMetrics): Promise<any> {
          try {
            const opts = (context.request_options?.reasoning || { enabled: false }) as ReasoningOptions;
            const contentText = message.content?.type === 'text' ? (message.content.text || '') : '';
            const scoreInfo = ReasoningScorer.score(contentText, (metrics.context_tokens || 0) / 4000);
            const enabled = !!opts.enabled;
            const threshold = opts.threshold ?? 0.6;
            const style: ReasoningStyle = ReasoningSelector.select(contentText, (message.tools || []).map((t: any)=>t.function?.name).filter(Boolean), opts.styles_allowed, opts.style_bias);
            metrics.reasoning = { score: scoreInfo.score, enabled, style, reason: scoreInfo.reason };
            if (enabled && scoreInfo.score >= threshold) {
              const segsForFacts = (message?.context?.context_window?.segments || []) as any[];
              const factsSeed: string[] = [];
              for (let i = 0; i < Math.min(3, segsForFacts.length); i++) {
                const c = segsForFacts[i];
                const txt = typeof c?.content === 'string' ? c.content : (c?.content?.text || c?.summary || '');
                if (txt) factsSeed.push(String(txt).slice(0, 180));
              }
              const availableTools = (message.tools || []).map((t: any)=>t.function?.name).filter(Boolean);
              const markov = new ReasoningMarkov({ style, toolsAvailable: availableTools, facts: factsSeed });
              const steps = await markov.run(
                style,
                Math.min(6, opts.max_steps ?? 4),
                async (q) => {
                  const resp = await this.outerOpenAI.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                      { role: 'system', content: 'Answer the user’s question with a single, direct sentence. Do not mention reasoning, steps, JSON, or meta commentary.' },
                      { role: 'user', content: q },
                    ],
                    temperature: 0.1,
                    max_tokens: 80,
                  });
                  const hypothesis = resp.choices?.[0]?.message?.content || '';
                  metrics.prompt_tokens = (metrics.prompt_tokens || 0) + (resp.usage?.prompt_tokens || 0);
                  metrics.completion_tokens = (metrics.completion_tokens || 0) + (resp.usage?.completion_tokens || 0);
                  metrics.tokens_used = (metrics.tokens_used || 0) + ((resp.usage?.total_tokens) || 0);
                  return hypothesis;
                },
                async (_h) => ({ needed: false, gap: 0 }), // TODO: tool test hook
                async (_a) => ({})
              );
              // Collect lightweight facts from context (top segments)
              const facts: string[] = [];
              const segs = (message?.context?.context_window?.segments || []) as any[];
              for (let i = 0; i < Math.min(3, segs.length); i++) {
                const c = segs[i];
                const text = typeof c?.content === 'string' ? c.content : (c?.content?.text || c?.summary || '');
                if (text) facts.push(String(text).slice(0, 280));
              }
              // Map detailed steps
              metrics.reasoning_steps = steps.map(s => ({
                step: s.step,
                type: s.state === 'conclude' ? 'decision' : 'analysis',
                description: s.hypothesis || s.question,
                confidence: s.confidence,
                time_ms: s.time_ms,
                state: s.state,
                question: s.question,
                hypothesis: s.hypothesis,
                action: (s as any).action,
                observation: s.observation,
                facts_considered: facts,
              }));
              (metrics as any).reasoning_graph = { states: steps.map(s => s.state) };
              (context as any).reasoning_style = style;
            }
            } catch (err) {
              try { this.outerMonitoring.captureError(err as Error, { operation: 'reasoning_stage' }); } catch {}
            }
          return message;
        }
      })(this.openai, this.monitoring),
      
      new MainProcessingStage(this.getProcessingHandlers()),
      new ResponseStage(),
    ];
  }
  
  /**
   * Process a chat request
   */
  async process(
    request: ChatRequestV2,
    options: ProcessingOptions = {}
  ): Promise<MessageResponse> {
    const timer = this.monitoring.startTimer('message_processing');
    const requestId = request.request_id ?? crypto.randomUUID();
    
    try {
      // Validate request if needed
      if (options.validate ?? true) {
        const validation = this.validator.validateChatRequest(request);
        if (!validation.valid) {
          throw new ValidationError(validation.errors);
        }
      }
      
      // Create processing context
      const context: ProcessingContext = {
        request_id: requestId,
        agent_id: request.context?.agent_id || request.message?.context?.agent_id || '',
        user_id: request.context?.user_id || request.message?.context?.user_id,
        conversation_id: request.context?.conversation_id || request.message?.context?.conversation_id,
        session_id: request.context?.session_id || request.message?.context?.session_id,
        workspace_id: request.context?.workspace_id || request.message?.context?.workspace_id,
        channel_id: request.context?.channel_id || request.message?.context?.channel_id,
        request_options: request.options,
      };
      
      // Initialize metrics
      const metrics: ProcessingMetrics = {
        start_time: Date.now(),
        stages: {},
        tokens_used: 0,
        memory_searches: 0,
        tool_executions: 0,
      };
      
      // Create initial message
      let message = createMessage(request, context);
      
      // Attach recent conversation history as working memory for context building
      try {
        const workingLimit = Math.max(0, Math.min(100, (request.options as any)?.context?.max_messages ?? 20));

        // Prefer explicit history provided in request (if any)
        const explicitHistory = (request as any)?.message?.metadata?.history || (request as any)?.context?.history;
        let recent: any[] | null = Array.isArray(explicitHistory) ? explicitHistory : null;

        if (!recent) {
          recent = await getRelevantChatHistory(
            context.channel_id ?? null,
            context.user_id ?? null,
            context.agent_id || null,
            workingLimit,
            this.supabase as any
          );
        }

        message.context = {
          ...message.context,
          recent_messages: (recent || []).slice(-workingLimit).map((m: any, idx: number) => ({
            id: m.id || String(idx),
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            timestamp: m.timestamp || m.created_at || new Date().toISOString(),
          })),
          working_memory_limit: workingLimit,
        } as any;
      } catch (_) {
        // best-effort; continue without history if it fails
      }
      
      // Run through pipeline
      for (const stage of this.pipeline) {
        const stageStart = Date.now();
        
        try {
          message = await stage.process(message, context, metrics);
          metrics.stages[stage.name] = Date.now() - stageStart;
        } catch (error) {
          this.monitoring.captureError(error as Error, {
            operation: `pipeline_stage_${stage.name}`,
          });
          throw error;
        }
      }
      
      // Complete metrics
      metrics.end_time = Date.now();
      timer.stop();
      
      // Track metrics
      this.monitoring.record({
        name: 'messages_processed',
        value: 1,
        type: 'counter',
        labels: { status: 'success' },
      });
      
      // Build response
      return buildSuccessResponse(message, context, metrics);
      
    } catch (error) {
      timer.stop();
      
      // Track error
      this.monitoring.captureError(error as Error, {
        operation: 'message_processing',
      });
      
      this.monitoring.record({
        name: 'messages_processed',
        value: 1,
        type: 'counter',
        labels: { status: 'error' },
      });
      
      throw error;
    }
  }
  
  /**
   * Process with streaming response
   */
  async *processStream(
    request: ChatRequestV2,
    options: ProcessingOptions = {}
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const requestId = request.request_id ?? crypto.randomUUID();
    
    try {
      // Start event
      yield {
        event: 'message_start',
        message_id: requestId,
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };
      
      // Process message
      const response = await this.process(request, { ...options, stream: true });
      
      // Stream content
      const content = response.data.message.content;
      if (content.type === 'text') {
        // Simulate streaming by chunking text
        const chunks = chunkText(content.text ?? '', 50);
        
        for (let i = 0; i < chunks.length; i++) {
          yield {
            event: 'content_delta',
            delta: chunks[i],
            index: i,
          finish_reason: (i === chunks.length - 1 ? 'stop' : undefined) as 'stop' | 'length' | 'tool_calls' | undefined,
          };
          
          // Simulate network delay
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Complete event
      yield {
        event: 'message_complete',
        message: response.data.message,
        metrics: response.metrics as any,
      };
      
    } catch (error) {
      yield {
        event: 'error',
        error: errorToDetails(error as Error),
        recoverable: false,
      };
    }
  }
  
  /**
   * Validate a message without processing
   */
  async validate(request: ChatRequestV2): Promise<{ valid: boolean; errors?: any[] }> {
    const validation = this.validator.validateChatRequest(request);
    return validation;
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private getProcessingHandlers(): MessageHandler[] {
    return Array.from(this.handlers.values());
  }

  // Temporarily reference unused injected services to avoid linter warnings
  private _touchUnused(): void { /* no-op */ }
}