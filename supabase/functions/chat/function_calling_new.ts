/**
 * Function Calling Integration for Chat System - Refactored
 * Simplified interface that delegates to modular providers
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { FunctionCallingManager } from './function_calling/manager.ts';

// Re-export types for backwards compatibility
export type { OpenAIFunction, OpenAIToolCall, MCPToolResult } from './function_calling/base.ts';

/**
 * Legacy FunctionCallingManager wrapper for backwards compatibility
 * Delegates to the new modular system
 */
export class FunctionCallingManagerLegacy {
  private manager: FunctionCallingManager;

  constructor(supabaseClient: SupabaseClient, authToken: string = '') {
    this.manager = new FunctionCallingManager(supabaseClient, authToken);
  }

  /**
   * Get available tools for an agent
   */
  async getAvailableTools(agentId: string, userId: string) {
    return await this.manager.getAvailableTools(agentId, userId);
  }

  /**
   * Execute a function call
   */
  async executeFunction(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ) {
    return await this.manager.executeFunction(agentId, userId, functionName, parameters);
  }

  /**
   * Format tool execution result
   */
  formatResult(functionName: string, result: any): string {
    return this.manager.formatResult(functionName, result);
  }

  /**
   * Clear caches
   */
  clearCaches(agentId: string, userId: string): void {
    this.manager.clearCaches(agentId, userId);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    return this.manager.getExecutionStats();
  }
}

// Export the new manager as the default for new code
export { FunctionCallingManager };

// Export the legacy wrapper as the old name for backwards compatibility
export { FunctionCallingManagerLegacy as FunctionCallingManager as default };
