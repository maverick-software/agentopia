// GetZep Knowledge Graph Retrieval - v3 API Updated
// Handles retrieval of semantic knowledge from GetZep cloud service using thread.getUserContext

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

    // Initialize GetZep client with v3 API - UPDATED VERSION
    const client = new ZepClientLocal({ apiKey: apiKey as string });
    
    // FORCE CACHE REFRESH - Use thread-based API only
    const threadId = `user_${userId}_graph`;
    
    console.log(`[GetZepRetrieval] UPDATED: Using v3 thread API for user ${userId}`);
    
    if (!client || !client.thread || typeof client.thread.getUserContext !== 'function') {
      console.error('[GetZepRetrieval] CRITICAL: GetZep v3 SDK missing thread.getUserContext - this should not happen with latest SDK');
      return [];
    }

    // UPDATED: Get user context from GetZep v3 thread API ONLY
    try {
      console.log(`[GetZepRetrieval] UPDATED VERSION: Getting context for user ${userId} with thread ${threadId}`);
      
      // Get the user's context from their thread using v3 API
      const memory = await client.thread.getUserContext(threadId);

      if (!memory || !memory.context) {
        console.log('[GetZepRetrieval] No context available from GetZep thread');
        return [];
      }

      // Return context as a single structured result
      const contextResult: GetZepSearchResult = {
        content: memory.context,
        score: 0.8, // High relevance for user context
        metadata: {
          thread_id: threadId,
          retrieved_at: new Date().toISOString(),
          context_length: memory.context.length,
          api_version: 'v3_thread'
        },
        source: 'getzep_user_context_v3'
      };

      console.log(`[GetZepRetrieval] ✅ UPDATED: Retrieved context (${memory.context.length} chars) via v3 thread API`);
      return [contextResult];

    } catch (contextError: any) {
      if (contextError?.statusCode === 404) {
        console.log(`[GetZepRetrieval] Thread ${threadId} not found during retrieval - no context available yet`);
        return [];
      } else {
        console.error('[GetZepRetrieval] UPDATED: Failed to get user context via v3 thread API:', contextError?.message);
        return [];
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
