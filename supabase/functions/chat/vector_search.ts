import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    source?: string;
    timestamp?: string;
  };
}

/**
 * Performs vector search using Pinecone to find relevant memories/context
 * @param message - The user's message to search for similar content
 * @param agentId - The ID of the agent to search datastores for
 * @param supabaseClient - Supabase client instance
 * @param openai - OpenAI client instance
 * @returns Formatted context string or null if no relevant results
 */
export async function getVectorSearchResults(
  message: string, 
  agentId: string,
  supabaseClient: SupabaseClient,
  openai: OpenAI
): Promise<string | null> {
  console.log(`[DEBUG] Starting vector search for agent ${agentId} with message: "${message.substring(0, 100)}..."`);
  
  try {
    const { data: connection, error: connectionError } = await supabaseClient
      .from('agent_datastores')
      .select(`
        datastore_id,
        datastores:datastore_id (
          id,
          type,
          config,
          similarity_metric,
          similarity_threshold,
          max_results
        )
      `)
      .eq('agent_id', agentId)
      .eq('datastores.type', 'pinecone')
      .single();

    if (connectionError) {
      console.error('Vector store connection error:', {
        error: connectionError,
        message: connectionError.message,
        details: connectionError.details,
        code: connectionError.code,
        agentId: agentId
      });
      
      // Check if it's a "no rows returned" error (agent has no Pinecone datastore)
      if (connectionError.code === 'PGRST116') {
        console.log(`[DEBUG] Agent ${agentId} has no Pinecone datastore connected`);
      }
      
      return null;
    }

    if (!connection?.datastores) {
      console.log(`[DEBUG] Agent ${agentId} has connection but no datastore object`);
      return null;
    }

    const datastore = connection.datastores;
    console.log(`[DEBUG] Found Pinecone datastore ${datastore.id} for agent ${agentId}`);
    console.log(`[DEBUG] Datastore config keys:`, Object.keys(datastore.config || {}));

    // Validate necessary config fields exist
    if (!datastore.config?.apiKey || !datastore.config?.region || !datastore.config?.indexName) {
        console.error(`[DEBUG] Incomplete Pinecone configuration found in datastore ${datastore.id}:`, {
          hasApiKey: !!datastore.config?.apiKey,
          hasRegion: !!datastore.config?.region, 
          hasIndexName: !!datastore.config?.indexName,
          config: datastore.config
        });
        return null;
    }

    console.log(`[DEBUG] Pinecone config validated for datastore ${datastore.id}`);

    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      encoding_format: 'float',
    });

    // Instantiate Pinecone client with ONLY required fields
    const pinecone = new Pinecone({
      apiKey: datastore.config.apiKey, 
      environment: datastore.config.region 
    });

    // Get index name separately
    const indexName = datastore.config.indexName;
    const index = pinecone.Index(indexName);

    // Query vector store
    console.log(`[DEBUG] Querying Pinecone index ${indexName} with topK=${datastore.max_results}, threshold=${datastore.similarity_threshold}`);
    
    const results = await index.query({
      vector: embedding.data[0].embedding,
      topK: datastore.max_results || 10,
      includeMetadata: true,
      includeValues: false,
    });

    console.log(`[DEBUG] Pinecone returned ${results.matches?.length || 0} matches`);
    
    if (results.matches?.length) {
      console.log(`[DEBUG] Top match scores:`, results.matches.slice(0, 3).map(m => ({
        id: m.id,
        score: m.score,
        source: m.metadata?.source
      })));
    }

    if (!results.matches?.length) {
      console.log(`[DEBUG] No matches found in Pinecone index ${indexName}`);
      return null;
    }

    // Filter and format results
    const relevantResults = results.matches
      .filter(match => {
        const isRelevant = match.score >= (datastore.similarity_threshold || 0.7);
        if (!isRelevant) {
          console.log(`[DEBUG] Filtered out match with score ${match.score} (below threshold ${datastore.similarity_threshold || 0.7})`);
        }
        return isRelevant;
      })
      .map((match) => {
        const metadata = match.metadata as VectorSearchResult['metadata'];
        return {
          text: metadata.text,
          score: match.score,
          source: metadata.source,
          timestamp: metadata.timestamp,
        };
      });

    console.log(`[DEBUG] After filtering: ${relevantResults.length} relevant results found`);

    if (!relevantResults.length) {
      console.log(`[DEBUG] No relevant results after filtering. Original matches: ${results.matches?.length}, threshold: ${datastore.similarity_threshold || 0.7}`);
      return null;
    }

    // Format context message
    console.log(`[DEBUG] Returning ${relevantResults.length} memories to chat context`);
    const memories = relevantResults
      .map(result => {
        let memory = `Memory (similarity: ${(result.score * 100).toFixed(1)}%):\n${result.text}`;
        if (result.source) {
          memory += `\nSource: ${result.source}`;
        }
        if (result.timestamp) {
          memory += `\nTimestamp: ${result.timestamp}`;
        }
        return memory;
      })
      .join('\n\n');

    return `Here are some relevant memories that might help with your response:\n\n${memories}\n\nPlease consider these memories when formulating your response, but maintain a natural conversation flow.`;
  } catch (error) {
    console.error('Vector search error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return null;
  }
} 