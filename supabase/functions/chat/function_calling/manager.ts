/**
 * Function Calling Manager - MCP Unified Architecture
 * 
 * Uses proper MCP (Model Context Protocol) architecture where:
 * - ALL tools are MCP tools (Gmail, SMTP, WebSearch, Zapier, etc.)
 * - Single database query for all authorized tools
 * - Unified permission checking via agent_integration_permissions
 * - Tool caching with message-count + time-based invalidation
 * 
 * Replaced old 4-provider system (GmailProvider, SMTPProvider, etc.)
 * with unified MCP tool discovery
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAIFunction, MCPToolResult } from './base.ts';

// NOTE: Removed separate providers - now using unified MCP architecture
// All tools (Gmail, SMTP, WebSearch, Zapier) are now MCP tools
// Old providers: SMTPProvider, GmailProvider, WebSearchProvider, MCPProvider

// Tool cache interface
interface CachedTools {
  tools: OpenAIFunction[];
  messageCount: number;
  lastValidated: number;
  expires: number;
}

export class FunctionCallingManager {
  private supabase: SupabaseClient;
  private authToken: string;
  
  // Execution tracking to prevent duplicates
  private executionTracker: Map<string, Promise<MCPToolResult>> = new Map();
  
  // Tool caching system - validate every 15 messages OR 10 minutes
  private toolsCache: Map<string, CachedTools> = new Map();
  private readonly CACHE_MESSAGE_THRESHOLD = 15; // Revalidate after 15 messages
  private readonly CACHE_TIME_THRESHOLD = 600000; // 10 minutes in milliseconds
  
  constructor(supabase: SupabaseClient, authToken: string = '') {
    this.supabase = supabase;
    this.authToken = authToken;
    
    // All tools are now unified under MCP architecture
    // No need for separate provider instances
    console.log('[FunctionCalling] Initialized with unified MCP architecture');
  }

  /**
   * Get all available tools for an agent using proper MCP architecture
   * Single unified query instead of 4 separate provider calls
   * Revalidates every 15 messages OR 10 minutes, whichever comes first
   */
  async getAvailableTools(agentId: string, userId: string, currentMessageCount?: number): Promise<OpenAIFunction[]> {
    const cacheKey = `${agentId}:${userId}`;
    const now = Date.now();
    const msgCount = currentMessageCount || 0;
    
    // Check cache first
    const cached = this.toolsCache.get(cacheKey);
    if (cached) {
      const messageThresholdPassed = msgCount - cached.messageCount >= this.CACHE_MESSAGE_THRESHOLD;
      const timeThresholdPassed = now - cached.lastValidated >= this.CACHE_TIME_THRESHOLD;
      
      if (!messageThresholdPassed && !timeThresholdPassed) {
        console.log(`[FunctionCalling] ⚡ Using cached MCP tools for agent ${agentId} (${cached.tools.length} tools, age: ${Math.round((now - cached.lastValidated) / 1000)}s, msgs since: ${msgCount - cached.messageCount})`);
        return cached.tools;
      } else {
        console.log(`[FunctionCalling] 🔄 MCP cache expired for agent ${agentId} - Messages: ${messageThresholdPassed ? 'YES' : 'NO'} (${msgCount - cached.messageCount}/${this.CACHE_MESSAGE_THRESHOLD}), Time: ${timeThresholdPassed ? 'YES' : 'NO'} (${Math.round((now - cached.lastValidated) / 1000)}s)`);
      }
    }
    
    console.log(`[FunctionCalling] 🔍 Getting MCP tools for agent ${agentId}, user ${userId}`);
    
    try {
      // Call dedicated get-agent-tools edge function for better architecture
      const { data: toolsResponse, error } = await this.supabase.functions.invoke('get-agent-tools', {
        body: { agent_id: agentId, user_id: userId }
      });

      if (error) {
        console.error('[FunctionCalling] Error calling get-agent-tools function:', error);
        // Fallback to cached tools if available
        if (cached) {
          console.log(`[FunctionCalling] 🚨 Using stale cache as fallback (${cached.tools.length} tools)`);
          return cached.tools;
        }
        return [];
      }

      if (!toolsResponse?.success) {
        console.error('[FunctionCalling] get-agent-tools returned error:', toolsResponse?.error);
        // Fallback to cached tools if available
        if (cached) {
          console.log(`[FunctionCalling] 🚨 Using stale cache as fallback (${cached.tools.length} tools)`);
          return cached.tools;
        }
        return [];
      }

      const mcpTools: OpenAIFunction[] = toolsResponse.tools || [];
      
      console.log(`[FunctionCalling] ✅ Retrieved ${mcpTools.length} tools from ${toolsResponse.metadata?.provider_count || 0} providers via edge function`);
      if (toolsResponse.metadata?.provider_count) {
        console.log(`[FunctionCalling] Providers: ${toolsResponse.metadata.provider_count}, Tools: ${mcpTools.map((t: any) => t.name).join(', ')}`);
      }

      if (mcpTools.length === 0) {
        console.log(`[FunctionCalling] No MCP tools available for agent ${agentId}`);
        const emptyResult: OpenAIFunction[] = [];
        this.toolsCache.set(cacheKey, {
          tools: emptyResult,
          messageCount: msgCount,
          lastValidated: now,
          expires: now + this.CACHE_TIME_THRESHOLD
        });
        return emptyResult;
      }

      // Cache the results
      this.toolsCache.set(cacheKey, {
        tools: mcpTools,
        messageCount: msgCount,
        lastValidated: now,
        expires: now + this.CACHE_TIME_THRESHOLD
      });

      console.log(`[FunctionCalling] ✅ Retrieved ${mcpTools.length} MCP tools for agent ${agentId}`);
      console.log(`[FunctionCalling] MCP tool names:`, JSON.stringify(mcpTools.map(t => t.name), null, 2));

      return mcpTools;
      
    } catch (error) {
      console.error('[FunctionCalling] Error in MCP tool discovery:', error);
      // Return cached tools if available, even if expired, as fallback
      if (cached) {
        console.log(`[FunctionCalling] 🚨 Using stale cache as fallback (${cached.tools.length} tools)`);
        return cached.tools;
      }
      return [];
    }
  }

  /**
   * Map provider name and allowed scopes to actual tool definitions
   * Since tools are not stored in database, we use hardcoded mappings
   */
  private getToolsForProvider(providerName: string, allowedScopes: string[]): OpenAIFunction[] {
    const tools: OpenAIFunction[] = [];

    switch (providerName.toLowerCase()) {
      case 'gmail':
        // Gmail OAuth scopes to tools
        if (allowedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')) {
          tools.push({
            name: 'gmail_read_emails',
            description: 'Read emails from Gmail inbox',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query for emails' },
                max_results: { type: 'number', description: 'Maximum number of emails to return', default: 10 }
              },
              required: ['query']
            }
          });
          tools.push({
            name: 'gmail_search_emails', 
            description: 'Search emails in Gmail',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Gmail search query' },
                max_results: { type: 'number', description: 'Maximum results', default: 10 }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('https://www.googleapis.com/auth/gmail.send')) {
          tools.push({
            name: 'gmail_send_email',
            description: 'Send email via Gmail',
            parameters: {
              type: 'object', 
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body content' },
                cc: { type: 'string', description: 'CC recipients (optional)' },
                bcc: { type: 'string', description: 'BCC recipients (optional)' }
              },
              required: ['to', 'subject', 'body']
            }
          });
        }
        
        if (allowedScopes.includes('https://www.googleapis.com/auth/gmail.modify')) {
          tools.push({
            name: 'gmail_email_actions',
            description: 'Perform actions on Gmail emails (mark read, archive, etc.)',
            parameters: {
              type: 'object',
              properties: {
                message_id: { type: 'string', description: 'Gmail message ID' },
                action: { type: 'string', enum: ['mark_read', 'mark_unread', 'archive', 'delete'], description: 'Action to perform' }
              },
              required: ['message_id', 'action']
            }
          });
        }
        break;

      case 'serper_api':
        // Serper API web search tools
        if (allowedScopes.includes('web_search')) {
          tools.push({
            name: 'web_search',
            description: 'Search the web using Serper API',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 },
                country: { type: 'string', description: 'Country code for localized results', default: 'us' }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('news_search')) {
          tools.push({
            name: 'news_search', 
            description: 'Search news articles using Serper API',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'News search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('image_search')) {
          tools.push({
            name: 'image_search',
            description: 'Search images using Serper API', 
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Image search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('local_search')) {
          tools.push({
            name: 'local_search',
            description: 'Search local businesses using Serper API',
            parameters: {
              type: 'object', 
              properties: {
                query: { type: 'string', description: 'Local search query' },
                location: { type: 'string', description: 'Location for local search' }
              },
              required: ['query', 'location']
            }
          });
        }
        break;

      case 'smtp':
        // SMTP email tools
        if (allowedScopes.includes('send_email')) {
          tools.push({
            name: 'smtp_send_email',
            description: 'Send email via SMTP server',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' }, 
                body: { type: 'string', description: 'Email body content' },
                from_name: { type: 'string', description: 'Sender name (optional)' }
              },
              required: ['to', 'subject', 'body']
            }
          });
        }
        
        if (allowedScopes.includes('email_templates')) {
          tools.push({
            name: 'smtp_email_templates',
            description: 'Send templated emails via SMTP',
            parameters: {
              type: 'object',
              properties: {
                template_name: { type: 'string', description: 'Template identifier' },
                to: { type: 'string', description: 'Recipient email' },
                variables: { type: 'object', description: 'Template variables' }
              },
              required: ['template_name', 'to']
            }
          });
        }
        
        if (allowedScopes.includes('email_stats')) {
          tools.push({
            name: 'smtp_email_stats',
            description: 'Get SMTP email sending statistics',
            parameters: {
              type: 'object',
              properties: {
                date_range: { type: 'string', description: 'Date range for stats (e.g., "7d", "30d")' }
              }
            }
          });
        }
        break;

      default:
        console.warn(`[FunctionCalling] Unknown provider: ${providerName}`);
        break;
    }

    return tools;
  }

  /**
   * Manually invalidate tool cache for an agent (useful when permissions change)
   */
  invalidateToolCache(agentId: string, userId: string): void {
    const cacheKey = `${agentId}:${userId}`;
    const deleted = this.toolsCache.delete(cacheKey);
    if (deleted) {
      console.log(`[FunctionCalling] 🗑️ Invalidated tool cache for agent ${agentId}`);
    }
  }

  /**
   * Clear all expired cache entries (maintenance)
   */
  cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, cached] of this.toolsCache.entries()) {
      if (now > cached.expires) {
        this.toolsCache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[FunctionCaching] 🧹 Cleaned up ${removedCount} expired cache entries`);
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): { size: number, entries: Array<{key: string, tools: number, age: number}> } {
    const now = Date.now();
    const entries = Array.from(this.toolsCache.entries()).map(([key, cached]) => ({
      key,
      tools: cached.tools.length,
      age: Math.round((now - cached.lastValidated) / 1000)
    }));
    
    return {
      size: this.toolsCache.size,
      entries
    };
  }

  /**
   * Execute a function call with duplicate prevention
   */
  async executeFunction(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    // Create execution key for duplicate prevention
    const executionKey = `${agentId}:${userId}:${functionName}:${JSON.stringify(parameters)}`;
    
    // Check if this exact execution is already in progress
    if (this.executionTracker.has(executionKey)) {
      console.log(`[FunctionCalling] Duplicate execution detected for ${functionName}, returning existing promise`);
      return await this.executionTracker.get(executionKey)!;
    }

    console.log(`[FunctionCalling] Executing function ${functionName} for agent ${agentId}`);
    
    // Create execution promise
    const executionPromise = this.executeToolInternal(agentId, userId, functionName, parameters);
    
    // Track execution to prevent duplicates
    this.executionTracker.set(executionKey, executionPromise);
    
    try {
      const result = await executionPromise;
      return result;
    } finally {
      // Clean up tracking after 30 seconds
      setTimeout(() => {
        this.executionTracker.delete(executionKey);
      }, 30000);
    }
  }

  /**
   * Internal tool execution routing
   */
  private async executeToolInternal(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      // Route based on tool name prefix
      if (functionName.startsWith('gmail_')) {
        // Verify agent has Gmail permissions
        if (!(await this.gmailProvider.validatePermissions(agentId, userId, functionName))) {
          console.log(`[FunctionCalling] BLOCKED: Agent ${agentId} lacks permission for ${functionName}`);
          return { 
            success: false, 
            error: `Tool ${functionName} is not available for this agent`,
            metadata: { execution_time_ms: Date.now() - startTime }
          };
        }
        return await this.gmailProvider.executeTool(agentId, userId, functionName, parameters);
      }
      
      if (functionName.startsWith('smtp_')) {
        // Verify agent has SMTP permissions  
        if (!(await this.smtpProvider.validatePermissions(agentId, userId, functionName))) {
          console.log(`[FunctionCalling] BLOCKED: Agent ${agentId} lacks permission for ${functionName}`);
          return { 
            success: false, 
            error: `Tool ${functionName} is not available for this agent`,
            metadata: { execution_time_ms: Date.now() - startTime }
          };
        }
        return await this.smtpProvider.executeTool(agentId, userId, functionName, parameters);
      }
      
      if (functionName.startsWith('web_search') || functionName.startsWith('scrape_') || functionName.startsWith('news_')) {
        return await this.webSearchProvider.executeTool(agentId, userId, functionName, parameters);
      }
      
      // Check if it's an MCP tool (has metadata mapping)
      const mcpTools = await this.mcpProvider.getTools(agentId);
      if (mcpTools.find(t => t.name === functionName)) {
        return await this.mcpProvider.executeTool(agentId, userId, functionName, parameters);
      }
      
      // Unknown tool
      return {
        success: false,
        error: `Unknown tool: ${functionName}`,
        metadata: { execution_time_ms: Date.now() - startTime }
      };
      
    } catch (error: any) {
      console.error(`[FunctionCalling] Error executing ${functionName}:`, error);
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        metadata: { execution_time_ms: Date.now() - startTime }
      };
    }
  }

  /**
   * Format tool execution result for display
   */
  async formatResult(functionName: string, result: MCPToolResult): Promise<string> {
    if (result.success) {
      // Use provider-specific formatting if available
      if (functionName.startsWith('smtp_')) {
        try {
          // Use SMTP-specific formatting
          const { SMTPToolResultFormatter } = await import('../smtp-tools.ts');
          return SMTPToolResultFormatter.formatResult(functionName, result.data, true);
        } catch {
          // Fallback to generic formatting if SMTP formatter not available
        }
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
        formattedResult += `\n\n⏱️ Execution time: ${result.metadata.execution_time_ms}ms`;
      }
      
      return formattedResult;
    } else {
      // Use provider-specific error formatting
      if (functionName.startsWith('smtp_')) {
        try {
          const { SMTPToolResultFormatter } = await import('../smtp-tools.ts');
          return SMTPToolResultFormatter.formatResult(functionName, result, false);
        } catch {
          // Fallback to generic formatting if SMTP formatter not available
        }
      }
      
      // Format error result with details
      let errorMessage = `❌ Failed to execute ${functionName}\n\n`;
      errorMessage += `**Error Details:**\n`;
      errorMessage += `• Error: ${result.error || 'Unknown error'}\n`;
      
      if (result.metadata?.execution_time_ms) {
        errorMessage += `• Execution time: ${result.metadata.execution_time_ms}ms\n`;
      }
      
      if (result.data) {
        errorMessage += `• Additional info: ${JSON.stringify(result.data, null, 2)}\n`;
      }
      
      return errorMessage;
    }
  }

  /**
   * Clear all provider caches for an agent
   */
  clearCaches(agentId: string, userId: string): void {
    this.gmailProvider.clearCache(agentId, userId);
    this.smtpProvider.clearCache(agentId, userId);
    this.webSearchProvider.clearCache(agentId, userId);
    this.mcpProvider.clearCache(agentId);
  }

  /**
   * Get execution statistics for debugging
   */
  getExecutionStats(): {
    activeExecutions: number;
    gmail: { size: number; entries: string[] };
    smtp: { size: number; entries: string[] };
    webSearch: { size: number; entries: string[] };
  } {
    return {
      activeExecutions: this.executionTracker.size,
      gmail: this.gmailProvider.getCacheStats(),
      smtp: this.smtpProvider.getCacheStats(),
      webSearch: this.webSearchProvider.getCacheStats(),
    };
  }
}

// Export for backwards compatibility
export { FunctionCallingManager as default };
