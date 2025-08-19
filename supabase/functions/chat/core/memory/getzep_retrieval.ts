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

    // Initialize GetZep client
    const client = new ZepClient({ apiKey: apiKey as string });

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
        console.error('[GetZepRetrieval] Fallback also failed:', fallbackError);
      }
    }

    return [];

  } catch (error: any) {
    console.error('[GetZepRetrieval] Error searching knowledge graph:', error?.message || error);
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
