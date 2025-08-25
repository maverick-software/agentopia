/**
 * Function Calling Integration for Chat System
 * Converts MCP tools to OpenAI function calling format
 * Handles tool execution and response formatting
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { SMTP_MCP_TOOLS, SMTPToolValidator, SMTPToolResultFormatter } from './smtp-tools.ts';

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
 * SendGrid MCP Tools Registry
 */
export const SENDGRID_MCP_TOOLS: Record<string, MCPTool> = {
  send_email: {
    name: 'send_email',
    description: 'Send a transactional email via SendGrid. Use when asked to email without OAuth inbox context.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Plaintext body' },
        html: { type: 'string', description: 'HTML body (optional)' },
        from: { type: 'string', description: 'From email (optional, defaults to agent setting)' },
        reply_to: { type: 'string', description: 'Reply-To email (optional)' },
      },
      required: ['to', 'subject', 'body'],
    },
    // Standardize on generic email capability scopes across providers
    required_scopes: ['send_email'],
  },
};

/**
 * Mailgun MCP Tools Registry
 */
export const MAILGUN_MCP_TOOLS: Record<string, MCPTool> = {
  mailgun_send_email: {
    name: 'mailgun_send_email',
    description: 'Send an email via Mailgun Email API. Use for high-deliverability email sending with advanced features.',
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
        text: {
          type: 'string',
          description: 'Plain text email body',
        },
        html: {
          type: 'string',
          description: 'HTML email body (optional)',
        },
        from: {
          type: 'string',
          description: 'From email address (must be from verified domain)',
        },
        cc: {
          type: 'array',
          description: 'CC recipients',
          items: { type: 'string' }
        },
        bcc: {
          type: 'array', 
          description: 'BCC recipients',
          items: { type: 'string' }
        },
        attachments: {
          type: 'array',
          description: 'Email attachments',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded content' },
              contentType: { type: 'string' }
            }
          }
        },
        template: {
          type: 'string',
          description: 'Mailgun template name (optional)'
        },
        template_variables: {
          type: 'object',
          description: 'Template variables for personalization'
        },
        scheduled_time: {
          type: 'string',
          description: 'Schedule email for future delivery (RFC 2822 format)'
        },
        tags: {
          type: 'array',
          description: 'Email tags for tracking',
          items: { type: 'string' }
        }
      },
      required: ['to', 'subject', 'from'],
    },
    // Use unified capability keys so UI-granted scopes match discovery
    required_scopes: ['send_email'],
  },

  mailgun_validate_email: {
    name: 'mailgun_validate_email',
    description: 'Validate an email address using Mailgun validation service.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address to validate'
        }
      },
      required: ['email']
    },
    required_scopes: ['validate'],
  },

  mailgun_get_stats: {
    name: 'mailgun_get_stats',
    description: 'Get email delivery statistics and analytics.',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for stats (YYYY-MM-DD)'
        },
        end_date: {
          type: 'string', 
          description: 'End date for stats (YYYY-MM-DD)'
        },
        resolution: {
          type: 'string',
          enum: ['hour', 'day', 'month'],
          description: 'Time resolution for stats'
        }
      }
    },
    required_scopes: ['stats'],
  },

  mailgun_manage_suppressions: {
    name: 'mailgun_manage_suppressions',
    description: 'Manage email suppressions (bounces, unsubscribes, complaints).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'add', 'remove'],
          description: 'Action to perform'
        },
        type: {
          type: 'string',
          enum: ['bounces', 'unsubscribes', 'complaints'],
          description: 'Suppression list type'
        },
        email: {
          type: 'string',
          description: 'Email address for add/remove actions'
        }
      },
      required: ['action', 'type']
    },
    required_scopes: ['suppressions'],
  }
};

/**
 * Function Calling Manager
 */
export class FunctionCallingManager {
  private mcpToolMetadata = new Map<string, { connectionId: string; toolName: string }>();

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
      
      // Get MCP tools from Zapier and other MCP servers
      const mcpTools = await this.getMCPTools(agentId, userId);
      
      // SendGrid transactional email tools (API key based)
      const sendgridTools = await this.getSendgridTools(agentId, userId);
      
      // Mailgun email tools (API key based)
      const mailgunTools = await this.getMailgunTools(agentId, userId);
      
      // SMTP email tools (API key based)
      const smtpTools = await this.getSMTPTools(agentId, userId);
      
      const allTools = [...gmailTools, ...webSearchTools, ...mcpTools, ...sendgridTools, ...mailgunTools, ...smtpTools];
      
      console.log(`[FunctionCalling] Found ${allTools.length} available tools`);
      console.log(`[FunctionCalling] All tool names:`, allTools.map(t => t.name));
      console.log(`[FunctionCalling] MCP tools count: ${mcpTools.length}, Gmail tools count: ${gmailTools.length}, Web search tools count: ${webSearchTools.length}`);
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
          user_integration_credentials!inner(
            oauth_provider_id,
            credential_type,
            oauth_providers!inner(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.oauth_providers.name', 'gmail')
        .eq('user_integration_credentials.credential_type', 'oauth')
        .eq('is_active', true)
        .limit(5);

      if (!permissions || permissions.length === 0) {
        console.log(`[FunctionCalling] No Gmail permissions found for agent ${agentId}`);
        return [];
      }

      const grantedScopes = (permissions[0]?.allowed_scopes || []) as string[];
      console.log(`[FunctionCalling] Agent ${agentId} has Gmail scopes:`, grantedScopes);
      console.log(`[FunctionCalling] Available Gmail tool definitions:`, Object.keys(GMAIL_MCP_TOOLS));
      
      // Filter tools based on granted scopes
      const availableTools: OpenAIFunction[] = [];
      
      for (const [toolName, tool] of Object.entries(GMAIL_MCP_TOOLS)) {
        const hasRequiredScopes = tool.required_scopes.every(scope => {
          // Normalize both sides to allow short names (e.g., 'gmail.send') or full URLs
          const normalize = (s: string) => s.toLowerCase().replace('https://www.googleapis.com/auth/', '').replace('https://mail.google.com/', 'mail.google.com');
          const req = normalize(scope);
          return grantedScopes.some((grantedScope: string) => {
            const g = normalize(grantedScope);
            return g === req || g.endsWith(req) || req.endsWith(g);
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
   * Get Web Search tools for an agent (simplified approach - no complex permissions)
   */
  private async getWebSearchTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      // First check if web search is enabled in agent settings
      const { data: agent } = await this.supabaseClient
        .from('agents')
        .select('metadata')
        .eq('id', agentId)
        .single();
        
      const webSearchEnabled = agent?.metadata?.settings?.web_search_enabled;
      if (webSearchEnabled !== true) {
        console.log(`[FunctionCalling] Web search disabled for agent ${agentId} (setting: ${webSearchEnabled})`);
        return [];
      }
      
      // Simplified approach: Just check if user has any active web search credentials
      // No need for complex permission grants - if they have credentials and toggle is on, provide tools
      const { data: connections } = await this.supabaseClient
        .from('user_integration_credentials')
        .select(`
          id,
          oauth_providers!inner(name, display_name),
          connection_status,
          credential_type
        `)
        .eq('user_id', userId)
        .in('oauth_providers.name', ['serper_api', 'serpapi', 'brave_search'])
        .eq('credential_type', 'api_key')
        .eq('connection_status', 'active');

      if (!connections || connections.length === 0) {
        console.log(`[FunctionCalling] No active web search credentials found for user ${userId}`);
        return [];
      }

      console.log(`[FunctionCalling] Agent ${agentId} has web search enabled and user has ${connections.length} active web search credentials`);
      console.log(`[FunctionCalling] Available web search tool definitions:`, Object.keys(WEB_SEARCH_MCP_TOOLS));
      
      // Return all web search tools - no scope filtering needed for API key tools
      const availableTools: OpenAIFunction[] = Object.values(WEB_SEARCH_MCP_TOOLS)
        .map(tool => ({
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
   * Get SendGrid tools for an agent (API key based)
   */
  private async getSendgridTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      const { data: permissions } = await this.supabaseClient
        .from('agent_oauth_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_integration_credentials!inner(
            oauth_providers!inner(name),
            credential_type
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.oauth_providers.name', 'sendgrid')
        .eq('user_integration_credentials.credential_type', 'api_key')
        .eq('is_active', true)
        .single();

      if (!permissions) {
        return [];
      }

      const grantedScopes = permissions.allowed_scopes || [];
      const available: OpenAIFunction[] = [];
      for (const tool of Object.values(SENDGRID_MCP_TOOLS)) {
        const ok = tool.required_scopes.length === 0 || tool.required_scopes.some(s => grantedScopes.includes(s));
        if (ok) {
          available.push({ name: tool.name, description: tool.description, parameters: tool.parameters });
        }
      }
      return available;
    } catch (error) {
      console.error('[FunctionCalling] Error getting SendGrid tools:', error);
      return [];
    }
  }

  /**
   * Get available Mailgun tools for agent
   */
  private async getMailgunTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      // Check if user has Mailgun API key configured
      const { data: permissions } = await this.supabaseClient
        .from('agent_oauth_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_integration_credentials!inner(
            oauth_providers!inner(name),
            credential_type
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.oauth_providers.name', 'mailgun')
        .eq('user_integration_credentials.credential_type', 'api_key')
        .eq('is_active', true)
        .single();

      if (!permissions) {
        console.log(`[FunctionCalling] No Mailgun credentials found for agent ${agentId}`);
        return [];
      }

      const grantedScopes = permissions.allowed_scopes || [];
      const available: OpenAIFunction[] = [];
      
      for (const tool of Object.values(MAILGUN_MCP_TOOLS)) {
        const hasRequiredScopes = tool.required_scopes.length === 0 || 
          tool.required_scopes.some(s => grantedScopes.includes(s));
        
        if (hasRequiredScopes) {
          available.push({ 
            name: tool.name, 
            description: tool.description, 
            parameters: tool.parameters 
          });
        }
      }
      
      console.log(`[FunctionCalling] Found ${available.length} Mailgun tools for agent ${agentId}`);
      return available;
      
    } catch (error) {
      console.error('[FunctionCalling] Error getting Mailgun tools:', error);
      return [];
    }
  }

  /**
   * Get available SMTP tools for agent
   */
  private async getSMTPTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      // Check if agent has SMTP permissions
      const { data: permissions } = await this.supabaseClient
        .from('agent_smtp_permissions')
        .select(`
          *,
          smtp_configurations!inner(
            id,
            connection_name,
            from_email,
            is_active
          )
        `)
        .eq('agent_id', agentId)
        .eq('smtp_configurations.user_id', userId)
        .eq('smtp_configurations.is_active', true)
        .eq('is_active', true);

      if (!permissions || permissions.length === 0) {
        console.log(`[FunctionCalling] No SMTP permissions found for agent ${agentId}`);
        return [];
      }

      const availableTools: OpenAIFunction[] = [];

      // Add available SMTP tools based on permissions
      for (const permission of permissions) {
        const configName = permission.smtp_configurations.connection_name;
        const fromEmail = permission.smtp_configurations.from_email;
        
        // Add send_email tool if permitted
        if (permission.can_send_email) {
          const sendEmailTool = SMTP_MCP_TOOLS.send_email;
          availableTools.push({
            name: sendEmailTool.name,
            description: `${sendEmailTool.description} via ${configName} (${fromEmail})`,
            parameters: sendEmailTool.inputSchema
          });
        }
        
        // Add test_connection tool (always available for agents with SMTP access)
        const testConnectionTool = SMTP_MCP_TOOLS.test_connection;
        availableTools.push({
          name: testConnectionTool.name,
          description: `${testConnectionTool.description} for ${configName}`,
          parameters: testConnectionTool.inputSchema
        });
      }

      console.log(`[FunctionCalling] Found ${availableTools.length} SMTP tools for agent ${agentId}`);
      return availableTools;
      
    } catch (error) {
      console.error('[FunctionCalling] Error getting SMTP tools:', error);
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
      if (Object.keys(SENDGRID_MCP_TOOLS).includes(functionName)) {
        return await this.executeSendgridTool(agentId, userId, functionName, parameters);
      }
      
      if (Object.keys(MAILGUN_MCP_TOOLS).includes(functionName)) {
        return await this.executeMailgunTool(agentId, userId, functionName, parameters);
      }
      
      if (Object.keys(SMTP_MCP_TOOLS).includes(functionName)) {
        return await this.executeSMTPTool(agentId, userId, functionName, parameters);
      }
      
      // Check if this is an MCP tool using the metadata map
      const mcpMetadata = this.mcpToolMetadata.get(functionName);
      if (mcpMetadata) {
        return await this.executeMCPTool(agentId, userId, mcpMetadata.connectionId, mcpMetadata.toolName, parameters);
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

  // (No unified tool helpers; MCP-native tools only)
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
      // Simplified approach: No complex permission validation needed
      // The fact that the tool was made available means the user has credentials
      // and the agent has web search enabled
      
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

  /** Execute SendGrid tool */
  private async executeSendgridTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const start = Date.now();
    try {
      // Validate permissions similarly to web search (API key present)
      const { data: permissions } = await this.supabaseClient
        .from('agent_oauth_permissions')
        .select(`
          *,
          user_integration_credentials!inner(
            oauth_providers!inner(name),
            credential_type
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.oauth_providers.name', 'sendgrid')
        .eq('user_integration_credentials.credential_type', 'api_key')
        .eq('is_active', true)
        .single();

      if (!permissions) {
        return { success: false, error: 'SendGrid not connected', metadata: { execution_time_ms: Date.now() - start } };
      }

      const { data, error } = await this.supabaseClient.functions.invoke('sendgrid-api', {
        body: { action: toolName, agent_id: agentId, params: parameters },
        headers: { 'Authorization': `Bearer ${this.authToken}` },
      });
      if (error) throw new Error(error.message);
      if (data && !data.success && data.error) throw new Error(data.error);
      return { success: true, data: data?.data || data, metadata: { execution_time_ms: Date.now() - start } };
    } catch (err: any) {
      return { success: false, error: err?.message || 'SendGrid tool failed', metadata: { execution_time_ms: Date.now() - start } };
    }
  }

  /**
   * Execute Mailgun tool
   */
  private async executeMailgunTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Mailgun] Executing ${toolName} for agent ${agentId}`);
      
      // Validate permissions (API key present)
      const { data: permissions } = await this.supabaseClient
        .from('agent_oauth_permissions')
        .select(`
          *,
          user_integration_credentials!inner(
            oauth_providers!inner(name),
            credential_type
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.oauth_providers.name', 'mailgun')
        .eq('user_integration_credentials.credential_type', 'api_key')
        .eq('is_active', true)
        .single();

      if (!permissions) {
        return { 
          success: false, 
          error: 'Mailgun not connected or no permissions granted', 
          metadata: { execution_time_ms: Date.now() - startTime } 
        };
      }
      
      // Call Mailgun service function
      const { data, error } = await this.supabaseClient.functions.invoke('mailgun-service', {
        body: {
          action: toolName.replace('mailgun_', ''), // Remove prefix
          agent_id: agentId,
          user_id: userId,
          parameters
        },
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      if (error) {
        throw new Error(`Mailgun API error: ${error.message}`);
      }

      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      return {
        success: true,
        data: data?.data || data,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'mailgun',
          tool_name: toolName
        }
      };

    } catch (error) {
      console.error(`[Mailgun] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'mailgun',
          tool_name: toolName
        }
      };
    }
  }

  /**
   * Execute SMTP tool
   */
  private async executeSMTPTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[SMTP] Executing ${toolName} for agent ${agentId}`);
      
      // Validate SMTP configuration access
      const configId = parameters.smtp_config_id;
      if (!configId) {
        throw new Error('smtp_config_id is required');
      }

      const { data: permission, error: permError } = await this.supabaseClient
        .from('agent_smtp_permissions')
        .select(`
          *,
          smtp_configurations!inner(
            id,
            connection_name,
            is_active,
            user_id
          )
        `)
        .eq('agent_id', agentId)
        .eq('smtp_config_id', configId)
        .eq('smtp_configurations.user_id', userId)
        .eq('smtp_configurations.is_active', true)
        .eq('is_active', true)
        .single();

      if (permError || !permission) {
        return {
          success: false,
          error: 'SMTP configuration not found or access denied',
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Check specific tool permission
      if (toolName === 'send_email' && !permission.can_send_email) {
        return {
          success: false,
          error: 'Agent does not have permission to send emails',
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Call the SMTP Edge Function
      const { data, error } = await this.supabaseClient.functions.invoke('smtp-api', {
        body: {
          action: toolName,
          agent_id: agentId,
          user_id: userId,
          params: parameters
        },
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      if (error) {
        throw new Error(`SMTP API error: ${error.message}`);
      }

      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      return {
        success: true,
        data: data?.data || data,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'smtp',
          tool_name: toolName,
          config_id: configId
        }
      };

    } catch (error) {
      console.error(`[SMTP] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP tool execution failed',
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'smtp',
          tool_name: toolName
        }
      };
    }
  }

  /**
   * Validate web search permissions for an agent (simplified - just check settings)
   * Note: This function is kept for backwards compatibility but is no longer used
   */
  private async validateWebSearchPermissions(agentId: string, userId: string): Promise<boolean> {
    try {
      // Simplified: Just check if web search is enabled for the agent
      const { data: agent } = await this.supabaseClient
        .from('agents')
        .select('metadata')
        .eq('id', agentId)
        .single();
        
      const webSearchEnabled = agent?.metadata?.settings?.web_search_enabled;
      
      // Also check if user has any web search credentials
      const { data: connections } = await this.supabaseClient
        .from('user_integration_credentials')
        .select('id')
        .eq('user_id', userId)
        .in('oauth_providers.name', ['serper_api', 'serpapi', 'brave_search'])
        .eq('credential_type', 'api_key')
        .eq('connection_status', 'active')
        .limit(1);
        
      return webSearchEnabled === true && connections && connections.length > 0;
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
   * Execute MCP tool
   */
  private async executeMCPTool(
    agentId: string,
    userId: string,
    connectionId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[FunctionCalling] Executing MCP tool ${toolName} via connection ${connectionId}`);
      
      // Import MCP provider dynamically
      const { MCPToolProvider } = await import('./providers/mcp-provider.ts');
      const mcpProvider = new MCPToolProvider(this.supabaseClient, this.authToken);
      
      // Execute the tool with the provided parameters
      const result = await mcpProvider.executeTool(agentId, userId, {
        connectionId,
        toolName,
        arguments: parameters
      });
      
      // Convert to MCPToolResult format
      return {
        success: result.success,
        data: result.result,
        error: result.error,
        metadata: {
          execution_time_ms: result.execution_time_ms || Date.now() - startTime,
          ...result.metadata
        }
      };
    } catch (error) {
      console.error(`[FunctionCalling] Error executing MCP tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MCP tool execution failed',
        metadata: {
          execution_time_ms: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get MCP tools for an agent
   */
  private async getMCPTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      console.log(`[FunctionCalling] Getting MCP tools for agent ${agentId}`);
      
      // Get MCP tools from database using the stored procedure
      const { data: mcpToolsData, error } = await this.supabaseClient
        .rpc('get_agent_mcp_tools', { p_agent_id: agentId });

      if (error) {
        console.error('[FunctionCalling] Error fetching MCP tools:', error);
        return [];
      }

      if (!mcpToolsData || mcpToolsData.length === 0) {
        console.log(`[FunctionCalling] No MCP tools found for agent ${agentId}`);
        return [];
      }

      // Convert MCP tools to OpenAI function format
      const mcpTools: OpenAIFunction[] = mcpToolsData.map((row: any) => {
        const openaiSchema = row.openai_schema;
        
        // Store MCP metadata in a separate map for routing
        this.mcpToolMetadata.set(openaiSchema.name, {
          connectionId: row.connection_id,
          toolName: row.tool_name
        });
        
        // Return clean OpenAI function schema without metadata
        return openaiSchema;
      });

      console.log(`[FunctionCalling] Found ${mcpTools.length} MCP tools for agent ${agentId}`);
      console.log(`[FunctionCalling] MCP tool names:`, mcpTools.map(t => t.name));
      return mcpTools;
    } catch (error) {
      console.error('[FunctionCalling] Error getting MCP tools:', error);
      return [];
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
      // Use SMTP-specific formatting if available
      if (Object.keys(SMTP_MCP_TOOLS).includes(functionName)) {
        return SMTPToolResultFormatter.formatResult(functionName, result.data, true);
      }
      
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
      // Use SMTP-specific formatting if available
      if (Object.keys(SMTP_MCP_TOOLS).includes(functionName)) {
        return SMTPToolResultFormatter.formatResult(functionName, result, false);
      }
      
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