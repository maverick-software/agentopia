import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';
import { FunctionCallingManager } from '../function_calling/manager.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import { PromptBuilder } from './utils/prompt-builder.ts';
import { MarkdownFormatter } from './utils/markdown-formatter.ts';
import { ToolExecutor } from './utils/tool-executor.ts';

export interface MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean;
  handle(message: AdvancedChatMessage, context: ProcessingContext): Promise<{
    message: AdvancedChatMessage;
    context: ProcessingContext;
    metrics: ProcessingMetrics;
  }>;
}

export class TextMessageHandler implements MessageHandler {
  private promptBuilder: PromptBuilder;
  
  constructor(private openai: any, private supabase: any, private memoryManager?: MemoryManager | null) {
    this.promptBuilder = new PromptBuilder(supabase);
  }
  
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).content?.type === 'text';
  }
  
  /** Normalize tool definitions and drop malformed ones */
  private normalizeTools(tools: any[]): Array<{ name: string; description?: string; parameters: any }> {
    return MarkdownFormatter.normalizeTools(tools);
  }
  
  private ensureProperMarkdownFormatting(text: string): string {
    return MarkdownFormatter.ensureProperFormatting(text);
  }
  
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const startTime = Date.now();
    const msgs: Array<{ role: 'system'|'user'|'assistant'|'tool'; content: string }> = [];
    
    if (context.agent_id) {
      const { data: agent } = await this.supabase
        .from('agents')
        .select('system_instructions, assistant_instructions, description, personality, name')
        .eq('id', context.agent_id)
        .single();
      
      // Build comprehensive system prompt using PromptBuilder
      const systemPrompt = this.promptBuilder.buildSystemPromptString(agent);
      if (systemPrompt) {
        msgs.push({ role: 'system', content: systemPrompt });
      }

      // CONTEXT WINDOW INJECTION (episodic/semantic context) - as assistant message
      const ctxWin = (message as any)?.context?.context_window;
      const sections = Array.isArray(ctxWin?.sections) ? ctxWin.sections : [];
      if (sections.length > 0) {
        const toLabel = (s: any): string => {
          if (s?.source === 'episodic_memory') return 'EPISODIC MEMORY';
          if (s?.source === 'semantic_memory') return 'SEMANTIC MEMORY';
          return s?.title || 'Context';
        };

        const top = sections
          .slice(0, 4)
          .map((s: any) => `${toLabel(s)}:\n${String(s.content || '').slice(0, 2000)}`);
        const ctxBlock = [
          '=== CONTEXT WINDOW ===',
          ...top,
          '=== END CONTEXT WINDOW ===\n',
        ].join('\n\n');
        msgs.push({ role: 'assistant', content: ctxBlock });
      }
      if (agent?.assistant_instructions) msgs.push({ role: 'assistant', content: agent.assistant_instructions });
    }
    // ADD CONVERSATION HISTORY FROM CONTEXT!
    const recentMessages = (message as any)?.context?.recent_messages || [];
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        msgs.push({ 
          role: msg.role as 'user' | 'assistant', 
          content: String(msg.content || '')
        });
      }
    }
    
    // Current message
    msgs.push({ role: 'user', content: (message as any).content?.text || '' });

    // CRITICAL INTEGRATION: Add reasoning context if available
    const reasoningContext = (message as any).context?.reasoning;
    const reasoningPrompt = this.promptBuilder.buildReasoningContext(reasoningContext);
    if (reasoningPrompt) {
      msgs.push({ role: 'assistant', content: reasoningPrompt });
      console.log(`[TextMessageHandler] Added ephemeral reasoning context (${reasoningPrompt.length} chars) as assistant message`);
    }

    // RAOR: Discover available tools (Gmail, Web Search, SendGrid in future)
    const authToken = (context as any)?.request_options?.auth?.token || '';
    console.log(`[FunctionCalling] Auth token available: ${!!authToken}`);
    console.log(`[FunctionCalling] Context - agent_id: ${context.agent_id}, user_id: ${context.user_id}`);
    const fcm = new FunctionCallingManager(this.supabase as any, authToken);
    const availableTools = (context.agent_id && context.user_id)
      ? await fcm.getAvailableTools(context.agent_id, context.user_id)
      : [];
    
    if (!context.agent_id || !context.user_id) {
      console.warn(`[FunctionCalling] Missing context - agent_id: ${!!context.agent_id}, user_id: ${!!context.user_id} - cannot fetch tools`);
    }

    // Nudge awareness: briefly declare available tools and guidelines in a system message
    if (availableTools.length > 0) {
      const toolNames = availableTools.map(t => t.name).join(', ');
      const guidance = this.promptBuilder.buildToolGuidance(toolNames);
      msgs.push({ role: 'system', content: guidance });
      
      // Add explicit instruction for action requests
      msgs.push({ 
        role: 'system', 
        content: `CRITICAL: If the user's message is a REQUEST or COMMAND (send, create, search, get, find, etc.), you MUST call the appropriate tool function. DO NOT just respond with text saying you will do it - actually call the function. This is MANDATORY for all action requests.` 
      });
    }

    // First reasoning/act step (LLMRouter when enabled)
    // Guard for environments without Deno types
    const useRouter = (typeof (globalThis as any).Deno !== 'undefined')
      ? ((((globalThis as any).Deno.env.get('USE_LLM_ROUTER') || '').toLowerCase() === 'true'))
      : false;
    let completion: any;
    let router: any = null;
    let effectiveModel = 'gpt-4';
    if (useRouter && context.agent_id) {
      try {
        const mod = await import('../../shared/llm/router.ts');
        const LLMRouter = (mod as any).LLMRouter;
        router = LLMRouter ? new LLMRouter() : null;
      } catch (_) {
        router = null;
      }
      if (!router) {
        // Fallback to OpenAI if router unavailable
        effectiveModel = 'gpt-4';
        
        // Debug: Log tools array before sending to OpenAI
        const normalized = this.normalizeTools(availableTools);
        console.log('[DEBUG] Router fallback - Available tools before OpenAI (normalized):', JSON.stringify(normalized, null, 2));
        const formattedTools = normalized.map((fn) => ({ type: 'function', function: fn }));
        console.log('[DEBUG] Router fallback - Formatted tools for OpenAI:', JSON.stringify(formattedTools, null, 2));
        
        try {
          completion = await this.openai.chat.completions.create({
            model: 'gpt-4', messages: msgs, temperature: 0.7, max_tokens: 1200,
            tools: formattedTools, tool_choice: 'auto'
          });
        } catch (toolError: any) {
          // Handle tool validation errors gracefully
          if (toolError?.error?.param?.includes('tools') || toolError?.message?.includes('tools')) {
            console.warn('[TextMessageHandler] Router fallback tool validation failed, falling back to no-tools mode:', toolError.message);
            
            // Retry without tools
            completion = await this.openai.chat.completions.create({
              model: 'gpt-4', messages: msgs, temperature: 0.7, max_tokens: 1200
              // No tools parameter - graceful degradation
            });
            
            // Add a note about limited capabilities
            if (completion.choices?.[0]?.message?.content) {
              completion.choices[0].message.content += '\n\n*Note: Some advanced features are temporarily unavailable due to a technical issue.*';
            }
          } else {
            // Re-throw non-tool errors
            throw toolError;
          }
        }
      } else {
        const resolved = await router.resolveAgent(context.agent_id).catch(() => null);
        effectiveModel = resolved?.prefs?.model || effectiveModel;
        // Convert OpenAI format tools to LLMTool format for router
        const llmTools = availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        const resp = await router.chat(context.agent_id, msgs as any, { tools: llmTools, temperature: 0.7, maxTokens: 1200 });
        const respToolCalls = (resp.toolCalls || []) as Array<{ id: string; name: string; arguments: string }>;
        completion = {
          choices: [{ message: { content: resp.text, tool_calls: respToolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) } }],
          usage: resp.usage ? { prompt_tokens: resp.usage.prompt, completion_tokens: resp.usage.completion, total_tokens: resp.usage.total } : undefined,
        };
      }
    } else {
      effectiveModel = 'gpt-4';
      
      // Debug: Log tools array before sending to OpenAI
      const normalized = this.normalizeTools(availableTools);
      console.log('[DEBUG] Available tools before OpenAI (normalized):', JSON.stringify(normalized, null, 2));
      const formattedTools = normalized.map((fn) => ({ type: 'function', function: fn }));
      console.log('[DEBUG] Formatted tools for OpenAI:', JSON.stringify(formattedTools, null, 2));
      
      try {
        completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: msgs,
          temperature: 0.7,
          max_tokens: 1200,
          tools: formattedTools,
          tool_choice: 'auto',
        });
      } catch (toolError: any) {
        // Handle tool validation errors gracefully
        if (toolError?.error?.param?.includes('tools') || toolError?.message?.includes('tools')) {
          console.warn('[TextMessageHandler] Tool validation failed, falling back to no-tools mode:', toolError.message);
          
          // Retry without tools
          completion = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: msgs,
            temperature: 0.7,
            max_tokens: 1200,
            // No tools parameter - graceful degradation
          });
          
          // Add a note about limited capabilities
          if (completion.choices?.[0]?.message?.content) {
            completion.choices[0].message.content += '\n\n*Note: Some advanced features are temporarily unavailable due to a technical issue.*';
          }
        } else {
          // Re-throw non-tool errors
          throw toolError;
        }
      }
    }

    // Handle tool calls (Act → Observe → Reflect)
    const toolCalls = (completion.choices?.[0]?.message?.tool_calls || []) as any[];
    const discoveredToolsForMetrics = availableTools.map(t => ({ name: t.name }));
    
    // DEBUG: Log tool calls from LLM
    console.log(`[TextMessageHandler] LLM completion tool_calls count: ${toolCalls.length}`);
    if (toolCalls.length > 0) {
      console.log(`[TextMessageHandler] Tool calls:`, JSON.stringify(toolCalls, null, 2));
    } else {
      console.log(`[TextMessageHandler] No tool calls in LLM response. Response: ${completion.choices?.[0]?.message?.content?.substring(0, 200)}`);
    }
    
    // Initialize token counters
    let promptTokens = completion.usage?.prompt_tokens || 0;
    let completionTokens = completion.usage?.completion_tokens || 0;
    
    // Execute tools and handle retries using ToolExecutor
    let toolExecResult = await ToolExecutor.executeToolCalls(
      toolCalls,
      msgs,
      fcm,
      context,
      availableTools,
      this.openai,
      router,
      useRouter,
      this.normalizeTools.bind(this)
    );
    let toolDetails = toolExecResult.toolDetails;
    promptTokens += toolExecResult.tokensUsed.prompt;
    completionTokens += toolExecResult.tokensUsed.completion;
    
    // MCP Protocol: Handle LLM retry loop for interactive errors
    let mcpRetryAttempts = 0;
    const MAX_MCP_RETRIES = 3;
    
    while (toolExecResult.requiresLLMRetry && mcpRetryAttempts < MAX_MCP_RETRIES) {
      mcpRetryAttempts++;
      console.log(`[TextMessageHandler] 🔄 MCP RETRY LOOP - Attempt ${mcpRetryAttempts}/${MAX_MCP_RETRIES}`);
      console.log(`[TextMessageHandler] MCP guidance was added to conversation, calling LLM again`);
      
      // Call LLM again - it will read the MCP guidance and generate new tool calls
      let retryCompletion;
      
      if (router && useRouter && context.agent_id) {
        // Convert tools for router
        const llmTools = availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        
        const retryResp = await router.chat(context.agent_id, msgs as any, { 
          tools: llmTools, 
          temperature: 0.7, // Slightly higher for creativity in parameter generation
          maxTokens: 1200,
          tool_choice: 'auto'
        });
        
        const retryToolCalls = (retryResp.toolCalls || []) as Array<{ id: string; name: string; arguments: string }>;
        retryCompletion = {
          choices: [{ 
            message: { 
              content: retryResp.text, 
              tool_calls: retryToolCalls.map((tc) => ({ 
                id: tc.id, 
                type: 'function', 
                function: { name: tc.name, arguments: tc.arguments } 
              })) 
            } 
          }],
          usage: retryResp.usage ? { 
            prompt_tokens: retryResp.usage.prompt, 
            completion_tokens: retryResp.usage.completion, 
            total_tokens: retryResp.usage.total 
          } : undefined,
        };
        
        if (retryResp.usage) {
          promptTokens += retryResp.usage.prompt;
          completionTokens += retryResp.usage.completion;
        }
      } else {
        const norm = this.normalizeTools(availableTools);
        retryCompletion = await this.openai.chat.completions.create({
          model: effectiveModel,
          messages: msgs,
          tools: norm.map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          })),
          temperature: 0.7, // Slightly higher for creativity in parameter generation
          max_tokens: 1200,
          tool_choice: 'auto'
        });
        
        promptTokens += retryCompletion.usage?.prompt_tokens || 0;
        completionTokens += retryCompletion.usage?.completion_tokens || 0;
      }
      
      const retryToolCalls = retryCompletion.choices?.[0]?.message?.tool_calls || [];
      console.log(`[TextMessageHandler] MCP retry generated ${retryToolCalls.length} tool calls`);
      
      if (retryToolCalls.length === 0) {
        console.log(`[TextMessageHandler] No tool calls in MCP retry, stopping retry loop`);
        break;
      }
      
      // Execute the retry tool calls
      console.log(`[TextMessageHandler] Executing MCP retry tool calls:`, retryToolCalls.map(tc => tc.function?.name).join(', '));
      
      toolExecResult = await ToolExecutor.executeToolCalls(
        retryToolCalls,
        msgs,
        fcm,
        context,
        availableTools,
        this.openai,
        router,
        useRouter,
        this.normalizeTools.bind(this)
      );
      
      // Merge tool details from retry
      toolDetails = [...toolDetails, ...toolExecResult.toolDetails];
      promptTokens += toolExecResult.tokensUsed.prompt;
      completionTokens += toolExecResult.tokensUsed.completion;
      
      // Check if more retries are needed
      if (!toolExecResult.requiresLLMRetry) {
        console.log(`[TextMessageHandler] ✅ MCP retry successful - no more retries needed`);
        break;
      } else {
        console.log(`[TextMessageHandler] MCP retry still requires more attempts`);
      }
    }
    
    if (mcpRetryAttempts >= MAX_MCP_RETRIES && toolExecResult.requiresLLMRetry) {
      console.log(`[TextMessageHandler] ⚠️ Max MCP retry attempts (${MAX_MCP_RETRIES}) reached, some tools may have failed`);
    }
    
    // Tool execution complete - now reflect
    if (toolCalls.length > 0 || mcpRetryAttempts > 0) {
      // Reflect: ask model to produce final answer
      // Add guidance for clean final response
      msgs.push({
        role: 'system',
        content: this.promptBuilder.buildReflectionGuidance()
      } as any);
      
      if (router && useRouter && context.agent_id) {
        const resp2 = await router.chat(context.agent_id, msgs as any, { temperature: 0.5, maxTokens: 1200 });
        completion = {
          choices: [{ message: { content: resp2.text } }],
          usage: resp2.usage ? { prompt_tokens: resp2.usage.prompt, completion_tokens: resp2.usage.completion, total_tokens: resp2.usage.total } : undefined,
        };
      } else {
        completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: msgs,
          temperature: 0.5,
          max_tokens: 1200,
        });
      }
    }

    let text = completion.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    // Post-process the response to ensure proper Markdown formatting
    // This handles cases where the LLM doesn't follow formatting instructions perfectly
    text = this.ensureProperMarkdownFormatting(text);
    const tokensTotal = promptTokens + completionTokens;
    const processed: AdvancedChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      role: 'assistant',
      content: { type: 'text', text },
      timestamp: new Date().toISOString(),
      metadata: { 
        model: effectiveModel, 
        tokens: { prompt: promptTokens, completion: completionTokens, total: tokensTotal }, 
        source: 'api' 
      },
      // Keep original context without reasoning (reasoning is ephemeral for this response only)
      context: {
        ...((message as any).context || {})
      }
    } as any;

    // FEEDBACK LOOP: Persist memories (episodic always; semantic if Pinecone configured)
    try {
      const memOpts = (context.request_options as any)?.memory ?? { enabled: true };
      if (memOpts.enabled && this.memoryManager) {
        const convo: AdvancedChatMessage[] = [message, processed];
        if (this.memoryManager.semanticManager) {
          await this.memoryManager.createFromConversation(convo, true);
        } else {
          await this.memoryManager.episodicManager.createFromConversation(convo, true);
        }
      }
    } catch (_) {
      // best-effort; do not fail response on memory persistence issues
    }

    // BATCH GUARANTEE (gated): Every message gets enqueued for graph storage
    // ONLY if the agent's centralized graph is enabled.
    try {
      // GUARD CLAUSE: Check if graph enabled FIRST before any logging
      let graphEnabled = false;
      try {
        const { data: a } = await (this.supabase as any)
          .from('agents')
          .select('metadata')
          .eq('id', context.agent_id)
          .maybeSingle();
        graphEnabled = ((a?.metadata?.settings || {}).use_account_graph === true);
      } catch (err) {
        // Silent fail - graph disabled
        graphEnabled = false;
      }
      
      // EARLY EXIT: If graph disabled, skip to return statement below
      if (graphEnabled) {
      
      // Only NOW get conversation ID and process
      const convId = context.conversation_id || (message as any).conversation_id;
      
      if (convId && this.memoryManager) {
        console.log(`[TextMessageHandler] ✅ Graph enabled - queueing conversation ${convId} for ingestion`);
        
        // Ingest the current user message and assistant response
        const batchConvo: AdvancedChatMessage[] = [
          message,     // User message
          processed,   // Assistant response
        ] as any;

        await this.memoryManager.createFromConversation(batchConvo, true);
      }
      }
    } catch (ingestionError) {
      console.error('[TextMessageHandler] Graph ingestion error:', ingestionError);
      // best-effort: do not fail the response on batch ingestion errors
    }
    
    return {
      message: processed,
      context,
      metrics: {
        start_time: startTime,
        end_time: Date.now(),
        stages: {},
        tokens_used: tokensTotal,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        model_used: effectiveModel,
        memory_searches: 0,
        tool_executions: toolDetails.length,
        tool_details: toolDetails,
        discovered_tools: discoveredToolsForMetrics,
        tool_requested: toolCalls.length > 0,
      },
    } as any;
  }
}

export class StructuredMessageHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean { return (message as any).content?.type === 'structured'; }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    return {
      message: { ...message, role: 'assistant' } as any,
      context,
      metrics: { start_time: Date.now(), end_time: Date.now(), stages: {}, tokens_used: 0, memory_searches: 0, tool_executions: 0 },
    } as any;
  }
}

export class ToolCallHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean { return (message as any).tools?.length > 0; }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const start = Date.now();
    const toolCalls = ((message as any).tools || []) as any[];
    const details: any[] = [];
    for (const t of toolCalls) {
      const execStart = Date.now();
      try {
        // Placeholder: real execution is routed elsewhere; here we just simulate success
        details.push({
          name: t.function?.name || t.id || 'tool',
          execution_time_ms: 1 + (Date.now() - execStart),
          success: true,
          input_params: t.function?.arguments || {},
          output_result: { executed: true },
        });
      } catch (err: any) {
        details.push({
          name: t.function?.name || t.id || 'tool',
          execution_time_ms: Date.now() - execStart,
          success: false,
          input_params: t.function?.arguments || {},
          output_result: null,
          error: err?.message || 'Unknown error',
        });
      }
    }
    return {
      message: { ...message, role: 'assistant' } as any,
      context,
      metrics: {
        start_time: start,
        end_time: Date.now(),
        stages: {},
        tokens_used: 0,
        memory_searches: 0,
        tool_executions: toolCalls.length,
        tool_details: details,
      },
    } as any;
  }
}


