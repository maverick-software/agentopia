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
// Removed: MonitoringSystem - feature archived (unused, empty tables)
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
import { MemoryIntegratedMarkov } from '../core/reasoning/memory_integrated_markov.ts';
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
      ['text', new TextMessageHandler(this.openai, this.supabase, this._memoryManager)],
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
        constructor(
          private outerOpenAI: any, 
          private outerMonitoring: MonitoringSystem, 
          private _memoryManager: any,
          private outerSupabase: SupabaseClient
        ) { super(); }
        get name() { return 'reasoning'; }
        async process(message: any, context: ProcessingContext, metrics: ProcessingMetrics): Promise<any> {
          try {
            // GUARD CLAUSE: Check if reasoning is enabled in agent settings
            let reasoningEnabled = false; // DISABLED BY DEFAULT
            let userThreshold = 0.3;
            
            try {
              const { data: agent } = await this.outerSupabase
                .from('agents')
                .select('metadata')
                .eq('id', context.agent_id)
                .single();
              
              // Check metadata.settings.reasoning_enabled (set by UI toggle)
              reasoningEnabled = agent?.metadata?.settings?.reasoning_enabled === true;
              
              const reasoningSettings = agent?.metadata?.reasoning_settings;
              if (reasoningSettings?.threshold !== undefined) {
                userThreshold = Math.max(0, Math.min(1, reasoningSettings.threshold));
              }
              
              console.log(`[ReasoningStage] Agent settings - reasoning_enabled: ${reasoningEnabled}, threshold: ${userThreshold}`);
            } catch (e) {
              console.log(`[ReasoningStage] Error loading settings, reasoning disabled by default`, e);
            }

            // GUARD CLAUSE: If reasoning disabled in database, skip entirely (don't allow request override)
            if (!reasoningEnabled) {
              console.log(`[ReasoningStage] ⏭️ Advanced Reasoning is DISABLED in agent settings - skipping reasoning chain`);
              metrics.reasoning = { score: 0, enabled: false, style: 'none' as any, reason: 'disabled_by_user' };
              return message;
            }
            
            // Allow threshold override from request (but not enabled flag)
            if (context.request_options?.reasoning?.threshold !== undefined) {
              userThreshold = context.request_options.reasoning.threshold;
              console.log(`[ReasoningStage] Using threshold from request: ${userThreshold}`);
            }

            const defaultOpts: ReasoningOptions = { enabled: reasoningEnabled, threshold: userThreshold } as any;
            const opts = ({ ...defaultOpts, ...(context.request_options?.reasoning || {}) }) as ReasoningOptions;
            const contentText = message.content?.type === 'text' ? (message.content.text || '') : '';
            const scoreInfo = ReasoningScorer.score(contentText, (metrics.context_tokens || 0) / 4000);
            const requestedEnabled = opts.enabled !== false; // default on
            const threshold = opts.threshold ?? 0.3;
            const style: ReasoningStyle = ReasoningSelector.select(contentText, (message.tools || []).map((t: any)=>t.function?.name).filter(Boolean), opts.styles_allowed, opts.style_bias);
            const passes = requestedEnabled && scoreInfo.score >= threshold;
            metrics.reasoning = { score: scoreInfo.score, enabled: passes, style, reason: scoreInfo.reason };
            (metrics as any).reasoning_ran = passes;
            
            console.log(`[ReasoningStage] Score: ${scoreInfo.score.toFixed(3)} vs Threshold: ${threshold.toFixed(3)} = ${passes ? 'ACTIVE' : 'INACTIVE'}`);
            console.log(`[ReasoningStage] Details - Enabled: ${requestedEnabled}, Style: ${style}, Reason: ${scoreInfo.reason}`);
            // Always generate reasoning steps when score is above threshold, even if not "enabled"
            // This allows users to see what reasoning would have done
            if (scoreInfo.score >= threshold || passes) {
              console.log(`[ReasoningStage] Executing reasoning chain (score ${scoreInfo.score.toFixed(3)} >= threshold ${threshold.toFixed(3)})`);
              // Use structured sections, not segments
              const segsForFacts = (message?.context?.context_window?.sections || []) as any[];
              const factsSeed: string[] = [];
              for (let i = 0; i < Math.min(3, segsForFacts.length); i++) {
                const c = segsForFacts[i];
                const txt = typeof c?.content === 'string' ? c.content : (c?.content?.text || c?.summary || '');
                if (txt) factsSeed.push(String(txt).slice(0, 180));
              }
              const availableTools = (message.tools || []).map((t: any)=>t.function?.name).filter(Boolean);
              console.log(`[ReasoningStage] Creating MemoryIntegratedMarkov with style: ${style}, tools: ${availableTools.length}, facts: ${factsSeed.length}`);
              
              // Use memory-integrated reasoning with access to the memory manager
              console.log(`[ReasoningStage] Memory manager available: ${!!this._memoryManager}, Agent ID: ${context.agent_id}`);
              const markov = new MemoryIntegratedMarkov({ 
                style, 
                toolsAvailable: availableTools, 
                facts: factsSeed,
                memoryManager: this._memoryManager,
                agentId: context.agent_id,
                query: typeof message.content === 'object' && message.content.type === 'text' 
                  ? message.content.text 
                  : String(message.content)
              });
              
              let steps: any[] = [];
              try {
                console.log(`[ReasoningStage] Starting markov.run with max_steps: ${Math.min(6, opts.max_steps ?? 4)}`);
                steps = await markov.run(
                  style,
                  Math.min(6, opts.max_steps ?? 4),
                  async (q) => {
                    console.log(`[ReasoningStage] Markov asking question: ${q?.substring(0, 100)}...`);
                    // Use router for consistency with per-agent model selection when enabled
                    let hypothesis = '';
                    const useRouter = (Deno.env.get('USE_LLM_ROUTER') || '').toLowerCase() === 'true';
                    if (useRouter && (context as any)?.agent_id) {
                      let LLMRouter: any = null;
                      try {
                        const mod = await import('../../shared/llm/router.ts');
                        LLMRouter = (mod as any).LLMRouter;
                        console.log(`[ReasoningStage] LLMRouter imported successfully:`, typeof LLMRouter);
                      } catch (importErr) {
                        console.error(`[ReasoningStage] Failed to import LLMRouter:`, importErr);
                        // Fall back to direct OpenAI
                      }
                      if (LLMRouter) {
                        const router = new LLMRouter();
                        const resp = await router.chat((context as any).agent_id, [
                          { role: 'system', content: "Answer the user's question with a single, direct sentence. Do not mention reasoning, steps, JSON, or meta commentary." },
                          { role: 'user', content: q },
                        ] as any, { temperature: 0.1, maxTokens: 80 });
                        hypothesis = resp.text || '';
                        if (resp.usage) {
                          metrics.prompt_tokens = (metrics.prompt_tokens || 0) + (resp.usage.prompt || 0);
                          metrics.completion_tokens = (metrics.completion_tokens || 0) + (resp.usage.completion || 0);
                          metrics.tokens_used = (metrics.tokens_used || 0) + (resp.usage.total || 0);
                        }
                      } else {
                        // Fallback to direct OpenAI when router fails
                        const resp = await this.outerOpenAI.chat.completions.create({
                          model: 'gpt-4o-mini',
                          messages: [
                            { role: 'system', content: "Answer the user's question with a single, direct sentence. Do not mention reasoning, steps, JSON, or meta commentary." },
                            { role: 'user', content: q },
                          ],
                          temperature: 0.1,
                          max_tokens: 80,
                        });
                        hypothesis = resp.choices?.[0]?.message?.content || '';
                        metrics.prompt_tokens = (metrics.prompt_tokens || 0) + (resp.usage?.prompt_tokens || 0);
                        metrics.completion_tokens = (metrics.completion_tokens || 0) + (resp.usage?.completion_tokens || 0);
                        metrics.tokens_used = (metrics.tokens_used || 0) + ((resp.usage?.total_tokens) || 0);
                      }
                    } else {
                      // Use direct OpenAI when router is disabled
                      const resp = await this.outerOpenAI.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                          { role: 'system', content: "Answer the user's question with a single, direct sentence. Do not mention reasoning, steps, JSON, or meta commentary." },
                          { role: 'user', content: q },
                        ],
                        temperature: 0.1,
                        max_tokens: 80,
                      });
                      hypothesis = resp.choices?.[0]?.message?.content || '';
                      metrics.prompt_tokens = (metrics.prompt_tokens || 0) + (resp.usage?.prompt_tokens || 0);
                      metrics.completion_tokens = (metrics.completion_tokens || 0) + (resp.usage?.completion_tokens || 0);
                      metrics.tokens_used = (metrics.tokens_used || 0) + ((resp.usage?.total_tokens) || 0);
                    }
                    return hypothesis;
                  },
                  async (_h, memories) => {
                    // Enhanced tool test hook with memory context
                    // Check if memories suggest tool usage patterns
                    const toolsFromMemories = memories?.episodic
                      ?.flatMap(m => m.content?.context?.tools_used || [])
                      .filter(Boolean) || [];
                    
                    const gap = toolsFromMemories.length > 0 ? 0.3 : 0.1;
                    return { needed: false, gap };
                  },
                  async (_a) => ({})
                );
                console.log(`[ReasoningStage] Markov.run completed with ${steps.length} steps`);
              } catch (markovErr) {
                console.error(`[ReasoningStage] Markov.run failed:`, markovErr);
                steps = [];
              }
              // Collect lightweight facts from context (top segments)
              const facts: string[] = [];
              const segs = (message?.context?.context_window?.sections || []) as any[];
              for (let i = 0; i < Math.min(3, segs.length); i++) {
                const c = segs[i];
                const text = typeof c?.content === 'string' ? c.content : (c?.content?.text || c?.summary || '');
                if (text) facts.push(String(text).slice(0, 280));
              }
              // Map detailed steps (ensure at least one step recorded)
              console.log(`[ReasoningStage] Mapping ${steps.length} raw steps to structured format`);
              const mapped = steps.map(s => ({
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
                // Enhanced memory integration
                memories_used: s.memories_used || { episodic: [], semantic: [] },
                memory_insights: s.memory_insights || [],
                episodic_count: s.memories_used?.episodic?.length || 0,
                semantic_count: s.memories_used?.semantic?.length || 0,
              }));
              console.log(`[ReasoningStage] Mapped to ${mapped.length} structured steps with memory integration`);
              metrics.reasoning_steps = mapped.length > 0 ? mapped : [{
                step: 1,
                type: 'analysis',
                description: 'Reasoning engaged (fallback): no explicit steps captured.',
                confidence: 0.0,
                time_ms: 0,
                state: 'analyze',
                question: '',
                hypothesis: '',
                action: undefined,
                observation: undefined,
                facts_considered: facts,
              } as any];
              (metrics as any).reasoning_graph = { states: steps.map(s => s.state) };
              (context as any).reasoning_style = style;
              
              // Log reasoning chain capture
              console.log(`[ReasoningStage] Captured ${metrics.reasoning_steps.length} reasoning steps`);
              if (metrics.reasoning_steps.length > 0) {
                console.log(`[ReasoningStage] First step: ${JSON.stringify(metrics.reasoning_steps[0].description)}`);
              }
              
              // Pass reasoning info to the message context so handlers can access it
              (message.context as any).reasoning = {
                style,
                steps: metrics.reasoning_steps,
                enabled: passes,
                score: scoreInfo.score,
                threshold,
              };
            }
            } catch (err) {
              try { this.outerMonitoring.captureError(err as Error, { operation: 'reasoning_stage' }); } catch {}
            }
          return message;
        }
      })(this.openai, this.monitoring, this._memoryManager, this.supabase),
      
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
        agent_id: request.context?.agent_id || request.message?.context?.agent_id || request.agent_id || undefined,
        user_id: request.context?.user_id || request.message?.context?.user_id || request.user_id || undefined,
        conversation_id: request.context?.conversation_id || request.message?.context?.conversation_id || request.conversation_id || undefined,
        session_id: request.context?.session_id || request.message?.context?.session_id || request.session_id || undefined,
        workspace_id: request.context?.workspace_id || request.message?.context?.workspace_id || undefined,
        channel_id: request.context?.channel_id || request.message?.context?.channel_id || undefined,
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
            this.supabase as any,
            context.conversation_id ?? null
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