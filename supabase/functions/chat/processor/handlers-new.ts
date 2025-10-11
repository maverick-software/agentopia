/**
 * REFACTORED Message Handlers - Clean, modular architecture
 */

import type { AdvancedChatMessage } from '../types/message.types.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';
import { FunctionCallingManager } from '../function_calling/manager.ts';
import { MemoryManager } from '../core/memory/memory_manager.ts';
import { PromptBuilder } from './utils/prompt-builder.ts';
import { MarkdownFormatter } from './utils/markdown-formatter.ts';
import { ToolExecutor } from './utils/tool-executor.ts';
import { IntentClassifier } from './utils/intent-classifier.ts';
import { createLogger } from '../../shared/utils/logger.ts';
import { MessagePreparation } from './handlers/message-preparation.ts';
import { LLMCaller } from './handlers/llm-caller.ts';
import { MCPRetryLoop } from './handlers/mcp-retry-loop.ts';

const logger = createLogger('TextMessageHandler');

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
  private messagePrep: MessagePreparation;

  constructor(private openai: any, private supabase: any, private memoryManager?: MemoryManager | null) {
    this.promptBuilder = new PromptBuilder(supabase);
    this.messagePrep = new MessagePreparation(supabase);
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

    // CRITICAL FIX: Ensure context.agent_id is never an empty string
    if (context.agent_id === '') {
      console.error('[TextMessageHandler] CRITICAL: context.agent_id is empty string, setting to undefined');
      context.agent_id = undefined as any;
    }

    // STEP 1: Prepare messages (system prompt, context, working memory, history)
    const { messages: msgs, recentMessages, summaryInfo } = await this.messagePrep.prepare(message, context);
    console.log(`[TextMessageHandler] ✅ Prepared ${msgs.length} messages`);

    // STEP 2: Intent classification (determine if tools are needed)
    const userText = (message as any).content?.text || (message as any).content || '';
    const classification = await IntentClassifier.classifyIntent(userText, recentMessages, this.openai);
    console.log(`[IntentClassifier] Classification result:`, classification);

    // STEP 3: Conditionally load tools only if needed (OPTIMIZATION)
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
    }

    // STEP 4: Add tool guidance if tools are available
    if (availableTools.length > 0) {
      const toolNames = availableTools.map((t) => t.name).join(', ');
      const guidance = this.promptBuilder.buildToolGuidance(toolNames);
      msgs.push({ role: 'system', content: guidance });

      // Add explicit instruction for action requests
      msgs.push({
        role: 'system',
        content: `CRITICAL: If the user's message is a REQUEST or COMMAND (send, create, search, get, find, etc.), you MUST call the appropriate tool function. DO NOT just respond with text saying you will do it - actually call the function. This is MANDATORY for all action requests.`,
      });
    }

    // STEP 5: Setup LLM router/caller
    const useRouter =
      typeof (globalThis as any).Deno !== 'undefined'
        ? (globalThis as any).Deno.env.get('USE_LLM_ROUTER')?.toLowerCase() === 'true'
        : false;

    let router: any = null;
    let effectiveModel = 'gpt-4';

    if (useRouter && context.agent_id) {
      try {
        const mod = await import('../../shared/llm/router.ts');
        const LLMRouter = (mod as any).LLMRouter;
        router = LLMRouter ? new LLMRouter() : null;
        if (router) {
          const resolved = await router.resolveAgent(context.agent_id).catch(() => null);
          effectiveModel = resolved?.prefs?.model || effectiveModel;
          console.log('[TextMessageHandler] Resolved model:', effectiveModel);
        }
      } catch (_) {
        router = null;
      }
    }

    // Create LLM caller
    const llmCaller = new LLMCaller(this.openai, router, context.agent_id);

    // STEP 6: Initial LLM call
    const normalizedTools = this.normalizeTools(availableTools);
    const llmResult = await llmCaller.call({
      messages: msgs,
      tools: normalizedTools,
      temperature: 0.7,
      maxTokens: 1200,
      userMessage: userText,
    });

    let promptTokens = llmResult.usage?.prompt || 0;
    let completionTokens = llmResult.usage?.completion || 0;

    // STEP 7: Handle tool calls + MCP retry loop
    let toolCalls = llmResult.toolCalls || [];
    let toolDetails: any[] = [];

    if (toolCalls.length > 0 && fcm) {
      console.log(`[TextMessageHandler] Executing ${toolCalls.length} tool calls`);

      // Add assistant message with tool calls
      msgs.push({
        role: 'assistant',
        content: llmResult.text || '',
        tool_calls: toolCalls,
      });

      // Execute tools with intelligent retry
      const toolExecResult = await ToolExecutor.executeToolCalls(
        toolCalls,
        msgs,
        fcm,
        {
          ...context,
          originalUserMessage: userText,
          availableTools: normalizedTools,
        },
        normalizedTools,
        this.openai,
        router,
        useRouter,
        this.normalizeTools.bind(this)
      );

      toolDetails = toolExecResult.toolDetails;
      promptTokens += toolExecResult.tokensUsed.prompt;
      completionTokens += toolExecResult.tokensUsed.completion;

      // MCP Retry Loop if needed
      if (toolExecResult.requiresLLMRetry) {
        console.log(`[TextMessageHandler] 🔄 Entering MCP retry loop`);

        const mcpResult = await MCPRetryLoop.execute({
          initialToolCalls: toolCalls,
          initialToolExecResult: toolExecResult,
          messages: msgs,
          context,
          availableTools: normalizedTools,
          fcm,
          llmCaller,
          openai: this.openai,
          router,
          useRouter,
          normalizeTools: this.normalizeTools.bind(this),
          userMessage: userText,
        });

        toolDetails = mcpResult.toolDetails;
        promptTokens += mcpResult.promptTokens;
        completionTokens += mcpResult.completionTokens;

        console.log(`[TextMessageHandler] ✅ MCP retry completed after ${mcpResult.retryAttempts} attempts`);
      }

      // Get final LLM response after tool execution
      const finalLLMResult = await llmCaller.call({
        messages: msgs,
        tools: normalizedTools,
        temperature: 0.5,
        maxTokens: 1200,
        toolChoice: 'none', // No more tools needed - just synthesis
      });

      promptTokens += finalLLMResult.usage?.prompt || 0;
      completionTokens += finalLLMResult.usage?.completion || 0;

      llmResult.text = finalLLMResult.text || llmResult.text;
    }

    // STEP 8: Finalize response
    if (!llmResult.text) {
      console.error('[TextMessageHandler] ❌ EMPTY RESPONSE from LLM!');
      llmResult.text = 'Sorry, I could not generate a response.';
    }

    let text = this.ensureProperMarkdownFormatting(llmResult.text);

    // Extract artifacts from tool execution results
    const artifacts = toolDetails
      .filter((td: any) => td.artifact)
      .map((td: any) => ({
        name: td.name,
        artifact: td.artifact,
        execution_time_ms: td.execution_time_ms,
      }));

    // Build metrics
    const endTime = Date.now();
    const metrics: ProcessingMetrics = {
      start_time: startTime,
      end_time: endTime,
      tokens_used: promptTokens + completionTokens,
      memory_searches: summaryInfo ? 1 : 0,
      tool_executions: toolDetails.length,
      stages: {
        message_prep: 100, // Estimate
        intent_classification: classification.confidence || 0,
        tool_loading: availableTools.length > 0 ? 750 : 0,
        llm_calls: endTime - startTime,
      },
      working_memory_summary: summaryInfo,
      discovered_tools: availableTools.map((t) => ({ name: t.name })),
    };

    // Return final response
    return {
      message: {
        role: 'assistant',
        content: { type: 'text', text },
        conversation_id: context.conversation_id,
        agent_id: context.agent_id,
        user_id: context.user_id,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        tool_details: toolDetails.length > 0 ? toolDetails : undefined,
      } as any,
      context,
      metrics,
    };
  }
}

export class StructuredMessageHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).content?.type === 'structured';
  }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    return {
      message: { ...message, role: 'assistant' } as any,
      context,
      metrics: { start_time: Date.now(), end_time: Date.now(), stages: {}, tokens_used: 0, memory_searches: 0, tool_executions: 0 },
    } as any;
  }
}

export class ToolCallHandler implements MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean {
    return (message as any).tools?.length > 0;
  }
  async handle(message: AdvancedChatMessage, context: ProcessingContext) {
    const start = Date.now();
    const toolCalls = ((message as any).tools || []) as any[];
    const details: any[] = [];
    for (const t of toolCalls) {
      const execStart = Date.now();
      try {
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
      message: { ...message, role: 'assistant', tool_details: details } as any,
      context,
      metrics: {
        start_time: start,
        end_time: Date.now(),
        tokens_used: 0,
        memory_searches: 0,
        tool_executions: details.length,
        stages: {},
      },
    } as any;
  }
}

