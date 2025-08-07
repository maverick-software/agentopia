// Compatibility Layer for Seamless Integration
// Provides utilities for maintaining compatibility during migration

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { MessageFormatAdapter } from './message_adapter.ts';
import { getFeatureFlags, KillSwitch } from './feature_flags.ts';
import { AdvancedChatMessage } from '../types/message.types.ts';
import { ChatMessage } from '../context_builder.ts';

/**
 * Dual-write service for maintaining data consistency during migration
 */
export class DualWriteService {
  constructor(private supabaseClient: SupabaseClient) {}
  
  /**
   * Save message to both old and new tables
   */
  async saveMessage(
    message: any,
    options?: {
      skipV1?: boolean;
      skipV2?: boolean;
      context?: any;
    }
  ): Promise<{ v1Success: boolean; v2Success: boolean; errors: any[] }> {
    const flags = getFeatureFlags();
    const errors: any[] = [];
    let v1Success = false;
    let v2Success = false;
    
    // Check kill switch
    if (KillSwitch.isActivated('emergency_rollback')) {
      console.warn('[DualWrite] Emergency rollback activated, only writing to V1');
      options = { ...options, skipV2: true };
    }
    
    // Determine message format
    const isV2Format = MessageFormatAdapter.isV2Message(message);
    
    // Save to V1 table
    if (!options?.skipV1 && flags.maintain_dual_write) {
      try {
        const v1Message = isV2Format 
          ? MessageFormatAdapter.toV1(message) 
          : message;
        
        const { error } = await this.supabaseClient
          .from('chat_messages')
          .insert({
            channel_id: options?.context?.channel_id || null,
            content: v1Message.content,
            sender_user_id: options?.context?.sender_user_id || null,
            sender_agent_id: options?.context?.sender_agent_id || null,
            created_at: v1Message.timestamp || new Date().toISOString(),
          });
        
        if (error) throw error;
        v1Success = true;
      } catch (error) {
        console.error('[DualWrite] V1 write failed:', error);
        errors.push({ table: 'chat_messages', error });
      }
    }
    
    // Save to V2 table
    if (!options?.skipV2 && flags.use_advanced_messages) {
      try {
        const v2Message: AdvancedChatMessage = isV2Format 
          ? message 
          : MessageFormatAdapter.toV2(message, options?.context);
        
        const { error } = await this.supabaseClient
          .from('chat_messages_v2')
          .insert({
            id: v2Message.id,
            version: v2Message.version,
            conversation_id: v2Message.context.conversation_id,
            session_id: v2Message.context.session_id,
            channel_id: v2Message.context.channel_id,
            sender_user_id: v2Message.context.user_id,
            sender_agent_id: v2Message.context.agent_id,
            role: v2Message.role,
            content: v2Message.content,
            metadata: v2Message.metadata,
            context: v2Message.context,
            tools: v2Message.tools,
            memory_refs: v2Message.memory,
            state_snapshot_id: v2Message.state?.id,
            audit: v2Message.audit,
            created_at: v2Message.created_at,
            updated_at: v2Message.updated_at,
          });
        
        if (error) throw error;
        v2Success = true;
      } catch (error) {
        console.error('[DualWrite] V2 write failed:', error);
        errors.push({ table: 'chat_messages_v2', error });
      }
    }
    
    // Log results
    if (flags.verbose_logging) {
      console.log('[DualWrite] Results:', { v1Success, v2Success, errorCount: errors.length });
    }
    
    return { v1Success, v2Success, errors };
  }
  
  /**
   * Read messages with fallback between versions
   */
  async readMessages(
    filters: any,
    preferVersion: '1' | '2' = '2'
  ): Promise<any[]> {
    const flags = getFeatureFlags();
    
    // Try preferred version first
    if (preferVersion === '2' && flags.use_advanced_messages) {
      try {
        const { data: v2Messages, error } = await this.supabaseClient
          .from('chat_messages_v2')
          .select('*')
          .match(filters)
          .order('created_at', { ascending: false });
        
        if (!error && v2Messages?.length > 0) {
          return v2Messages;
        }
      } catch (error) {
        console.warn('[DualWrite] V2 read failed, falling back to V1:', error);
      }
    }
    
    // Fallback to V1
    try {
      const { data: v1Messages, error } = await this.supabaseClient
        .from('chat_messages')
        .select('*')
        .match(filters)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Convert to requested format if needed
      if (preferVersion === '2' && v1Messages) {
        return v1Messages.map(msg => 
          MessageFormatAdapter.toV2({
            role: msg.sender_user_id ? 'user' : 'assistant',
            content: msg.content,
            timestamp: msg.created_at,
          })
        );
      }
      
      return v1Messages || [];
    } catch (error) {
      console.error('[DualWrite] Both reads failed:', error);
      return [];
    }
  }
}

/**
 * Tool compatibility wrapper
 */
export class ToolCompatibilityWrapper {
  /**
   * Wrap old tool format to new format
   */
  static wrapLegacyTool(legacyTool: any): any {
    return {
      id: legacyTool.name,
      version: '1.0.0',
      name: legacyTool.name,
      description: legacyTool.description,
      
      // Convert parameters to JSON schema
      input_schema: {
        type: 'object',
        properties: legacyTool.parameters.properties || {},
        required: legacyTool.parameters.required || [],
      },
      
      output_schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          result: { type: 'any' },
          error: { type: 'string' },
        },
      },
      
      // Default capabilities
      requires_auth: true,
      stateful: false,
      timeout_ms: 30000,
      
      capabilities: {
        streaming: false,
        batch: false,
        async: false,
      },
      
      // No metrics for legacy tools
      metrics: {
        avg_latency_ms: 0,
        success_rate: 0,
      },
    };
  }
  
  /**
   * Convert new tool format to legacy format for OpenAI
   */
  static toLegacyFormat(advancedTool: any): any {
    return {
      name: advancedTool.name,
      description: advancedTool.description,
      parameters: advancedTool.input_schema,
    };
  }
}

/**
 * Context compatibility utilities
 */
export class ContextCompatibility {
  /**
   * Merge old and new context formats
   */
  static mergeContexts(
    oldContext: any,
    newContext: any
  ): any {
    return {
      // From old context
      channel_id: oldContext?.channelId || newContext?.channel_id,
      workspace_id: oldContext?.workspaceId || newContext?.workspace_id,
      
      // From new context
      conversation_id: newContext?.conversation_id || oldContext?.conversationId,
      session_id: newContext?.session_id || oldContext?.sessionId,
      
      // User/Agent info
      user_id: oldContext?.userId || newContext?.user_id,
      agent_id: oldContext?.agentId || newContext?.agent_id,
      
      // Extended context
      ...newContext,
    };
  }
  
  /**
   * Extract context from various request formats
   */
  static extractContext(request: any): any {
    // V2 format
    if (request.message?.context) {
      return request.message.context;
    }
    
    // V1 format
    if (request.channelId || request.workspaceId || request.agentId) {
      return {
        channel_id: request.channelId,
        workspace_id: request.workspaceId,
        agent_id: request.agentId,
      };
    }
    
    // URL parameters
    if (request.url) {
      const url = new URL(request.url);
      return {
        channel_id: url.searchParams.get('channelId'),
        workspace_id: url.searchParams.get('workspaceId'),
        agent_id: url.searchParams.get('agentId'),
      };
    }
    
    return {};
  }
}

/**
 * Migration utilities
 */
export class MigrationHelper {
  constructor(private supabaseClient: SupabaseClient) {}
  
  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{
    v1Count: number;
    v2Count: number;
    migrationProgress: number;
  }> {
    const [v1Result, v2Result] = await Promise.all([
      this.supabaseClient
        .from('chat_messages')
        .select('id', { count: 'exact', head: true }),
      this.supabaseClient
        .from('chat_messages_v2')
        .select('id', { count: 'exact', head: true }),
    ]);
    
    const v1Count = v1Result.count || 0;
    const v2Count = v2Result.count || 0;
    const migrationProgress = v1Count > 0 ? (v2Count / v1Count) * 100 : 0;
    
    return { v1Count, v2Count, migrationProgress };
  }
  
  /**
   * Batch migrate messages
   */
  async batchMigrate(
    batchSize: number = 100,
    offset: number = 0
  ): Promise<{ migrated: number; errors: any[] }> {
    const errors: any[] = [];
    let migrated = 0;
    
    try {
      // Fetch batch of V1 messages
      const { data: v1Messages, error } = await this.supabaseClient
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .range(offset, offset + batchSize - 1);
      
      if (error) throw error;
      if (!v1Messages || v1Messages.length === 0) return { migrated: 0, errors };
      
      // Convert and insert into V2
      for (const v1Msg of v1Messages) {
        try {
          const v2Msg = MessageFormatAdapter.toV2({
            role: v1Msg.sender_user_id ? 'user' : 'assistant',
            content: v1Msg.content,
            timestamp: v1Msg.created_at,
          }, {
            channel_id: v1Msg.channel_id,
            user_id: v1Msg.sender_user_id,
            agent_id: v1Msg.sender_agent_id,
          });
          
          const { error: insertError } = await this.supabaseClient
            .from('chat_messages_v2')
            .insert(v2Msg);
          
          if (insertError) throw insertError;
          migrated++;
        } catch (msgError) {
          errors.push({ message: v1Msg, error: msgError });
        }
      }
    } catch (batchError) {
      errors.push({ batch: true, error: batchError });
    }
    
    return { migrated, errors };
  }
}

/**
 * Rollback utilities
 */
export class RollbackManager {
  /**
   * Execute emergency rollback
   */
  static async executeRollback(reason: string): Promise<void> {
    console.error(`[ROLLBACK] Initiating emergency rollback: ${reason}`);
    
    // Activate all kill switches
    KillSwitch.activate('disable_v2_messages');
    KillSwitch.activate('disable_memory_system');
    KillSwitch.activate('disable_state_management');
    KillSwitch.activate('disable_new_tools');
    KillSwitch.activate('emergency_rollback');
    
    // Log rollback event
    console.error('[ROLLBACK] All kill switches activated');
    
    // Additional rollback actions would go here
    // (e.g., notify monitoring, update feature flags in DB, etc.)
  }
  
  /**
   * Check system health for auto-rollback
   */
  static async checkHealth(metrics: {
    errorRate: number;
    latencyMs: number;
    successRate: number;
  }): Promise<boolean> {
    const thresholds = {
      maxErrorRate: 0.05, // 5%
      maxLatencyMs: 5000, // 5 seconds
      minSuccessRate: 0.95, // 95%
    };
    
    if (metrics.errorRate > thresholds.maxErrorRate) {
      await this.executeRollback(`Error rate too high: ${metrics.errorRate}`);
      return false;
    }
    
    if (metrics.latencyMs > thresholds.maxLatencyMs) {
      await this.executeRollback(`Latency too high: ${metrics.latencyMs}ms`);
      return false;
    }
    
    if (metrics.successRate < thresholds.minSuccessRate) {
      await this.executeRollback(`Success rate too low: ${metrics.successRate}`);
      return false;
    }
    
    return true;
  }
}