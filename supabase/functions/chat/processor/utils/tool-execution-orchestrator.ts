/**
 * Tool Execution Orchestrator
 * Main coordinator for tool execution with intelligent retry system
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';
import type { 
  ToolExecutionResult, 
  ToolCall, 
  ToolExecutionContext, 
  ExecutionEnvironment,
  TokenUsage 
} from './tool-execution-types.ts';
import { BasicToolExecutor } from './basic-tool-executor.ts';
import { RetryCoordinator } from './retry-coordinator.ts';
import { ConversationHandler } from './conversation-handler.ts';
import { createLogger } from '../../../shared/utils/logger.ts';
import { AgentRuntimeEventBus } from '../../agent_runtime/event-bus.ts';
import { classifyRisk, requestApprovalIfNeeded } from '../../agent_runtime/approval-gate.ts';
import type { RuntimeContext } from '../../agent_runtime/types.ts';

const logger = createLogger('ToolExecutionOrchestrator');

export class ToolExecutionOrchestrator {
  /**
   * Execute all tool calls with intelligent retry handling
   */
  static async executeToolCalls(
    toolCalls: any[],
    msgs: any[],
    fcm: FunctionCallingManager,
    context: ToolExecutionContext,
    environment: ExecutionEnvironment
  ): Promise<ToolExecutionResult> {
    // Single consolidated log for tool execution start
    const toolNames = toolCalls.map(tc => tc.function?.name || tc.name).join(', ');
    logger.info(`🚀 Executing ${toolCalls.length} tool(s): ${toolNames}`);
    
    let promptTokens = 0;
    let completionTokens = 0;
    
    if (toolCalls.length === 0) {
      console.log(`[ToolExecutionOrchestrator] No tool calls to execute, returning empty result`);
      return {
        toolDetails: [],
        msgs,
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }

    // Add assistant message with tool calls to conversation
    ConversationHandler.addAssistantToolCallMessage(msgs, toolCalls);

    const supabase = typeof (fcm as any).getSupabaseClient === 'function'
      ? (fcm as any).getSupabaseClient()
      : null;
    const runtimeContext: RuntimeContext = {
      requestId: crypto.randomUUID(),
      agentId: context.agent_id,
      userId: context.user_id,
      conversationId: context.conversation_id,
      sessionId: context.session_id,
      workspaceId: context.workspace_id,
    };
    const eventBus = supabase ? new AgentRuntimeEventBus(supabase, runtimeContext) : null;

    const toolDetails: any[] = [];
    for (const toolCall of toolCalls) {
      const risk = classifyRisk(toolCall);
      await eventBus?.emit({
        stream: 'tool',
        eventType: 'start',
        payload: { tool: toolCall.function?.name || toolCall.name, risk },
      });

      const approval = supabase
        ? await requestApprovalIfNeeded(supabase, runtimeContext, undefined, toolCall)
        : { proceed: true, status: 'approved' as const, reason: risk.reason };

      if (!approval.proceed) {
        toolDetails.push({
          name: toolCall.function?.name || toolCall.name,
          execution_time_ms: 0,
          success: false,
          input_params: toolCall.function?.arguments || {},
          output_result: null,
          error: approval.status === 'pending'
            ? 'Tool execution is waiting for user approval.'
            : approval.reason,
          requires_user_input: approval.status === 'pending',
          user_input_request: approval.status === 'pending'
            ? {
                approval_id: approval.approvalId,
                tool_name: toolCall.function?.name || toolCall.name,
                reason: approval.reason,
                required_fields: [
                  {
                    name: 'decision',
                    label: 'Approve this tool call?',
                    type: 'select',
                    options: ['approved', 'denied'],
                    required: true,
                  },
                ],
              }
            : undefined,
          runtime: {
            risk_level: risk.level,
            approval_id: approval.approvalId,
          },
        });
        await eventBus?.emit({
          stream: 'approval',
          eventType: approval.status === 'pending' ? 'requested' : 'blocked',
          payload: {
            tool: toolCall.function?.name || toolCall.name,
            approvalId: approval.approvalId,
            reason: approval.reason,
          },
        });
        continue;
      }

      const detail = await BasicToolExecutor.executeSingleTool(toolCall, fcm, context);
      toolDetails.push(detail);
      await eventBus?.emit({
        stream: 'tool',
        eventType: 'end',
        payload: {
          tool: detail.name,
          success: detail.success,
          executionTimeMs: detail.execution_time_ms,
          error: detail.error,
        },
      });
    }

    // Add tool results to conversation
    await ConversationHandler.addToolResults(msgs, toolDetails, toolCalls, fcm);

    // OPTIMIZATION: Skip retry processing if all tools succeeded
    const failedTools = toolDetails.filter(td => !td.success);
    let retryStats = { totalAttempts: 0, successfulRetries: 0, failedRetries: 0, requiresLLMRetry: false };
    
    if (failedTools.length > 0) {
      // Process intelligent retries only for failed tools
      logger.debug(`Processing retries for ${failedTools.length} failed tool(s)`);
      retryStats = await RetryCoordinator.processRetries(
        toolDetails,
        fcm,
        context,
        environment.openai,
        msgs
      );
    } else {
      logger.debug(`All tools succeeded, skipping retry checks`);
    }

    // Add retry summary to conversation (only if not requiring LLM retry)
    if (!retryStats.requiresLLMRetry) {
      ConversationHandler.addRetrySummary(
        msgs,
        retryStats.successfulRetries,
        retryStats.failedRetries,
        retryStats.totalAttempts
      );
    }

    // Log final execution summary
    this.logExecutionSummary(toolDetails, retryStats);

    return {
      toolDetails,
      msgs,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens
      },
      requiresLLMRetry: retryStats.requiresLLMRetry,
      retryGuidanceAdded: retryStats.retryGuidanceAdded
    };
  }

  /**
   * Log execution summary
   */
  private static logExecutionSummary(
    toolDetails: any[],
    retryStats: { successfulRetries: number; failedRetries: number; totalAttempts: number }
  ): void {
    const totalTools = toolDetails.length;
    const successfulTools = toolDetails.filter(td => td.success).length;
    const failedTools = totalTools - successfulTools;
    
    // Consolidated execution summary (single log)
    logger.info(`📊 Summary: ${successfulTools}/${totalTools} succeeded, ${failedTools} failed, ${retryStats.totalAttempts} retries`);
    
    if (failedTools > 0) {
      const failedToolNames = toolDetails.filter(td => !td.success).map(td => td.name);
      console.log(`[ToolExecutionOrchestrator] Failed tools: ${failedToolNames.join(', ')}`);
    }
  }
}
