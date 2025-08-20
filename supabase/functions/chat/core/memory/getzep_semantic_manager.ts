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
      
      // Try SDK first
      try {
        const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
        const ZepClient = (mod as any)?.ZepClient || (mod as any)?.default;
        
        if (ZepClient) {
          const client = new ZepClient({ 
            apiKey: this.config!.apiKey,
            projectId: this.config!.projectId,
            accountId: this.config!.accountId
          });
          
          if (client?.graph?.add) {
            const episode = await client.graph.add({
              userId: this.config!.userId,
              type: 'text',
              data: content,
              metadata: metadata || {}
            });
            console.log(`[GetZepSemantic] ✅ Ingested via SDK: ${episode?.uuid}`);
            return;
          }
        }
      } catch (sdkError) {
        console.warn('[GetZepSemantic] SDK ingestion failed, trying REST:', sdkError);
      }

      // Fallback to REST API - use v3 endpoint with correct auth
      const headers: Record<string, string> = {
        'Api-Key': this.config!.apiKey,
        'Content-Type': 'application/json',
      };
      
      // GetZep v3 uses X-Project-Id header
      if (this.config!.projectId) {
        headers['X-Project-Id'] = this.config!.projectId;
      }

      const response = await fetch('https://api.getzep.com/v3/graph/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: this.config!.userId,
          content,
          metadata: metadata || {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[GetZepSemantic] ✅ Ingested via REST: ${result?.uuid}`);
      } else {
        const error = await response.text();
        console.error(`[GetZepSemantic] REST ingestion failed (${response.status}):`, error);
      }
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
      
      // Try SDK first
      try {
        const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
        const ZepClient = (mod as any)?.ZepClient || (mod as any)?.default;
        
        if (ZepClient) {
          const client = new ZepClient({ 
            apiKey: this.config!.apiKey,
            projectId: this.config!.projectId,
            accountId: this.config!.accountId
          });
          
          if (client?.memory?.searchMemory) {
            const results = await client.memory.searchMemory(
              this.config!.userId,
              { text: query, limit, searchType: 'similarity' }
            );
            
            if (results?.results) {
              console.log(`[GetZepSemantic] Retrieved ${results.results.length} results via SDK`);
              return results.results;
            }
          }
        }
      } catch (sdkError) {
        console.warn('[GetZepSemantic] SDK retrieval failed, trying REST:', sdkError);
      }

      // Fallback to REST API - use v3 search endpoint with correct auth
      const headers: Record<string, string> = {
        'Api-Key': this.config!.apiKey,
        'Content-Type': 'application/json',
      };
      
      // GetZep v3 uses X-Project-Id header
      if (this.config!.projectId) {
        headers['X-Project-Id'] = this.config!.projectId;
      }

      const response = await fetch(`https://api.getzep.com/v3/memory/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: this.config!.userId,
          text: query,
          limit
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[GetZepSemantic] Retrieved ${data?.results?.length || 0} results via REST`);
        return data?.results || [];
      } else {
        const error = await response.text();
        console.error(`[GetZepSemantic] REST retrieval failed (${response.status}):`, error);
        return [];
      }
    } catch (error) {
      console.error('[GetZepSemantic] Retrieval error:', error);
      return [];
    }
  }
}
