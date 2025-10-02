/**
 * Retry Coordinator
 * Orchestrates intelligent retry logic for failed tool executions
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';
import { IntelligentRetrySystem, type ToolExecutionContext as RetryContext } from './intelligent-retry-system.ts';
import type { ToolDetail, ToolExecutionContext } from './tool-execution-types.ts';

export class RetryCoordinator {
  private static readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Process all tools that need retry using intelligent retry system
   */
  static async processRetries(
    toolDetails: ToolDetail[],
    fcm: FunctionCallingManager,
    context: ToolExecutionContext,
    openai: any,
    msgs: any[]
  ): Promise<{
    successfulRetries: number;
    failedRetries: number;
    totalAttempts: number;
  }> {
    const toolsNeedingRetry = toolDetails.filter(td => td.requires_retry);
    let retryAttempts = 0;
    let successfulRetries = 0;
    let failedRetries = 0;
    
    console.log(`[RetryCoordinator] 🔍 Checking for tools needing retry: ${toolsNeedingRetry.length} found`);
    if (toolsNeedingRetry.length > 0) {
      console.log(`[RetryCoordinator] 🔄 Tools flagged for retry:`, toolsNeedingRetry.map(t => t.name));
    }
    
    // Process each tool that needs retry using intelligent retry system
    for (const toolDetail of toolsNeedingRetry) {
      if (retryAttempts >= this.MAX_RETRY_ATTEMPTS) {
        console.log(`[RetryCoordinator] Max retry attempts (${this.MAX_RETRY_ATTEMPTS}) reached, stopping`);
        break;
      }

      retryAttempts++;
      console.log(`[RetryCoordinator] 🚀 INTELLIGENT RETRY ${retryAttempts}/${this.MAX_RETRY_ATTEMPTS} for ${toolDetail.name}`);
      
      // Check if this error is retryable
      if (!IntelligentRetrySystem.isRetryableError(toolDetail.name, toolDetail.error || '')) {
        console.log(`[RetryCoordinator] Error for ${toolDetail.name} is not retryable, skipping`);
        failedRetries++;
        continue;
      }

      // Create execution context for intelligent retry
      const executionContext: RetryContext = {
        toolName: toolDetail.name,
        originalParams: toolDetail.input_params || {},
        error: toolDetail.error || '',
        agentId: context.agent_id || '',
        userId: context.user_id || '',
        attempt: retryAttempts,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      };

      try {
        // Execute intelligent retry
        const retryResult = await IntelligentRetrySystem.executeIntelligentRetry(
          executionContext,
          fcm,
          openai
        );

        if (retryResult.success && retryResult.result) {
          console.log(`[RetryCoordinator] ✅ Intelligent retry successful for ${toolDetail.name}`);
          
          // Update the tool detail with successful result
          this.updateToolDetailWithSuccess(toolDetail, retryResult, retryAttempts);
          
          // Add successful tool observation to conversation
          await this.addSuccessMessage(toolDetail, retryResult, retryAttempts, fcm, msgs);
          
          successfulRetries++;

        } else {
          console.log(`[RetryCoordinator] ❌ Intelligent retry failed for ${toolDetail.name}: ${retryResult.error}`);
          
          // Update tool detail with retry failure info
          this.updateToolDetailWithFailure(toolDetail, retryResult, retryAttempts);
          
          // Add failure message to conversation
          this.addFailureMessage(toolDetail, retryResult, msgs);
          
          failedRetries++;
        }

      } catch (retryError: any) {
        console.error(`[RetryCoordinator] Exception during intelligent retry for ${toolDetail.name}:`, retryError);
        
        // Add error message to conversation
        msgs.push({
          role: 'system',
          content: `❌ RETRY ERROR: Failed to process retry for ${toolDetail.name}: ${retryError.message}`
        });
        
        failedRetries++;
      }
    }
    
    // Final summary
    if (successfulRetries > 0) {
      console.log(`[RetryCoordinator] ✅ ${successfulRetries} tools successfully retried`);
    }
    
    if (failedRetries > 0) {
      console.log(`[RetryCoordinator] ❌ ${failedRetries} tools failed retry`);
    }

    return {
      successfulRetries,
      failedRetries,
      totalAttempts: retryAttempts
    };
  }

  /**
   * Update tool detail with successful retry result
   */
  private static updateToolDetailWithSuccess(
    toolDetail: ToolDetail,
    retryResult: any,
    retryAttempts: number
  ): void {
    toolDetail.success = true;
    toolDetail.output_result = retryResult.result.data || retryResult.result;
    toolDetail.error = undefined;
    toolDetail.requires_retry = false;
    toolDetail.input_params = retryResult.finalParams || toolDetail.input_params;
    toolDetail.retry_attempt = retryAttempts;
    toolDetail.retry_method = 'intelligent_transformation';
  }

  /**
   * Update tool detail with failed retry result
   */
  private static updateToolDetailWithFailure(
    toolDetail: ToolDetail,
    retryResult: any,
    retryAttempts: number
  ): void {
    toolDetail.retry_attempt = retryAttempts;
    toolDetail.retry_error = retryResult.error;
    toolDetail.retry_method = 'intelligent_transformation';
  }

  /**
   * Add success message to conversation
   */
  private static async addSuccessMessage(
    toolDetail: ToolDetail,
    retryResult: any,
    retryAttempts: number,
    fcm: FunctionCallingManager,
    msgs: any[]
  ): Promise<void> {
    // Add successful tool observation to conversation
    msgs.push({
      role: 'tool',
      content: await fcm.formatResult(toolDetail.name, retryResult.result),
      tool_call_id: `retry_${toolDetail.name}_${retryAttempts}`,
    });
    
    // Add system message explaining the successful retry
    msgs.push({
      role: 'system',
      content: `✅ RETRY SUCCESS: ${toolDetail.name} was successfully executed after intelligent parameter transformation. The tool is now working correctly.`
    });
  }

  /**
   * Add failure message to conversation
   */
  private static addFailureMessage(
    toolDetail: ToolDetail,
    retryResult: any,
    msgs: any[]
  ): void {
    msgs.push({
      role: 'system',
      content: `❌ RETRY FAILED: ${toolDetail.name} could not be fixed automatically. Error: ${retryResult.error}`
    });
  }
}
