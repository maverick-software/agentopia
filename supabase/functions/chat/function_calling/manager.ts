/**
 * Function Calling Manager - Refactored
 * Manages all tool providers and prevents duplicate executions
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAIFunction, MCPToolResult } from './base.ts';
import { SMTPProvider } from './smtp-provider.ts';
import { GmailProvider } from './gmail-provider.ts';
import { WebSearchProvider } from './web-search-provider.ts';
import { MCPProvider } from './mcp-provider.ts';

export class FunctionCallingManager {
  private supabase: SupabaseClient;
  private authToken: string;
  
  // Tool providers
  private smtpProvider: SMTPProvider;
  private gmailProvider: GmailProvider;
  private webSearchProvider: WebSearchProvider;
  private mcpProvider: MCPProvider;
  
  // Execution tracking to prevent duplicates
  private executionTracker: Map<string, Promise<MCPToolResult>> = new Map();
  
  constructor(supabase: SupabaseClient, authToken: string = '') {
    this.supabase = supabase;
    this.authToken = authToken;
    
    // Initialize providers
    this.smtpProvider = new SMTPProvider(supabase, authToken);
    this.gmailProvider = new GmailProvider(supabase, authToken);
    this.webSearchProvider = new WebSearchProvider(supabase, authToken);
    this.mcpProvider = new MCPProvider(supabase, authToken);
  }

  /**
   * Get all available tools for an agent with deduplication
   */
  async getAvailableTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    console.log(`[FunctionCalling] Getting available tools for agent ${agentId}, user ${userId}`);
    
    try {
      // Get tools from all providers in parallel
      const [
        gmailTools,
        smtpTools, 
        webSearchTools,
        mcpTools
      ] = await Promise.all([
        this.gmailProvider.getTools(agentId, userId),
        this.smtpProvider.getTools(agentId, userId), 
        this.webSearchProvider.getTools(agentId, userId),
        this.mcpProvider.getTools(agentId)
      ]);

      // Combine all tools with deduplication
      const allTools = [
        ...gmailTools,
        ...smtpTools,
        ...webSearchTools,
        ...mcpTools
      ];

      // Remove duplicates based on tool name
      const uniqueTools = allTools.reduce((acc, tool) => {
        if (!acc.find(existing => existing.name === tool.name)) {
          acc.push(tool);
        }
        return acc;
      }, [] as OpenAIFunction[]);

      console.log(`[FunctionCalling] Found ${uniqueTools.length} available tools`);
      console.log(`[FunctionCalling] Gmail tools count: ${gmailTools.length}, SMTP tools count: ${smtpTools.length}, Web search tools count: ${webSearchTools.length}, MCP tools count: ${mcpTools.length}`);
      console.log(`[FunctionCalling] All tool names:`, JSON.stringify(uniqueTools.map(t => t.name), null, 2));

      return uniqueTools;
      
    } catch (error) {
      console.error('[FunctionCalling] Error getting available tools:', error);
      return [];
    }
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
