/**
 * Tool Execution Utilities
 * Handles tool calling, retry logic, and result formatting
 */

import type { FunctionCallingManager } from '../../function_calling/manager.ts';

export interface ToolExecutionResult {
  toolDetails: any[];
  msgs: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }>;
  tokensUsed: { prompt: number; completion: number; total: number };
}

export class ToolExecutor {
  /**
   * Execute all tool calls from completion and handle MCP retry pattern
   */
  static async executeToolCalls(
    toolCalls: any[],
    msgs: any[],
    fcm: FunctionCallingManager,
    context: { agent_id?: string; user_id?: string },
    availableTools: any[],
    openai: any,
    router: any,
    useRouter: boolean,
    normalizeToolsFn: (tools: any[]) => any[]
  ): Promise<ToolExecutionResult> {
    const toolDetails: any[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    
    if (toolCalls.length === 0) {
      return {
        toolDetails: [],
        msgs,
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }

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
    } as any);

    // Execute each tool
    for (const tc of typedToolCalls) {
      const started = Date.now();
      try {
        const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        const result = await fcm.executeFunction(context.agent_id || '', context.user_id || '', tc.function.name, args);
        
        // Check if this is an MCP tool that returned a clarifying question
        const isMCPQuestion = !result.success && 
          result.error && 
          (result.error.toLowerCase().includes('question:') || 
           result.error.toLowerCase().includes('what') ||
           result.error.toLowerCase().includes('please provide') ||
           result.error.toLowerCase().includes('missing'));
        
        toolDetails.push({
          name: tc.function.name,
          execution_time_ms: Date.now() - started,
          success: !!result.success,
          input_params: args,
          output_result: result.data || null,
          error: result.success ? undefined : result.error,
          requires_retry: isMCPQuestion
        });
        
        // Append tool observation
        msgs.push({
          role: 'tool',
          content: await fcm.formatResult(tc.function.name, result),
          tool_call_id: tc.id,
        } as any);
      } catch (err: any) {
        toolDetails.push({
          name: tc.function?.name,
          execution_time_ms: Date.now() - started,
          success: false,
          input_params: {},
          output_result: null,
          error: err?.message || 'Tool execution error',
        });
        msgs.push({
          role: 'tool',
          content: `Tool ${tc.function?.name} failed: ${err?.message || 'Unknown error'}`,
          tool_call_id: tc.id,
        } as any);
      }
    }

    // Handle MCP retry pattern
    const toolsNeedingRetry = toolDetails.filter(td => td.requires_retry);
    let retryAttempts = 0;
    const MAX_RETRY_ATTEMPTS = 3;
    
    while (toolsNeedingRetry.length > 0 && retryAttempts < MAX_RETRY_ATTEMPTS) {
      retryAttempts++;
      console.log(`[ToolExecutor] Retrying ${toolsNeedingRetry.length} MCP tools (attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})`);
      
      // Add a system message to guide the retry
      msgs.push({
        role: 'system',
        content: `The previous tool call(s) need additional information. Please retry with the missing parameters based on the error messages. For document creation, include a 'text' or 'content' parameter with the document body.`
      } as any);
      
      // Get the model to retry with additional parameters
      let retryCompletion;
      if (router && useRouter && context.agent_id) {
        // Convert OpenAI format tools to LLMTool format for router
        const norm = normalizeToolsFn(availableTools);
        const llmToolsRetry = norm.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));
        const retryResp = await router.chat(context.agent_id, msgs as any, { 
          tools: llmToolsRetry, 
          tool_choice: 'auto',
          temperature: 0.7, 
          maxTokens: 1200 
        });
        retryCompletion = {
          choices: [{ message: retryResp }],
          usage: retryResp.usage ? { 
            prompt_tokens: retryResp.usage.prompt, 
            completion_tokens: retryResp.usage.completion, 
            total_tokens: retryResp.usage.total 
          } : undefined,
        };
        
        if (retryResp.usage) {
          promptTokens += retryResp.usage.prompt || 0;
          completionTokens += retryResp.usage.completion || 0;
        }
      } else {
        const norm = normalizeToolsFn(availableTools);
        retryCompletion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: msgs as any,
          tools: norm.map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          })),
          tool_choice: 'auto',
        });
        
        if (retryCompletion.usage) {
          promptTokens += retryCompletion.usage.prompt_tokens || 0;
          completionTokens += retryCompletion.usage.completion_tokens || 0;
        }
      }
      
      // Process retry tool calls
      const retryToolCalls = (retryCompletion.choices?.[0]?.message?.tool_calls || []) as any[];
      
      if (retryToolCalls.length > 0) {
        // Clear the tools needing retry list
        toolsNeedingRetry.length = 0;
        
        // Add assistant message with new tool calls
        msgs.push({
          role: 'assistant',
          content: '',
          tool_calls: retryToolCalls.map((tc: any) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments }
          })),
        } as any);
        
        // Execute retry tool calls
        for (const tc of retryToolCalls) {
          const started = Date.now();
          try {
            const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
            const result = await fcm.executeFunction(context.agent_id || '', context.user_id || '', tc.function.name, args);
            
            // Check if still needs retry
            const stillNeedsRetry = !result.success && 
              result.error && 
              (result.error.toLowerCase().includes('question:') || 
               result.error.toLowerCase().includes('what') ||
               result.error.toLowerCase().includes('please provide') ||
               result.error.toLowerCase().includes('missing'));
            
            toolDetails.push({
              name: tc.function.name,
              execution_time_ms: Date.now() - started,
              success: !!result.success,
              input_params: args,
              output_result: result.data || null,
              error: result.success ? undefined : result.error,
              requires_retry: stillNeedsRetry
            });
            
            // Append tool observation
            msgs.push({
              role: 'tool',
              content: await fcm.formatResult(tc.function.name, result),
              tool_call_id: tc.id,
            } as any);
            
            // Add to retry list if still needs retry
            if (stillNeedsRetry) {
              toolsNeedingRetry.push(toolDetails[toolDetails.length - 1]);
            }
          } catch (err: any) {
            toolDetails.push({
              name: tc.function?.name,
              execution_time_ms: Date.now() - started,
              success: false,
              input_params: {},
              output_result: null,
              error: err?.message || 'Tool execution error',
            });
            msgs.push({
              role: 'tool',
              content: `Tool ${tc.function?.name} failed: ${err?.message || 'Unknown error'}`,
              tool_call_id: tc.id,
            } as any);
          }
        }
      } else {
        // No retry tool calls generated, stop retrying
        break;
      }
    }

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
}

