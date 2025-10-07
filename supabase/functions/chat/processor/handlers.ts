import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';
import { FunctionCallingManager } from '../function_calling/manager.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import { PromptBuilder } from './utils/prompt-builder.ts';
import { MarkdownFormatter } from './utils/markdown-formatter.ts';
import { ToolExecutor } from './utils/tool-executor.ts';
import { IntentClassifier } from './utils/intent-classifier.ts';
import { WorkingMemoryManager } from '../core/context/working_memory_manager.ts';

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
  
  /**
   * Detect if LLM response suggests tools would be helpful (false negative detection)
   * This is the fallback mechanism for intent classification
   */
  private detectToolHintInResponse(responseText: string, availableToolNames: string[]): boolean {
    const lowerResponse = responseText.toLowerCase();
    
    // Pattern 1: LLM indicates inability to perform action
    const inabilityPatterns = [
      'i would need to',
      'i can\'t',
      'i cannot',
      'i don\'t have access',
      'i need permission',
      'i require',
      'unable to',
      'not able to',
      'i don\'t have the ability',
      'i would have to',
      'i\'d need to'
    ];
    
    for (const pattern of inabilityPatterns) {
      if (lowerResponse.includes(pattern)) {
        console.log(`[IntentClassifier] Fallback hint detected: "${pattern}"`);
        return true;
      }
    }
    
    // Pattern 2: LLM mentions available tool names
    for (const toolName of availableToolNames) {
      const toolLower = toolName.toLowerCase();
      if (lowerResponse.includes(toolLower)) {
        console.log(`[IntentClassifier] Fallback hint detected: mentions tool "${toolName}"`);
        return true;
      }
    }
    
    return false;
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
    
    // WORKING MEMORY INTEGRATION: Use summaries instead of raw message history
    // This provides intelligent context while saving ~83% of tokens
    const conversationId = context.conversation_id || (message as any).conversation_id;
    
    // Track recent messages for intent classification later
    let recentMessages: Array<{ role: string; content: string }> = [];
    
    if (conversationId && context.agent_id) {
      try {
        const workingMemory = new WorkingMemoryManager(this.supabase as any);
        const memoryContext = await workingMemory.getWorkingContext(
          conversationId,
          context.agent_id,
          false  // Don't include chunks yet - just summary board
        );
        
        if (memoryContext && memoryContext.summary) {
          // Format working memory as assistant message for better LLM comprehension
          const workingMemoryBlock = workingMemory.formatContextForLLM(memoryContext);
          msgs.push({ role: 'assistant', content: workingMemoryBlock });
          
          console.log(`[TextMessageHandler] ✅ Added working memory context (${memoryContext.facts.length} facts, ${memoryContext.metadata.message_count} messages summarized)`);
          console.log(`[TextMessageHandler] 📊 Token savings: ~${memoryContext.metadata.message_count * 100} tokens saved vs raw history`);
          
          // Get recent messages for intent classification (don't add to prompt, summary has it)
          recentMessages = await workingMemory.getRecentMessages(conversationId, 3);
        } else {
          // Fallback: No summary yet, use recent messages (new conversations)
          console.log(`[TextMessageHandler] ℹ️ No summary available, using recent messages`);
          recentMessages = await workingMemory.getRecentMessages(conversationId, 5);
          
          for (const msg of recentMessages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              msgs.push({ 
                role: msg.role as 'user' | 'assistant', 
                content: String(msg.content || '')
              });
            }
          }
        }
      } catch (error) {
        console.error('[TextMessageHandler] Error fetching working memory, falling back to recent messages:', error);
        
        // Fallback: Use recent messages from context if working memory fails
        recentMessages = (message as any)?.context?.recent_messages || [];
        for (const msg of recentMessages.slice(-5)) {  // Limit to last 5 messages
          if (msg.role === 'user' || msg.role === 'assistant') {
            msgs.push({ 
              role: msg.role as 'user' | 'assistant', 
              content: String(msg.content || '')
            });
          }
        }
      }
    } else {
      // No conversation ID - use recent messages from context (workspace chats, etc.)
      recentMessages = (message as any)?.context?.recent_messages || [];
      for (const msg of recentMessages.slice(-5)) {  // Limit to last 5 messages
        if (msg.role === 'user' || msg.role === 'assistant') {
          msgs.push({ 
            role: msg.role as 'user' | 'assistant', 
            content: String(msg.content || '')
          });
        }
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

    // OPTIMIZATION: Classify user intent before loading tools
    // This saves 665-910ms for simple conversations that don't need tools
    const userMessage = (message as any).content?.text || '';
    
    // Prepare recent conversation context for better classification
    // This helps with shorthand references like "Try now" which refer to previous context
    const contextMessages = recentMessages.slice(-3).map((m: any) => ({
      role: m.role,
      content: String(m.content || '')
    }));
    
    const intentClassifier = new IntentClassifier(this.openai);
    const classification = await intentClassifier.classifyIntent(
      userMessage,
      context.agent_id || 'unknown',
      contextMessages // Pass conversation context
    );
    
    console.log(`[IntentClassifier] ${classification.requiresTools ? 'TOOLS NEEDED' : 'NO TOOLS'} (${classification.confidence}, ${classification.classificationTimeMs}ms)`);
    
    // Conditionally load tools only if needed (OPTIMIZATION)
    const authToken = (context as any)?.request_options?.auth?.token || '';
    let availableTools: any[] = [];
    let fcm: FunctionCallingManager | null = null;
    
    if (classification.requiresTools) {
      console.log(`[IntentClassifier] Loading tools...`);
      fcm = new FunctionCallingManager(this.supabase as any, authToken);
      availableTools = (context.agent_id && context.user_id)
        ? await fcm.getAvailableTools(context.agent_id, context.user_id)
        : [];
      console.log(`[IntentClassifier] ✅ Loaded ${availableTools.length} tools`);
    } else {
      console.log(`[IntentClassifier] ⚡ Skipped tool loading (~750ms saved)`);
      // DO NOT create FCM - it's expensive and unnecessary for simple messages
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
        console.log('[TextMessageHandler] Using LLMRouter for agent:', context.agent_id);
        const resolved = await router.resolveAgent(context.agent_id).catch(() => null);
        effectiveModel = resolved?.prefs?.model || effectiveModel;
        console.log('[TextMessageHandler] Resolved model:', effectiveModel);
        // Convert OpenAI format tools to LLMTool format for router
        const llmTools = availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        console.log('[TextMessageHandler] Calling router.chat() with', msgs.length, 'messages and', llmTools.length, 'tools');
        const resp = await router.chat(context.agent_id, msgs as any, { tools: llmTools, temperature: 0.7, maxTokens: 1200 });
        console.log('[TextMessageHandler] ✅ Router response received:', {
          hasText: !!resp.text,
          textLength: resp.text?.length,
          hasToolCalls: !!resp.toolCalls,
          toolCallsCount: resp.toolCalls?.length || 0
        });
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
        console.log('[TextMessageHandler] Calling OpenAI with', msgs.length, 'messages and', formattedTools.length, 'tools');
        completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: msgs,
          temperature: 0.7,
          max_tokens: 1200,
          tools: formattedTools,
          tool_choice: 'auto',
        });
        console.log('[TextMessageHandler] ✅ OpenAI response received:', {
          hasChoices: !!completion.choices,
          choicesLength: completion.choices?.length,
          hasMessage: !!completion.choices?.[0]?.message,
          hasContent: !!completion.choices?.[0]?.message?.content,
          contentLength: completion.choices?.[0]?.message?.content?.length,
          hasToolCalls: !!completion.choices?.[0]?.message?.tool_calls,
          toolCallsCount: completion.choices?.[0]?.message?.tool_calls?.length || 0
        });
      } catch (toolError: any) {
        console.error('[TextMessageHandler] ❌ OpenAI call failed:', toolError.message);
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
    let toolCalls = (completion.choices?.[0]?.message?.tool_calls || []) as any[];
    const discoveredToolsForMetrics = availableTools.map(t => ({ name: t.name }));
    
    // DEBUG: Log tool calls with parameters for debugging LLM parameter extraction issues
    // Force rebuild timestamp: 2025-10-06T19:56:00Z
    if (availableTools.length > 0) {
      console.log(`[TextMessageHandler] LLM completion tool_calls count: ${toolCalls.length}`);
      if (toolCalls.length > 0) {
        // Log each tool call with its parameters for debugging
        toolCalls.forEach((tc: any) => {
          console.log(`[TextMessageHandler] 🔧 INITIAL TOOL CALL: ${tc.function?.name || tc.name}`);
          console.log(`[TextMessageHandler] 📦 PARAMETERS:`, tc.function?.arguments || tc.arguments);
        });
      }
    }
    
    // FALLBACK MECHANISM: DISABLED for now
    // The fallback was too aggressive and loaded tools on every simple message
    // TODO: Implement smarter fallback that doesn't defeat the optimization
    // if (!classification.requiresTools && toolCalls.length === 0 && availableTools.length === 0) {
    //   // Check response for hints that tools would be helpful
    // }
    
    // Initialize token counters
    let promptTokens = completion.usage?.prompt_tokens || 0;
    let completionTokens = completion.usage?.completion_tokens || 0;
    
    // OPTIMIZATION: Only execute tools if there are actual tool calls
    // Skip ToolExecutor entirely for simple messages to save overhead
    let toolExecResult;
    let toolDetails: any[] = [];
    
    if (toolCalls.length > 0) {
      // Execute tools and handle retries using ToolExecutor
      // Safety check: FCM should always exist if we have tool calls
      if (!fcm) {
        throw new Error('[CRITICAL] FunctionCallingManager is null but tool calls exist - this should never happen');
      }
      
      toolExecResult = await ToolExecutor.executeToolCalls(
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
      toolDetails = toolExecResult.toolDetails;
      promptTokens += toolExecResult.tokensUsed.prompt;
      completionTokens += toolExecResult.tokensUsed.completion;
    } else {
      // No tool calls - create minimal result and skip all tool execution overhead
      toolExecResult = {
        toolDetails: [],
        msgs,
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }
    
    // MCP Protocol: Handle LLM retry loop for interactive errors
    // OPTIMIZATION: Only run MCP retry logic if tools were actually executed
    let mcpRetryAttempts = 0;
    const MAX_MCP_RETRIES = 3;
    
    if (toolCalls.length > 0 && toolExecResult.requiresLLMRetry && mcpRetryAttempts < MAX_MCP_RETRIES) {
      console.log(`[TextMessageHandler] 🔍 CHECKING FOR MCP RETRY - requiresLLMRetry: ${toolExecResult.requiresLLMRetry}, retryGuidanceAdded: ${toolExecResult.retryGuidanceAdded}`);
    }
    
    while (toolCalls.length > 0 && toolExecResult.requiresLLMRetry && mcpRetryAttempts < MAX_MCP_RETRIES) {
      mcpRetryAttempts++;
      console.log(`[TextMessageHandler] 🔄 🔄 🔄 MCP RETRY LOOP STARTING - Attempt ${mcpRetryAttempts}/${MAX_MCP_RETRIES}`);
      console.log(`[TextMessageHandler] MCP guidance was added to conversation, calling LLM again`);
      
      // CRITICAL: Clean messages before sending to LLM for retry
      // Responses API requirements:
      // 1. No 'tool_calls' in input messages (only in responses)
      // 2. No 'tool' role messages with call_ids from previous API calls
      //    (function_call_output can only reference call_ids from the SAME request)
      // Solution: Filter out tool result messages entirely - the MCP guidance message
      // contains all the context needed for the LLM to retry with corrected parameters
      const cleanedMsgs = msgs
        .filter(msg => msg.role !== 'tool') // Remove tool results from previous calls
        .map(msg => {
          const cleaned: any = { role: msg.role, content: msg.content };
          // Explicitly exclude tool_calls from input messages
          return cleaned;
        });
      
      // Call LLM again - it will read the MCP guidance and generate new tool calls
      let retryCompletion;
      
      if (router && useRouter && context.agent_id) {
        // Convert tools for router
        const llmTools = availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        
        const retryResp = await router.chat(context.agent_id, cleanedMsgs as any, { 
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
          messages: cleanedMsgs,
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
      
      // DEBUG: Log what parameters the LLM generated for debugging
      if (retryToolCalls.length > 0) {
        retryToolCalls.forEach((tc: any) => {
          console.log(`[TextMessageHandler] 🔧 MCP RETRY TOOL CALL: ${tc.function?.name || tc.name}`);
          console.log(`[TextMessageHandler] 📦 PARAMETERS:`, tc.function?.arguments || tc.arguments);
        });
      }
      
      if (retryToolCalls.length === 0) {
        console.log(`[TextMessageHandler] No tool calls in MCP retry, stopping retry loop`);
        break;
      }
      
      // Execute the retry tool calls
      console.log(`[TextMessageHandler] Executing MCP retry tool calls:`, retryToolCalls.map(tc => tc.function?.name).join(', '));
      
      // Safety check: FCM should always exist if we're in retry loop with tool calls
      if (!fcm) {
        throw new Error('[CRITICAL] FunctionCallingManager is null in MCP retry loop - this should never happen');
      }
      
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
      
      // CRITICAL: Clean messages for Responses API (same as retry logic)
      // Remove tool role messages and tool_calls properties
      const cleanedReflectionMsgs = msgs
        .filter(msg => msg.role !== 'tool') // Remove tool results
        .map(msg => {
          const cleaned: any = { role: msg.role, content: msg.content };
          return cleaned;
        });
      
      if (router && useRouter && context.agent_id) {
        const resp2 = await router.chat(context.agent_id, cleanedReflectionMsgs as any, { temperature: 0.5, maxTokens: 1200 });
        completion = {
          choices: [{ message: { content: resp2.text } }],
          usage: resp2.usage ? { prompt_tokens: resp2.usage.prompt, completion_tokens: resp2.usage.completion, total_tokens: resp2.usage.total } : undefined,
        };
      } else {
        completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: cleanedReflectionMsgs,
          temperature: 0.5,
          max_tokens: 1200,
        });
      }
    }

    // Log completion structure before extracting text
    if (!completion.choices?.[0]?.message?.content) {
      console.error('[TextMessageHandler] ❌ EMPTY RESPONSE from LLM!', {
        hasCompletion: !!completion,
        hasChoices: !!completion.choices,
        choicesLength: completion.choices?.length,
        firstChoice: completion.choices?.[0],
        hasMessage: !!completion.choices?.[0]?.message,
        messageKeys: completion.choices?.[0]?.message ? Object.keys(completion.choices[0].message) : [],
        content: completion.choices?.[0]?.message?.content
      });
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


