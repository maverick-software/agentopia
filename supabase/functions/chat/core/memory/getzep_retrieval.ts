// GetZep Knowledge Graph Retrieval
// Handles retrieval of semantic knowledge from GetZep cloud service

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';

export interface GetZepSearchResult {
  content: string;
  score: number;
  metadata?: Record<string, any>;
  source?: string;
}

/**
 * Searches GetZep knowledge graph for relevant semantic information
 * @param query - The search query
 * @param userId - The user ID for the graph
 * @param supabase - Supabase client
 * @returns Array of relevant semantic results
 */
export async function searchGetZepKnowledgeGraph(
  query: string,
  userId: string,
  supabase: SupabaseClient
): Promise<GetZepSearchResult[]> {
  try {
    // Load Zep SDK dynamically via esm.sh (Deno-friendly)
    let ZepClientLocal: any = null;
    try {
      const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
      ZepClientLocal = (mod as any)?.default || (mod as any)?.ZepClient || mod;
    } catch (sdkErr) {
      console.warn('[GetZepRetrieval] Zep SDK import failed; skipping retrieval:', (sdkErr as any)?.message || sdkErr);
      return [];
    }

    // Get the user's GetZep connection
    const { data: provider } = await supabase
      .from('oauth_providers')
      .select('id')
      .eq('name', 'getzep')
      .single();

    if (!provider) {
      console.warn('[GetZepRetrieval] GetZep provider not found');
      return [];
    }

    const { data: connection } = await supabase
      .from('user_oauth_connections')
      .select('id, vault_access_token_id, connection_metadata')
      .eq('oauth_provider_id', provider.id)
      .eq('user_id', userId)
      .eq('connection_status', 'active')
      .maybeSingle();

    if (!connection?.vault_access_token_id) {
      console.log('[GetZepRetrieval] No active GetZep connection for user');
      return [];
    }

    // Decrypt the API key
    const { data: apiKey, error: decryptError } = await supabase.rpc('vault_decrypt', {
      vault_id: connection.vault_access_token_id
    });

    if (decryptError || !apiKey) {
      console.error('[GetZepRetrieval] Failed to decrypt API key:', decryptError);
      return [];
    }

    // Initialize GetZep client (guard API shape)
    const client = new ZepClientLocal({ apiKey: apiKey as string });
    if (!client || !client.memory || typeof client.memory.searchMemory !== 'function') {
      console.warn('[GetZepRetrieval] Zep client missing memory API; using REST fallback');
      try {
        const baseUrl = 'https://api.getzep.com/v3';
        const body = {
          user_id: userId,
          text: query,
          limit: 10,
        } as any;
        // Optional metadata headers if present
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        try {
          const { data: connMeta } = await supabase
            .from('user_oauth_connections')
            .select('connection_metadata')
            .eq('oauth_provider_id', provider.id)
            .eq('user_id', userId)
            .maybeSingle();
          const meta = (connMeta as any)?.connection_metadata || {};
          // GetZep v3 uses X-Project-Id header
          if (meta.project_id) headers['X-Project-Id'] = String(meta.project_id);
        } catch (_) {}

        const resp = await fetch(`${baseUrl}/memory/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          console.warn('[GetZepRetrieval] REST search failed:', resp.status);
          return [];
        }
        const json: any = await resp.json();
        const results = Array.isArray(json?.results) ? json.results : (Array.isArray(json) ? json : []);
        return results
          .map((r: any) => ({
            content: r?.summary || r?.content || '',
            score: r?.score || r?.dist || 0,
            metadata: r?.metadata || {},
            source: 'getzep_rest',
          }))
          .filter((r: any) => r.content);
      } catch (restErr) {
        console.warn('[GetZepRetrieval] REST fallback error:', (restErr as any)?.message || restErr);
        return [];
      }
    }

    // Search the user's knowledge graph
    // GetZep v3 uses memory.searchMemory for semantic search
    try {
      console.log(`[GetZepRetrieval] Searching graph for user ${userId} with query: "${query.substring(0, 50)}..."`);
      
      // Search for relevant memories
      // Note: GetZep requires a session/thread ID, we use the user ID as a session identifier
      const searchResults = await client.memory.searchMemory(
        userId, // session ID
        {
          text: query,
          limit: 10,
          searchType: 'similarity', // or 'mmr' for maximal marginal relevance
        }
      );

      if (!searchResults || !searchResults.results) {
        console.log('[GetZepRetrieval] No results from GetZep search');
        return [];
      }

      // Format results for consumption
      const formattedResults: GetZepSearchResult[] = searchResults.results
        .map((result: any) => ({
          content: result.message?.content || result.content || '',
          score: result.score || result.dist || 0,
          metadata: result.metadata || {},
          source: 'getzep_knowledge_graph'
        }))
        .filter((r: GetZepSearchResult) => r.content && r.score > 0.5);

      console.log(`[GetZepRetrieval] Found ${formattedResults.length} relevant results`);
      return formattedResults;

    } catch (searchError: any) {
      // If search fails, try alternative methods
      console.warn('[GetZepRetrieval] Search failed, trying alternative:', searchError?.message);
      
      // Try getting recent memories as fallback
      try {
        if (!client.memory || typeof client.memory.getMemory !== 'function') {
          throw new Error('memory.getMemory not available');
        }
        const memories = await client.memory.getMemory(userId, { limit: 5 });
        if (memories?.messages) {
          return memories.messages
            .map((msg: any) => ({
              content: msg.content || '',
              score: 0.7, // Default relevance score
              metadata: msg.metadata || {},
              source: 'getzep_recent_memories'
            }))
            .filter((r: GetZepSearchResult) => r.content);
        }
      } catch (fallbackError) {
        console.warn('[GetZepRetrieval] Fallback also failed:', (fallbackError as any)?.message || fallbackError);
      }
    }

    return [];

  } catch (error: any) {
    console.warn('[GetZepRetrieval] Error searching knowledge graph:', error?.message || error);
    return [];
  }
}

/**
 * Extracts key concepts from text for knowledge graph queries
 * @param text - The text to extract concepts from
 * @returns Array of concept strings
 */
export function extractConcepts(text: string): string[] {
  // Simple concept extraction - remove common words and return key terms
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 
    'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 
    'from', 'be', 'are', 'was', 'were', 'been', 'tell', 'me', 'about',
    'what', 'who', 'when', 'where', 'why', 'how', 'can', 'could', 'would',
    'should', 'may', 'might', 'will', 'shall', 'must', 'do', 'does', 'did',
    'have', 'has', 'had', 'get', 'gets', 'got', 'make', 'makes', 'made'
  ]);
  
  return words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5);
}
