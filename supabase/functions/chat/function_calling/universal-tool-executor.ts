/**
 * Universal Tool Execution Router
 * Routes tool execution to appropriate integration edge functions
 * This scales to any number of integrations without code changes
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { MCPToolResult } from './base.ts';

export interface MCPToolExecutionContext {
  agentId: string;
  userId: string;
  toolName: string;
  parameters: Record<string, any>;
  supabase: SupabaseClient;
  authToken?: string;  // Add auth token for edge function calls
}

// Tool routing configuration - easily extensible for new integrations
const TOOL_ROUTING_MAP: Record<string, {
  edgeFunction: string;
  actionMapping: (toolName: string) => string;
  parameterMapping?: (params: Record<string, any>) => Record<string, any>;
}> = {
  // Gmail tools
  'gmail_': {
    edgeFunction: 'gmail-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'gmail_send_email': 'send_email',
        'gmail_read_emails': 'list_messages',
        'gmail_search_emails': 'search_messages',
        'gmail_email_actions': 'modify_message'
      };
      return actionMap[toolName] || 'unknown_action';
    }
  },
  
  // SMTP tools
  'smtp_': {
    edgeFunction: 'smtp-send',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'smtp_send_email': 'send',
        'smtp_send_bulk': 'send_bulk',
        'smtp_validate_config': 'validate'
      };
      return actionMap[toolName] || 'send';
    }
  },
  
  // Web search tools (using web-search-api)
  'web_search': {
    edgeFunction: 'web-search-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'web_search': 'web_search',
        'scrape_url': 'scrape_and_summarize',
        'news_search': 'news_search'
      };
      return actionMap[toolName] || 'web_search';
    },
    parameterMapping: (params: Record<string, any>) => ({
      parameters: params  // Nest parameters object as expected by web-search-api
    })
  },
  
  // News search tools
  'news_': {
    edgeFunction: 'web-search-api',
    actionMapping: () => 'news_search',
    parameterMapping: (params: Record<string, any>) => ({
      parameters: params
    })
  },
  
  // Scrape tools
  'scrape_': {
    edgeFunction: 'web-search-api',
    actionMapping: () => 'scrape_and_summarize',
    parameterMapping: (params: Record<string, any>) => ({
      parameters: params
    })
  },
  
  // MCP/Zapier tools - route to MCP handler
  'zapier_': {
    edgeFunction: 'mcp-execute',
    actionMapping: (toolName: string) => toolName // Pass through tool name
  }
};

export class UniversalToolExecutor {
  
  /**
   * Execute any tool by routing to the appropriate edge function
   * This is the universal solution that scales to any integration
   */
  static async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { toolName, parameters, supabase, agentId, userId } = context;
    
    try {
      console.log(`[UniversalToolExecutor] Executing ${toolName} for agent ${agentId}`);
      
      // Find the appropriate routing configuration
      const routingConfig = this.findRoutingConfig(toolName);
      
      if (!routingConfig) {
        console.error(`[UniversalToolExecutor] No routing configuration found for tool: ${toolName}`);
        return {
          success: false,
          error: `No handler configured for tool: ${toolName}`,
          metadata: { toolName, availableTools: Object.keys(TOOL_ROUTING_MAP) }
        };
      }
      
      // Map tool name to action
      const action = routingConfig.actionMapping(toolName);
      
      // Prepare parameters for the edge function
      const baseParams = {
        action,
        agent_id: agentId,  // Use agent_id as expected by edge functions
        user_id: userId,
        tool_name: toolName
      };
      
      // Apply parameter mapping if provided, otherwise merge parameters directly
      const edgeFunctionParams = routingConfig.parameterMapping 
        ? { ...baseParams, ...routingConfig.parameterMapping(parameters) }
        : { ...baseParams, ...parameters };
      
      console.log(`[UniversalToolExecutor] Routing ${toolName} -> ${routingConfig.edgeFunction} (action: ${action})`);
      console.log(`[UniversalToolExecutor] Edge function params:`, JSON.stringify(edgeFunctionParams, null, 2));
      
      // Prepare headers for edge function call (only authorization)
      const invokeOptions: any = {
        body: edgeFunctionParams
      };
      
      // Include authorization header if auth token is provided
      if (context.authToken) {
        invokeOptions.headers = {
          'Authorization': `Bearer ${context.authToken}`
        };
      }
      
      // Call the appropriate edge function
      const { data, error } = await supabase.functions.invoke(routingConfig.edgeFunction, invokeOptions);
      
      if (error) {
        console.error(`[UniversalToolExecutor] Edge function error for ${toolName}:`, error);
        return {
          success: false,
          error: `Integration error: ${error.message || 'Unknown error'}`,
          metadata: { 
            toolName, 
            edgeFunction: routingConfig.edgeFunction, 
            action,
            originalError: error.code || error.name
          }
        };
      }
      
      // Handle different response patterns from edge functions
      if (data && typeof data === 'object') {
        // If the response already has a success field, use it as-is
        if ('success' in data) {
          return {
            ...data,
            metadata: { 
              ...data.metadata, 
              toolName, 
              edgeFunction: routingConfig.edgeFunction,
              action 
            }
          };
        }
        
        // Otherwise, wrap the response as successful
        return {
          success: true,
          data: data,
          metadata: { toolName, edgeFunction: routingConfig.edgeFunction, action }
        };
      }
      
      // Handle primitive responses (strings, numbers, etc.)
      return {
        success: true,
        data: data,
        metadata: { toolName, edgeFunction: routingConfig.edgeFunction, action }
      };
      
    } catch (error: any) {
      console.error(`[UniversalToolExecutor] Unexpected error executing ${toolName}:`, error);
      return {
        success: false,
        error: error.message || `Unexpected error executing ${toolName}`,
        metadata: { 
          toolName, 
          error: error.name || 'UnknownError',
          stack: error.stack?.split('\n')[0] // Just the first line for debugging
        }
      };
    }
  }
  
  /**
   * Find the routing configuration for a tool name
   * Checks prefixes in order of specificity (longest first)
   */
  private static findRoutingConfig(toolName: string) {
    // Sort prefixes by length (descending) to match most specific first
    const sortedPrefixes = Object.keys(TOOL_ROUTING_MAP).sort((a, b) => b.length - a.length);
    
    for (const prefix of sortedPrefixes) {
      if (toolName.startsWith(prefix)) {
        return TOOL_ROUTING_MAP[prefix];
      }
    }
    
    return null;
  }
  
  /**
   * Get all supported tool prefixes (for debugging/documentation)
   */
  static getSupportedPrefixes(): string[] {
    return Object.keys(TOOL_ROUTING_MAP);
  }
  
  /**
   * Add a new integration routing configuration
   * This allows dynamic addition of new integrations
   */
  static addIntegration(
    prefix: string, 
    config: {
      edgeFunction: string;
      actionMapping: (toolName: string) => string;
      parameterMapping?: (params: Record<string, any>) => Record<string, any>;
    }
  ) {
    TOOL_ROUTING_MAP[prefix] = config;
    console.log(`[UniversalToolExecutor] Added routing for prefix: ${prefix} -> ${config.edgeFunction}`);
  }
}
