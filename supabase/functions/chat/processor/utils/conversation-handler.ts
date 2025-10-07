/**
 * Conversation Message Handler
 * Handles adding tool calls and results to conversation messages
 * Updated: Oct 6, 2025 - Enhanced logging for tool result delivery
 */

import type { ToolCall, ToolDetail } from './tool-execution-types.ts';

export class ConversationHandler {
  /**
   * Add assistant message with tool calls to conversation
   */
  static addAssistantToolCallMessage(
    msgs: any[],
    toolCalls: ToolCall[]
  ): void {
    // Per OpenAI protocol, include the assistant message containing tool_calls before tool messages
    const typedToolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = toolCalls as any;

    msgs.push({
      role: 'assistant',
      content: '',
      tool_calls: typedToolCalls.map((tc) => ({
        id: tc.id, 
        type: 'function', 
        function: { name: tc.function.name, arguments: tc.function.arguments } 
      })),
    });
  }

  /**
   * Add tool execution results to conversation
   */
  static async addToolResults(
    msgs: any[],
    toolDetails: ToolDetail[],
    toolCalls: ToolCall[],
    fcm: any
  ): Promise<void> {
    console.log(`[ConversationHandler] 🚀 addToolResults called with ${toolDetails.length} tool details, ${toolCalls.length} tool calls`);
    console.log(`[ConversationHandler] Current msgs length: ${msgs.length}`);
    
    for (let i = 0; i < toolDetails.length && i < toolCalls.length; i++) {
      const detail = toolDetails[i];
      const toolCall = toolCalls[i];
      
      // Create a result object for formatting
      const result = {
        success: detail.success,
        data: detail.output_result,
        error: detail.error
      };
      
      try {
        const formattedContent = await fcm.formatResult(detail.name, result);
        
        console.log(`[ConversationHandler] 📨 Adding tool result for ${detail.name} to msgs array`);
        console.log(`[ConversationHandler] Formatted content length: ${formattedContent.length} chars`);
        console.log(`[ConversationHandler] Content preview:`, formattedContent.substring(0, 150));
        console.log(`[ConversationHandler] tool_call_id:`, toolCall.id);
        
        msgs.push({
          role: 'tool',
          content: formattedContent,
          tool_call_id: toolCall.id,
        });
        
        console.log(`[ConversationHandler] ✅ Tool result added. Total msgs: ${msgs.length}`);
      } catch (formatError: any) {
        console.error(`[ConversationHandler] Error formatting result for ${detail.name}:`, formatError);
        
        // Fallback to basic formatting
        const fallbackContent = detail.success 
          ? `Tool ${detail.name} executed successfully: ${JSON.stringify(detail.output_result)}`
          : `Tool ${detail.name} failed: ${detail.error}`;
          
        msgs.push({
          role: 'tool',
          content: fallbackContent,
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  /**
   * Add error message for failed tool execution
   */
  static addToolErrorMessage(
    msgs: any[],
    toolName: string,
    error: string,
    toolCallId: string
  ): void {
    msgs.push({
      role: 'tool',
      content: `Tool ${toolName} failed: ${error}`,
      tool_call_id: toolCallId,
    });
  }

  /**
   * Add system message to conversation
   */
  static addSystemMessage(
    msgs: any[],
    content: string
  ): void {
    msgs.push({
      role: 'system',
      content: content
    });
  }

  /**
   * Add retry summary message
   */
  static addRetrySummary(
    msgs: any[],
    successfulRetries: number,
    failedRetries: number,
    totalAttempts: number
  ): void {
    if (successfulRetries > 0 || failedRetries > 0) {
      const summary = `🔄 RETRY SUMMARY: ${successfulRetries} successful, ${failedRetries} failed (${totalAttempts} total attempts)`;
      this.addSystemMessage(msgs, summary);
    }
  }
}
