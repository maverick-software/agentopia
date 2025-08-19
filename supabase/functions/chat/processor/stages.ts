// Processing Pipeline Stages
// Contains all processing stage implementations

import type { AdvancedChatMessage } from '../types/message.types.ts';
import { APIError, ValidationError } from '../api/v2/errors.ts';
import { ErrorCode } from '../api/v2/schemas/responses.ts';
import { SchemaValidator } from '../validation/SchemaValidator.ts';
import { ContextEngine } from '../core/context/context_engine.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import type { MessageHandler } from './handlers.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';

// Base ProcessingStage class
export abstract class ProcessingStage {
  abstract get name(): string;
  abstract process(
    message: AdvancedChatMessage,
    context: ProcessingContext,
    metrics: ProcessingMetrics
  ): Promise<AdvancedChatMessage>;
}

// Parsing Stage
export class ParsingStage extends ProcessingStage {
  get name(): string {
    return 'parsing';
  }
  
  async process(
    message: AdvancedChatMessage,
    context: ProcessingContext,
    metrics: ProcessingMetrics
  ): Promise<AdvancedChatMessage> {
    // Parsing is already done in createMessage
    // This stage could handle additional parsing logic
    return message;
  }
}

// Validation Stage
export class ValidationStage extends ProcessingStage {
  constructor(private validator: SchemaValidator) {
    super();
  }
  
  get name(): string {
    return 'validation';
  }
  
  async process(
    message: AdvancedChatMessage,
    context: ProcessingContext,
    metrics: ProcessingMetrics
  ): Promise<AdvancedChatMessage> {
    // Validate message structure
    const validation = this.validator.validateMessage(message);
    
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // Validate business rules
    this.validateBusinessRules(message, context);
    
    return message;
  }
  
  private validateBusinessRules(
    message: AdvancedChatMessage,
    context: ProcessingContext
  ): void {
    // Check token limits
    if (message.content.type === 'text') {
      const estimatedTokens = Math.ceil(message.content.text.length / 4);
      if (estimatedTokens > 100000) {
        throw new APIError(
          ErrorCode.CONTEXT_TOO_LARGE,
          'Message content exceeds token limit',
          422
        );
      }
    }
    
    // Check tool limits
    if (message.tools && message.tools.length > 10) {
      throw new APIError(
        ErrorCode.INVALID_REQUEST,
        'Too many tool calls in message',
        400
      );
    }
  }
}

// Enrichment Stage
export class EnrichmentStage extends ProcessingStage {
  constructor(private contextEngine: ContextEngine, private memoryManager: MemoryManager) {
    super();
  }
  
  get name(): string {
    return 'enrichment';
  }
  
  async process(
    message: AdvancedChatMessage,
    context: ProcessingContext,
    metrics: ProcessingMetrics
  ): Promise<AdvancedChatMessage> {
    const startedAt = Date.now();
    // Initialize memory metrics so UI reflects status even if search is skipped
    if (!metrics.episodic_memory) {
      (metrics as any).episodic_memory = {
        searched: false,
        results_count: 0,
        relevance_scores: [],
        memories_used: [],
        search_time_ms: 0,
      };
    }
    if (!metrics.semantic_memory) {
      (metrics as any).semantic_memory = {
        searched: false,
        results_count: 0,
        relevance_scores: [],
        concepts_retrieved: [],
        search_time_ms: 0,
      };
    }
    // Build context request from message
    const contextRequest = {
      query: message.content.type === 'text' ? message.content.text : '',
      conversation_context: {
        conversation_id: message.conversation_id,
        session_id: message.session_id || '',
        agent_id: message.context?.agent_id || '',
        channel_id: message.context?.channel_id || '',
        user_id: message.context?.user_id || '',
        workspace_id: message.context?.workspace_id || '',
          // Working memory from prior step (if provided)
          recent_messages: (message as any)?.context?.recent_messages || [],
          working_memory_limit: (message as any)?.context?.working_memory_limit ?? 20,
      },
      token_budget: 4000,
    };
    
    // Build optimized context
    const optimizedContext = await this.contextEngine.buildContext(contextRequest);
    
    // Memory retrieval (episodic + semantic) using MemoryManager when available
    try {
      const queryText = message.content.type === 'text' ? (message.content.text || '') : '';
      if (queryText && context.agent_id) {
        const memStart = Date.now();
        const memoryResults = await this.memoryManager.contextualSearch(
          context.agent_id,
          queryText,
          { memory_types: ['episodic', 'semantic'] }
        );

        // Episodic metrics
        metrics.episodic_memory = {
          searched: true,
          results_count: memoryResults.episodic?.length || 0,
          relevance_scores: memoryResults.relevance_scores || [],
          memories_used: (memoryResults.episodic || []).slice(0, 5),
          search_time_ms: Date.now() - memStart,
        };

        // Semantic metrics
        metrics.semantic_memory = {
          searched: true,
          results_count: memoryResults.semantic?.length || 0,
          relevance_scores: memoryResults.relevance_scores || [],
          concepts_retrieved: (memoryResults.semantic || []).slice(0, 5).map((m: any) => m?.concept || '').filter(Boolean),
          search_time_ms: Date.now() - memStart,
        };

        // Track sources
        metrics.context_sources = Array.from(new Set([...(metrics.context_sources || []), 'episodic_memory', 'semantic_memory']));
        metrics.memory_searches = (metrics.memory_searches || 0) + 1;

        // Merge memory results into context window so they are available before reasoning/tool use
        const estimateTokens = (text: string) => Math.ceil((text || '').length / 4);
        const existingSections = (optimizedContext as any)?.context_window?.sections || [];
        const memorySections: any[] = [];

        // Add top episodic snippets
        for (const m of (memoryResults.episodic || []).slice(0, 3)) {
          const text = typeof m?.content?.event === 'string'
            ? `${m.content.event}\n${JSON.stringify(m.content.context || {})}`
            : JSON.stringify(m?.content || {});
          memorySections.push({
            id: `episodic_${m.id || crypto.randomUUID()}`,
            title: 'Episodic Memory',
            content: text,
            source: 'episodic_memory',
            priority: 2,
            token_count: estimateTokens(text),
            relevance_score: (m as any)?.relevance || 0.5,
            metadata: { memory_id: m.id, created_at: m.created_at },
          });
        }

        // Add top semantic concepts
        for (const m of (memoryResults.semantic || []).slice(0, 3)) {
          const text = m?.content?.definition
            ? `${m.content.concept}: ${m.content.definition}`
            : JSON.stringify(m?.content || {});
          memorySections.push({
            id: `semantic_${m.id || crypto.randomUUID()}`,
            title: `Semantic Knowledge` ,
            content: text,
            source: 'semantic_memory',
            priority: 2,
            token_count: estimateTokens(text),
            relevance_score: (m as any)?.relevance || 0.6,
            metadata: { memory_id: m.id, created_at: m.created_at },
          });
        }

        // Include low-confidence external fallback (vector_search.ts) when present
        if ((memoryResults as any)?.external && (memoryResults as any).external.length > 0) {
          for (const m of (memoryResults as any).external.slice(0, 1)) {
            const text = typeof m?.content?.definition === 'string' ? m.content.definition : String(m?.content || '');
            memorySections.push({
              id: `external_${crypto.randomUUID()}`,
              title: 'Vector Results (low confidence)',
              content: text,
              source: 'episodic_memory',
              priority: 3,
              token_count: estimateTokens(text),
              relevance_score: 0.3,
            });
          }
        }

        // GetZep Knowledge Graph retrieval (semantic memory)
        try {
          console.log('[EnrichmentStage] Checking for GetZep knowledge graph...');
          const { data: agentRow } = await (this.memoryManager as any).supabase
            .from('agents')
            .select('user_id, metadata')
            .eq('id', context.agent_id)
            .maybeSingle();
          const userId = (agentRow as any)?.user_id;
          const agentSettings = ((agentRow as any)?.metadata?.settings || {}) as Record<string, any>;
          const useAccountGraph = agentSettings.use_account_graph === true; // Must be explicitly enabled
          
          console.log(`[EnrichmentStage] Agent ${context.agent_id}: useAccountGraph=${useAccountGraph}, userId=${userId}, hasQuery=${!!queryText}`);
          
          if (useAccountGraph && userId && queryText) {
            try {
              // Import and use GetZep retrieval
              const { searchGetZepKnowledgeGraph, extractConcepts } = await import('../core/memory/getzep_retrieval.ts');
              
              // Search GetZep knowledge graph
              const graphStart = Date.now();
              const getzepResults = await searchGetZepKnowledgeGraph(queryText, userId, (this.memoryManager as any).supabase);
              
              if (getzepResults.length > 0) {
                // Add GetZep results to memory sections
                for (const result of getzepResults.slice(0, 3)) {
                  memorySections.push({
                    id: `getzep_${crypto.randomUUID()}`,
                    title: 'Knowledge Graph',
                    content: result.content,
                    source: 'semantic_memory',
                    priority: 1, // High priority for semantic knowledge
                    token_count: estimateTokens(result.content),
                    relevance_score: result.score,
                    metadata: { 
                      source: 'getzep',
                      ...result.metadata 
                    }
                  });
                }
                
                // Update metrics to show semantic memory was used
                if (!metrics.semantic_memory) {
                  metrics.semantic_memory = {
                    searched: true,
                    results_count: 0,
                    relevance_scores: [],
                    concepts_retrieved: [],
                    search_time_ms: 0
                  };
                }
                metrics.semantic_memory.searched = true;
                metrics.semantic_memory.results_count = getzepResults.length;
                metrics.semantic_memory.relevance_scores = getzepResults.map(r => r.score);
                metrics.semantic_memory.concepts_retrieved = extractConcepts(queryText);
                metrics.semantic_memory.search_time_ms = Date.now() - graphStart;
                
                console.log(`[EnrichmentStage] GetZep returned ${getzepResults.length} semantic results`);
              } else {
                console.log('[EnrichmentStage] No GetZep results for query');
              }
            } catch (err) {
              console.warn('[EnrichmentStage] GetZep retrieval error:', err);
            }
          }
        } catch (err) {
          console.warn('[EnrichmentStage] Error checking agent graph settings:', err);
        }

        const mergedSections = [...existingSections, ...memorySections];
        const totalTokens = mergedSections.reduce((sum: number, s: any) => sum + (s.token_count || 0), 0);
        (optimizedContext as any).context_window.sections = mergedSections;
        (optimizedContext as any).context_window.total_tokens = totalTokens;

        // Adjust metrics to reflect injected memory sections so Process UI shows results
        const episodicCount = memorySections.filter((s) => s.source === 'episodic_memory').length;
        const semanticCount = memorySections.filter((s) => s.source === 'semantic_memory').length;
        if ((metrics.episodic_memory?.results_count || 0) === 0 && episodicCount > 0) {
          metrics.episodic_memory = {
            ...(metrics.episodic_memory as any),
            searched: true,
            results_count: episodicCount,
          } as any;
        }
        if ((metrics.semantic_memory?.results_count || 0) === 0 && semanticCount > 0) {
          metrics.semantic_memory = {
            ...(metrics.semantic_memory as any),
            searched: true,
            results_count: semanticCount,
          } as any;
        }
      }
    } catch (_) {
      // Best-effort; do not fail pipeline on memory fetch issues
    }

    // Update message with enriched context
    message.context = {
      ...message.context,
      context_window: optimizedContext.context_window,
      metadata: {
        ...message.context?.metadata,
        context_quality_score: optimizedContext.quality_score,
        context_sources: optimizedContext.sources_used,
        context_build_time_ms: optimizedContext.build_time_ms,
      },
    };
    
    // Update metrics
    metrics.context_tokens = optimizedContext.total_tokens;
    metrics.stage_timings = { ...(metrics.stage_timings || {}), enrichment: Date.now() - startedAt };
    
    return message;
  }
}

// Main Processing Stage
export class MainProcessingStage extends ProcessingStage {
  constructor(private handlers: MessageHandler[]) {
    super();
  }
  
  get name(): string {
    return 'processing';
  }
  
  async process(
    message: AdvancedChatMessage,
    context: ProcessingContext,
    metrics: ProcessingMetrics
  ): Promise<AdvancedChatMessage> {
    // Find appropriate handler
    const handler = this.handlers.find(h => h.canHandle(message));
    
    if (!handler) {
      throw new APIError(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'No handler found for message type',
        400
      );
    }
    
    // Process with handler
    const result = await handler.handle(message, context);
    
    // Update metrics (aggregate from handler result)
    metrics.tokens_used += result.metrics.tokens_used;
    metrics.tool_executions += result.metrics.tool_executions;
    
    // Carry through model/tokens if provided
    if (result.metrics.prompt_tokens) {
      metrics.prompt_tokens = (metrics.prompt_tokens || 0) + (result.metrics.prompt_tokens || 0);
    }
    if (result.metrics.completion_tokens) {
      metrics.completion_tokens = (metrics.completion_tokens || 0) + (result.metrics.completion_tokens || 0);
    }
    if (result.metrics.model_used) {
      metrics.model_used = result.metrics.model_used;
    }

    // Merge tool details for processing_details modal
    if (Array.isArray(result.metrics.tool_details) && result.metrics.tool_details.length > 0) {
      metrics.tool_details = [
        ...((metrics.tool_details as any[]) || []),
        ...result.metrics.tool_details,
      ];
    }
    // Propagate discovered tools and whether any were requested
    if ((result.metrics as any).discovered_tools) {
      (metrics as any).discovered_tools = (result.metrics as any).discovered_tools;
    }
    if ((result.metrics as any).tool_requested !== undefined) {
      (metrics as any).tool_requested = (result.metrics as any).tool_requested;
    }
    
    return result.message;
  }
}

// Response Stage
export class ResponseStage extends ProcessingStage {
  get name(): string {
    return 'response';
  }
  
  async process(
    message: AdvancedChatMessage,
    context: ProcessingContext,
    metrics: ProcessingMetrics
  ): Promise<AdvancedChatMessage> {
    // Add response metadata
    message.metadata = {
      ...message.metadata,
      processed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - metrics.start_time,
      pipeline_stages: Object.keys(metrics.stages),
    };
    
    // Add audit information if needed
    if (context.user_id) {
      message.audit = {
        created_by: context.user_id,
        created_at: message.created_at,
        ip_address: '0.0.0.0', // Would get from request
        user_agent: 'Unknown', // Would get from request
      };
    }
    
    return message;
  }
}