/**
 * Function Calling Integration for Chat System
 * Converts MCP tools to OpenAI function calling format
 * Handles tool execution and response formatting
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';

// Import the tool registry and types
export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIFunctionResponse {
  tool_call_id: string;
  content: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_scopes: string[];
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    quota_consumed?: number;
    execution_time_ms?: number;
  };
}

/**
 * Gmail MCP Tools Registry (imported from frontend)
 */
export const GMAIL_MCP_TOOLS: Record<string, MCPTool> = {
  send_email: {
    name: 'send_email',
    description: 'Send an email through Gmail. THIS TOOL IS CALLED "send_email" - USE EXACTLY "send_email" AS THE FUNCTION NAME. DO NOT USE "gmail_send_message" OR ANY OTHER NAME. The function name must be exactly "send_email" with no prefix or suffix.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text)',
        },
        html: {
          type: 'string',
          description: 'Email body content (HTML format)',
        },
        attachments: {
          type: 'array',
          description: 'Email attachments',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded content' },
              contentType: { type: 'string' },
            },
          },
        },
      },
      required: ['to', 'subject', 'body'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.send'],
  },

  read_emails: {
    name: 'read_emails',
    description: 'When a user asks to read their emails, use this tool. You can read their emails from their Gmail inbox.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "is:unread", "from:example@gmail.com")',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of emails to return (default: 50)',
          default: 50,
          minimum: 1,
          maximum: 500,
        },
        include_body: {
          type: 'boolean',
          description: 'Whether to include email body content',
          default: false,
        },
      },
      required: [],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },

  search_emails: {
    name: 'search_emails',
    description: 'When a user asks to search their emails, use this tool. You can search for specific emails in their Gmail account.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Advanced Gmail search query (e.g., "from:example@gmail.com has:attachment")',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of search results (default: 100)',
          default: 100,
          minimum: 1,
          maximum: 500,
        },
        date_range: {
          type: 'object',
          description: 'Date range filter',
          properties: {
            after: { type: 'string', description: 'Search after this date (YYYY-MM-DD)' },
            before: { type: 'string', description: 'Search before this date (YYYY-MM-DD)' },
          },
        },
      },
      required: ['query'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },

  email_actions: {
    name: 'email_actions',
    description: 'When a user wants to perform actions on their emails (like marking as read, archiving, or deleting), use this tool.',
    parameters: {
      type: 'object',
      properties: {
        message_ids: {
          type: 'array',
          description: 'Array of Gmail message IDs to act upon',
          items: { type: 'string' },
        },
        action: {
          type: 'string',
          enum: ['mark_read', 'mark_unread', 'archive', 'unarchive', 'delete', 'star', 'unstar'],
          description: 'Action to perform on the messages',
        },
      },
      required: ['message_ids', 'action'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  },
};

/**
 * Web Search MCP Tools Registry
 */
export const WEB_SEARCH_MCP_TOOLS: Record<string, MCPTool> = {
  web_search: {
    name: 'web_search',
    description: 'Search the web for current information, news, and content. Use this when you need up-to-date information that might not be in your training data.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        num_results: {
          type: 'integer',
          description: 'Number of results to return (1-10)',
          minimum: 1,
          maximum: 10,
          default: 5,
        },
        location: {
          type: 'string',
          description: 'Geographic location for localized results (e.g., "New York, NY", "London, UK")',
        },
        time_range: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year', 'all'],
          description: 'Time range for results',
          default: 'all',
        },
      },
      required: ['query'],
    },
    required_scopes: ['web_search'],
  },

  scrape_and_summarize: {
    name: 'scrape_and_summarize',
    description: 'Scrape content from web pages and provide a summarized version. Use this when you need detailed information from specific websites.',
    parameters: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs to scrape and summarize',
          maxItems: 5,
        },
        summary_length: {
          type: 'string',
          enum: ['short', 'medium', 'long'],
          description: 'Length of summary',
          default: 'medium',
        },
        focus_keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords to focus on in the summary',
        },
      },
      required: ['urls'],
    },
    required_scopes: ['web_search'],
  },

  news_search: {
    name: 'news_search',
    description: 'Search for recent news articles and current events. Use this for up-to-date news and breaking stories.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'News search query',
        },
        num_results: {
          type: 'integer',
          description: 'Number of news results (1-10)',
          minimum: 1,
          maximum: 10,
          default: 5,
        },
        time_range: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month'],
          description: 'Time range for news results',
          default: 'week',
        },
        location: {
          type: 'string',
          description: 'Geographic location for local news',
        },
      },
      required: ['query'],
    },
    required_scopes: ['web_search', 'news_search'],
  },
};

/**
 * Function Calling Manager
 */
export class FunctionCallingManager {
  constructor(
    private supabaseClient: SupabaseClient,
    private authToken: string = ''
  ) {}

  /**
   * Get available tools for an agent in OpenAI function calling format
   */
  async getAvailableTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      console.log(`[FunctionCalling] Getting available tools for agent ${agentId}, user ${userId}`);
      
      // Get Gmail tools if agent has Gmail permissions
      const gmailTools = await this.getGmailTools(agentId, userId);
      
      // Get Web Search tools if agent has web search permissions
      const webSearchTools = await this.getWebSearchTools(agentId, userId);
      
      // Future: Add other tool providers here
      // const slackTools = await this.getSlackTools(agentId, userId);
      
      const allTools = [...gmailTools, ...webSearchTools];
      
      console.log(`[FunctionCalling] Found ${allTools.length} available tools`);
      return allTools;
    } catch (error) {
      console.error('[FunctionCalling] Error getting available tools:', error);
      return [];
    }
  }

  /**
   * Get Gmail tools for an agent
   */
  private async getGmailTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      // Check if agent has Gmail permissions
      const { data: permissions } = await this.supabaseClient
        .from('agent_oauth_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_oauth_connections!inner(
            oauth_provider_id,
            oauth_providers!inner(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_oauth_connections.user_id', userId)
        .eq('user_oauth_connections.oauth_providers.name', 'gmail')
        .eq('is_active', true)
        .single();

      if (!permissions) {
        console.log(`[FunctionCalling] No Gmail permissions found for agent ${agentId}`);
        return [];
      }

      const grantedScopes = permissions.allowed_scopes || [];
      console.log(`[FunctionCalling] Agent ${agentId} has Gmail scopes:`, grantedScopes);
      console.log(`[FunctionCalling] Available Gmail tool definitions:`, Object.keys(GMAIL_MCP_TOOLS));
      
      // Filter tools based on granted scopes
      const availableTools: OpenAIFunction[] = [];
      
      for (const [toolName, tool] of Object.entries(GMAIL_MCP_TOOLS)) {
        const hasRequiredScopes = tool.required_scopes.every(scope => {
          // Check if the granted scopes include the required scope
          // Handle both full URLs and short names
          return grantedScopes.includes(scope) || 
                 grantedScopes.some((grantedScope: string) => {
                   // Check if granted scope ends with the required scope
                   return grantedScope.endsWith(scope) || 
                          scope.endsWith(grantedScope);
                 });
        });
        
        if (hasRequiredScopes) {
          console.log(`[FunctionCalling] Adding tool ${toolName} (has required scopes)`);
          availableTools.push({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          });
        } else {
          console.log(`[FunctionCalling] Skipping tool ${toolName} (missing required scopes: ${tool.required_scopes.join(', ')})`);
        }
      }

      console.log(`[FunctionCalling] Available Gmail tools for agent ${agentId}:`, availableTools.map(t => t.name));
      return availableTools;
    } catch (error) {
      console.error('[FunctionCalling] Error getting Gmail tools:', error);
      return [];
    }
  }

  /**
   * Get Web Search tools for an agent
   */
  private async getWebSearchTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      // Check if user has web search API keys configured
      const { data: hasPermissions } = await this.supabaseClient
        .rpc('validate_web_search_permissions', {
          p_agent_id: agentId,
          p_user_id: userId,
        });

      if (!hasPermissions) {
        console.log(`[FunctionCalling] No web search permissions found for agent ${agentId}`);
        return [];
      }

      console.log(`[FunctionCalling] Agent ${agentId} has web search permissions`);
      console.log(`[FunctionCalling] Available web search tool definitions:`, Object.keys(WEB_SEARCH_MCP_TOOLS));
      
      // All web search tools are available if user has API keys configured
      const availableTools: OpenAIFunction[] = Object.values(WEB_SEARCH_MCP_TOOLS).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));

      console.log(`[FunctionCalling] Available web search tools for agent ${agentId}:`, availableTools.map(t => t.name));
      return availableTools;
    } catch (error) {
      console.error('[FunctionCalling] Error getting web search tools:', error);
      return [];
    }
  }

  /**
   * Execute a function call
   */
  async executeFunction(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[FunctionCalling] Executing function ${functionName} for agent ${agentId}`);
      
      // Route to appropriate tool provider
      if (Object.keys(GMAIL_MCP_TOOLS).includes(functionName)) {
        return await this.executeGmailTool(agentId, userId, functionName, parameters);
      }
      
      if (Object.keys(WEB_SEARCH_MCP_TOOLS).includes(functionName)) {
        return await this.executeWebSearchTool(agentId, userId, functionName, parameters);
      }
      
      // Future: Add other providers
      // if (SLACK_TOOLS.includes(functionName)) {
      //   return await this.executeSlackTool(agentId, userId, functionName, parameters);
      // }
      
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
        metadata: {
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error(`[FunctionCalling] Error executing function ${functionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          execution_time_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute Gmail tool
   */
  private async executeGmailTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate permissions
      const hasPermission = await this.validateGmailPermissions(agentId, userId, toolName);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Agent does not have required Gmail permissions for this operation',
          metadata: {
            execution_time_ms: Date.now() - startTime,
          },
        };
      }

      // Call Gmail API via Supabase Edge Function with auth token
      const { data, error } = await this.supabaseClient.functions.invoke('gmail-api', {
        body: {
          action: toolName,
          agent_id: agentId,
          params: parameters,  // Changed from 'parameters' to 'params'
        },
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Check if the response indicates an error
      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      // Log the operation
      await this.logGmailOperation(agentId, userId, toolName, parameters, data, 'success', Date.now() - startTime);

      return {
        success: true,
        data: data,
        metadata: {
          quota_consumed: this.getQuotaConsumption(toolName),
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      // Log the error
      await this.logGmailOperation(
        agentId,
        userId,
        toolName,
        parameters,
        null,
        'error',
        Date.now() - startTime,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          execution_time_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute Web Search tool
   */
  private async executeWebSearchTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      // Validate permissions
      const hasPermission = await this.validateWebSearchPermissions(agentId, userId);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Agent does not have required web search permissions for this operation',
          metadata: {
            execution_time_ms: Date.now() - startTime,
          },
        };
      }

      // Call Web Search API via Supabase Edge Function with auth token
      const { data, error } = await this.supabaseClient.functions.invoke('web-search-api', {
        body: {
          action: toolName,
          agent_id: agentId,
          parameters: parameters,
        },
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Check if the response indicates an error
      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      return {
        success: true,
        data: data?.data || data,
        metadata: {
          quota_consumed: data?.metadata?.quota_consumed || 1,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          execution_time_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Validate web search permissions for an agent
   */
  private async validateWebSearchPermissions(agentId: string, userId: string): Promise<boolean> {
    try {
      const { data: isValid } = await this.supabaseClient
        .rpc('validate_web_search_permissions', {
          p_agent_id: agentId,
          p_user_id: userId,
        });

      return isValid || false;
    } catch (error) {
      console.error('[FunctionCalling] Error validating web search permissions:', error);
      return false;
    }
  }

  /**
   * Validate Gmail permissions for a tool
   */
  private async validateGmailPermissions(agentId: string, userId: string, toolName: string): Promise<boolean> {
    const toolDefinition = GMAIL_MCP_TOOLS[toolName];
    if (!toolDefinition) {
      return false;
    }

    try {
      const { data: isValid } = await this.supabaseClient
        .rpc('validate_agent_gmail_permissions', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_required_scopes: toolDefinition.required_scopes,
        });

      return isValid || false;
    } catch (error) {
      console.error('[FunctionCalling] Error validating Gmail permissions:', error);
      return false;
    }
  }

  /**
   * Log Gmail operation
   */
  private async logGmailOperation(
    agentId: string,
    userId: string,
    operationType: string,
    parameters: Record<string, any>,
    result: any,
    status: string,
    executionTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabaseClient.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: operationType,
        p_operation_params: parameters,
        p_operation_result: result,
        p_status: status,
        p_quota_consumed: this.getQuotaConsumption(operationType),
        p_execution_time_ms: executionTimeMs,
        p_error_message: errorMessage,
      });
    } catch (error) {
      console.error('[FunctionCalling] Error logging Gmail operation:', error);
    }
  }

  /**
   * Get quota consumption for a tool
   */
  private getQuotaConsumption(toolName: string): number {
    const quotaMap: Record<string, number> = {
      send_email: 100,
      read_emails: 5,
      search_emails: 5,
      email_actions: 5,
    };
    
    return quotaMap[toolName] || 1;
  }

  /**
   * Format function call result for OpenAI
   */
  formatFunctionResult(result: MCPToolResult, functionName: string): string {
    if (result.success) {
      // Format successful result
      let formattedResult = `✅ Successfully executed ${functionName}`;
      
      if (result.data) {
        if (typeof result.data === 'string') {
          formattedResult += `\n\nResult: ${result.data}`;
        } else {
          formattedResult += `\n\nResult: ${JSON.stringify(result.data, null, 2)}`;
        }
      }
      
      if (result.metadata?.execution_time_ms) {
        formattedResult += `\n\nExecution time: ${result.metadata.execution_time_ms}ms`;
      }
      
      return formattedResult;
    } else {
      // Format error result with details
      let errorMessage = `❌ Failed to execute ${functionName}\n\n`;
      errorMessage += `**Error Details:**\n`;
      errorMessage += `• Error: ${result.error || 'Unknown error'}\n`;
      
      if (result.metadata?.execution_time_ms) {
        errorMessage += `• Execution time: ${result.metadata.execution_time_ms}ms\n`;
      }
      
      errorMessage += `\n**What you can try:**\n`;
      
      // Add specific guidance based on the error
      if (result.error?.includes('Failed to send email')) {
        errorMessage += `• Check that the recipient email address is valid\n`;
        errorMessage += `• Verify your Gmail account has sending permissions enabled\n`;
        errorMessage += `• Ensure you're not hitting Gmail's sending limits\n`;
      } else if (result.error?.includes('permissions')) {
        errorMessage += `• Verify your Gmail account is properly connected\n`;
        errorMessage += `• Check that necessary permissions were granted during OAuth\n`;
        errorMessage += `• Try reconnecting your Gmail account in Integrations\n`;
      } else if (result.error?.includes('token') || result.error?.includes('expired')) {
        errorMessage += `• Your Gmail authentication may have expired\n`;
        errorMessage += `• Please reconnect your Gmail account in Integrations\n`;
      }
      
      return errorMessage;
    }
  }
}

/**
 * Convert OpenAI function calls to function responses
 */
export function processFunctionCalls(
  toolCalls: OpenAIToolCall[],
  functionResults: MCPToolResult[],
  functionCallingManager: FunctionCallingManager
): OpenAIFunctionResponse[] {
  return toolCalls.map((toolCall, index) => {
    const result = functionResults[index];
    const formattedResult = functionCallingManager.formatFunctionResult(result, toolCall.function.name);
    
    return {
      tool_call_id: toolCall.id,
      content: formattedResult,
    };
  });
} 