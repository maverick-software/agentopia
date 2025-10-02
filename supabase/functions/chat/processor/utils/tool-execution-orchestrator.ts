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
    console.log(`[ToolExecutionOrchestrator] 🚀 STARTING executeToolCalls with ${toolCalls.length} tool calls`);
    console.log(`[ToolExecutionOrchestrator] Tool calls:`, toolCalls.map(tc => tc.function?.name).join(', '));
    
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

    // Execute all tool calls
    console.log(`[ToolExecutionOrchestrator] Executing ${toolCalls.length} tool calls`);
    const toolDetails = await BasicToolExecutor.executeToolCalls(toolCalls, fcm, context);

    // Add tool results to conversation
    await ConversationHandler.addToolResults(msgs, toolDetails, toolCalls, fcm);

    // Process intelligent retries for failed tools
    console.log(`[ToolExecutionOrchestrator] Processing retries for failed tools`);
    const retryStats = await RetryCoordinator.processRetries(
      toolDetails,
      fcm,
      context,
      environment.openai,
      msgs
    );

    // Add retry summary to conversation
    ConversationHandler.addRetrySummary(
      msgs,
      retryStats.successfulRetries,
      retryStats.failedRetries,
      retryStats.totalAttempts
    );

    // Log final execution summary
    this.logExecutionSummary(toolDetails, retryStats);

    return {
      toolDetails,
      msgs,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens
      }
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
    
    console.log(`[ToolExecutionOrchestrator] 📊 EXECUTION SUMMARY:`);
    console.log(`[ToolExecutionOrchestrator] Total tools: ${totalTools}`);
    console.log(`[ToolExecutionOrchestrator] Successful: ${successfulTools}`);
    console.log(`[ToolExecutionOrchestrator] Failed: ${failedTools}`);
    console.log(`[ToolExecutionOrchestrator] Retry attempts: ${retryStats.totalAttempts}`);
    console.log(`[ToolExecutionOrchestrator] Successful retries: ${retryStats.successfulRetries}`);
    console.log(`[ToolExecutionOrchestrator] Failed retries: ${retryStats.failedRetries}`);
    
    if (failedTools > 0) {
      const failedToolNames = toolDetails.filter(td => !td.success).map(td => td.name);
      console.log(`[ToolExecutionOrchestrator] Failed tools: ${failedToolNames.join(', ')}`);
    }
  }
}
