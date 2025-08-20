// GetZep Semantic Memory Manager
// Handles knowledge graph operations completely separate from episodic memory

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';

export interface GetZepConfig {
  apiKey: string;
  projectId?: string;
  accountId?: string;
  userId: string;
}

export class GetZepSemanticManager {
  private config: GetZepConfig | null = null;
  
  constructor(
    private supabase: SupabaseClient,
    private agentId: string
  ) {}

  /**
   * Parse content string into GetZep Message format
   */
  private parseContentToMessages(content: string, metadata?: Record<string, any>): any[] {
    const messages: any[] = [];
    
    // Split content by role indicators (user:, assistant:, etc.)
    const lines = content.split('\n');
    let currentRole = 'user';
    let currentContent = '';
    let currentName = 'User';
    
    for (const line of lines) {
      const roleMatch = line.match(/^(user|assistant|system):\s*(.*)$/i);
      if (roleMatch) {
        // Save previous message if we have content
        if (currentContent.trim()) {
          messages.push({
            role: currentRole,
            content: currentContent.trim(),
            name: currentRole === 'user' ? 'User' : 'Assistant'
          });
        }
        
        // Start new message
        currentRole = roleMatch[1].toLowerCase();
        currentContent = roleMatch[2];
        currentName = currentRole === 'user' ? 'User' : 'Assistant';
      } else {
        // Continue current message
        currentContent += (currentContent ? '\n' : '') + line;
      }
    }
    
    // Add final message
    if (currentContent.trim()) {
      messages.push({
        role: currentRole,
        content: currentContent.trim(),
        name: currentName
      });
    }
    
    // If no role indicators found, treat entire content as user message
    if (messages.length === 0 && content.trim()) {
      messages.push({
        role: 'user',
        content: content.trim(),
        name: 'User'
      });
    }
    
    return messages;
  }

  /**
   * Initialize GetZep configuration for this agent
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if agent has graph enabled
      const { data: agent } = await this.supabase
        .from('agents')
        .select('metadata, user_id')
        .eq('id', this.agentId)
        .maybeSingle();
      
      if (!agent?.metadata?.settings?.use_account_graph) {
        console.log('[GetZepSemantic] Graph not enabled for agent');
        return false;
      }

      // Get account graph
      const { data: accountGraph } = await this.supabase
        .from('account_graphs')
        .select('id, connection_id')
        .eq('user_id', agent.user_id)
        .maybeSingle();
      
      if (!accountGraph?.connection_id) {
        console.log('[GetZepSemantic] No account graph configured');
        return false;
      }

      // Get connection details
      const { data: connection } = await this.supabase
        .from('user_oauth_connections')
        .select('vault_access_token_id, connection_metadata')
        .eq('id', accountGraph.connection_id)
        .maybeSingle();
      
      if (!connection?.vault_access_token_id) {
        console.log('[GetZepSemantic] No GetZep connection found');
        return false;
      }

      // Decrypt API key
      const { data: apiKey } = await this.supabase.rpc('vault_decrypt', {
        vault_id: connection.vault_access_token_id
      });

      if (!apiKey) {
        console.error('[GetZepSemantic] Failed to decrypt API key');
        return false;
      }

      this.config = {
        apiKey: apiKey as string,
        projectId: connection.connection_metadata?.project_id,
        accountId: connection.connection_metadata?.account_id,
        userId: agent.user_id
      };

      console.log('[GetZepSemantic] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[GetZepSemantic] Initialization error:', error);
      return false;
    }
  }

  /**
   * Ingest content to GetZep knowledge graph
   * This runs completely independent of episodic memory
   */
  async ingest(content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.config) {
      const initialized = await this.initialize();
      if (!initialized) return;
    }

    try {
      console.log(`[GetZepSemantic] Ingesting content (${content.length} chars)`);
      
      // Try SDK with correct v3 API
      try {
        const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
        const ZepClient = (mod as any)?.ZepClient || (mod as any)?.default;
        
        if (ZepClient) {
          const client = new ZepClient({ 
            apiKey: this.config!.apiKey
          });
          
          // Use thread-based API - create a user-based thread ID for consistency
          const threadId = `user_${this.config!.userId}_graph`;
          
          // Parse content into messages format
          const messages = this.parseContentToMessages(content, metadata);
          
          if (client?.thread?.addMessages && messages.length > 0) {
            try {
              // First, try to add messages directly
              const episodeUuids = await client.thread.addMessages(threadId, { messages });
              console.log(`[GetZepSemantic] ✅ Ingested ${messages.length} messages via SDK:`, episodeUuids);
              return;
            } catch (addError: any) {
              if (addError?.statusCode === 404 && addError?.body?.message?.includes('thread not found')) {
                console.log(`[GetZepSemantic] Thread ${threadId} not found, creating it first...`);
                
                // Create the thread first, then add messages
                try {
                  // The create method expects an object with threadId and userId
                  await client.thread.create({ 
                    threadId: threadId, 
                    userId: this.config!.userId 
                  });
                  console.log(`[GetZepSemantic] ✅ Created thread ${threadId}`);
                  
                  // Now try adding messages again
                  const episodeUuids = await client.thread.addMessages(threadId, { messages });
                  console.log(`[GetZepSemantic] ✅ Ingested ${messages.length} messages via SDK after creating thread:`, episodeUuids);
                  return;
                } catch (createError: any) {
                  console.error(`[GetZepSemantic] Failed to create thread ${threadId}:`, createError?.message);
                  throw createError;
                }
              } else {
                throw addError;
              }
            }
          }
        }
      } catch (sdkError) {
        console.warn('[GetZepSemantic] SDK ingestion failed:', sdkError);
      }

      // Fallback: Direct REST API is not available in GetZep v3
      // The SDK is the primary way to interact with GetZep
      console.error('[GetZepSemantic] SDK is required for GetZep v3 - REST fallback not available');
    } catch (error) {
      console.error('[GetZepSemantic] Ingestion error:', error);
    }
  }

  /**
   * Retrieve relevant context from GetZep knowledge graph
   * This runs completely independent of episodic memory
   */
  async retrieve(query: string, limit: number = 10): Promise<any[]> {
    if (!this.config) {
      const initialized = await this.initialize();
      if (!initialized) return [];
    }

    try {
      console.log(`[GetZepSemantic] Retrieving for query: "${query.substring(0, 50)}..."`);
      
      // Try SDK with correct v3 API
      try {
        const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
        const ZepClient = (mod as any)?.ZepClient || (mod as any)?.default;
        
        if (ZepClient) {
          const client = new ZepClient({ 
            apiKey: this.config!.apiKey
          });
          
          // Use thread-based API - same thread ID as ingestion
          const threadId = `user_${this.config!.userId}_graph`;
          
          if (client?.thread?.getUserContext) {
            try {
              const memory = await client.thread.getUserContext(threadId);
              
              if (memory?.context) {
                console.log(`[GetZepSemantic] Retrieved context via SDK (${memory.context.length} chars)`);
                
                // Return context as structured memory items
                return [{
                  id: `context_${Date.now()}`,
                  content: {
                    definition: memory.context,
                    concept: 'User Context',
                    confidence: 0.8
                  },
                  metadata: {
                    source: 'getzep_context',
                    thread_id: threadId,
                    retrieved_at: new Date().toISOString()
                  }
                }];
              }
            } catch (contextError: any) {
              if (contextError?.statusCode === 404) {
                console.log(`[GetZepSemantic] Thread ${threadId} not found during retrieval - no context available yet`);
                return [];
              } else {
                throw contextError;
              }
            }
          }
        }
      } catch (sdkError) {
        console.warn('[GetZepSemantic] SDK retrieval failed:', sdkError);
      }

      // Fallback: Direct REST API is not available in GetZep v3
      // The SDK is the primary way to interact with GetZep
      console.error('[GetZepSemantic] SDK is required for GetZep v3 - REST fallback not available');
      return [];
    } catch (error) {
      console.error('[GetZepSemantic] Retrieval error:', error);
      return [];
    }
  }
}
