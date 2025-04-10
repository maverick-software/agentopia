import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { RateLimiter } from 'npm:limiter@3.0.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import { MCPManager } from '../../src/lib/mcp/manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from '../../src/lib/mcp/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    source?: string;
    timestamp?: string;
  };
}

// Rate limiter: 30 requests per minute
const limiter = new RateLimiter({
  tokensPerInterval: 30,
  interval: 'minute',
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: { persistSession: false },
  }
);

async function getVectorSearchResults(message: string, agentId: string): Promise<string | null> {
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
        details: connectionError.details
      });
      return null;
    }

    if (!connection?.datastores) {
      return null;
    }

    const datastore = connection.datastores;

    // Validate necessary config fields exist
    if (!datastore.config?.apiKey || !datastore.config?.region || !datastore.config?.indexName) {
        console.error('Incomplete Pinecone configuration found in datastore:', datastore.id);
        return null;
    }

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
    const results = await index.query({
      vector: embedding.data[0].embedding,
      topK: datastore.max_results,
      includeMetadata: true,
      includeValues: false,
    });

    if (!results.matches?.length) {
      return null;
    }

    // Filter and format results
    const relevantResults = results.matches
      .filter(match => match.score >= datastore.similarity_threshold)
      .map((match) => {
        const metadata = match.metadata as VectorSearchResult['metadata'];
        return {
          text: metadata.text,
          score: match.score,
          source: metadata.source,
          timestamp: metadata.timestamp,
        };
      });

    if (!relevantResults.length) {
      return null;
    }

    // Format context message
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

// MCP-related interfaces
interface MCPVaultResponse {
  key: string;
  version: number;
  created_at: string;
}

interface MCPConfigurationWithServer {
  id: number;
  agent_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  timeout_ms: number;
  max_retries: number;
  retry_backoff_ms: number;
  server: {
    id: number;
    endpoint_url: string;
    vault_api_key_id: string | null;
  };
}

/**
 * Fetches active MCP configurations for an agent, including server details
 */
async function getMCPConfigurations(agentId: string): Promise<MCPServerConfig[]> {
  try {
    const { data: configs, error } = await supabaseClient
      .from('mcp_configurations')
      .select(`
        id,
        agent_id,
        name,
        is_active,
        priority,
        timeout_ms,
        max_retries,
        retry_backoff_ms,
        server:mcp_servers (
          id,
          endpoint_url,
          vault_api_key_id
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error fetching MCP configurations:', error);
      return [];
    }

    if (!configs?.length) {
      console.log(`No active MCP configurations found for agent ${agentId}`);
      return [];
    }

    // Transform to MCPServerConfig format
    return configs.map((config: MCPConfigurationWithServer): MCPServerConfig => ({
      id: config.server.id,
      config_id: config.id,
      name: config.name,
      endpoint_url: config.server.endpoint_url,
      vault_api_key_id: config.server.vault_api_key_id,
      timeout_ms: config.timeout_ms,
      max_retries: config.max_retries,
      retry_backoff_ms: config.retry_backoff_ms,
      priority: config.priority,
      is_active: config.is_active
    }));
  } catch (error) {
    console.error('Error in getMCPConfigurations:', error);
    return [];
  }
}

/**
 * Retrieves an API key from Supabase Vault
 */
async function getVaultAPIKey(vaultKeyId: string): Promise<string | null> {
  if (!vaultKeyId) {
    console.warn('getVaultAPIKey: No vault key ID provided, cannot retrieve key.');
    return null;
  }

  try {
    console.log(`getVaultAPIKey: Attempting to retrieve secret for vault ID: ${vaultKeyId}`);
    const { data: secretData, error } = await supabaseClient
      .rpc('get_secret', { secret_id: vaultKeyId })
      .single();

    if (error) {
      console.error(`getVaultAPIKey: Error retrieving secret from vault (ID: ${vaultKeyId}):`, error);
      return null;
    }

    const vaultResponse = secretData as MCPVaultResponse;
    if (vaultResponse?.key) {
      console.log(`getVaultAPIKey: Successfully retrieved secret for vault ID: ${vaultKeyId}`);
      return vaultResponse.key;
    } else {
      console.warn(`getVaultAPIKey: Secret retrieved but key was null or empty for vault ID: ${vaultKeyId}`);
      return null;
    }
  } catch (error) {
    console.error(`getVaultAPIKey: Exception during secret retrieval for vault ID: ${vaultKeyId}:`, error);
    return null;
  }
}

/**
 * Prepares context data for MCP servers
 */
async function prepareMCPContext(
  messages: ChatMessage[],
  agentId: string,
  agentName: string,
  agentPersonality: string,
  systemInstructions?: string,
  assistantInstructions?: string
): Promise<AgentopiaContextData[]> {
  const contextData: AgentopiaContextData[] = [];

  // Add agent context
  contextData.push({
    type: 'agentContext',
    id: agentId,
    name: agentName,
    personality: agentPersonality,
    systemInstructions,
    assistantInstructions
  });

  // Add conversation history
  if (messages.length > 0) {
    contextData.push({
      type: 'conversationHistory',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString()
      }))
    });
  }

  // Add latest user input (last user message)
  const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
  if (lastUserMessage) {
    contextData.push({
      type: 'userInput',
      content: lastUserMessage.content,
      timestamp: lastUserMessage.timestamp || new Date().toISOString()
    });
  }

  return contextData;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle Health Check GET request
    if (req.method === 'GET') {
      // Basic health check - can add more checks later if needed (e.g., OpenAI connectivity)
      const url = new URL(req.url);
      if (url.pathname.endsWith('/health')) { // Check if it's the health endpoint
        return new Response(JSON.stringify({ status: 'healthy' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      // If GET but not health, return 404 or 405
      return new Response(JSON.stringify({ error: 'Not Found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
      });
    }

    // Handle Chat POST request
    if (req.method === 'POST') {
      try {
        console.log('Chat POST request received');
        // Validate OpenAI API key
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiKey) {
          throw new Error('OpenAI API key not configured');
        }

        // Check rate limit
        const remainingRequests = await limiter.removeTokens(1);
        if (remainingRequests < 0) {
          return new Response(
            JSON.stringify({ error: 'Too many requests. Please try again later.' }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Parse request body
        const { messages, agentId, agentName, agentPersonality, systemInstructions, assistantInstructions } = await req.json();

        // Validate required fields
        if (!messages || !Array.isArray(messages) || !agentId) {
          throw new Error('Invalid request format');
        }

        // Initialize context array for the LLM
        const contextMessages: ChatMessage[] = [];

        // Add system message if provided
        if (systemInstructions) {
          contextMessages.push({ role: 'system', content: systemInstructions });
        }

        // Add assistant instructions if provided
        if (assistantInstructions) {
          contextMessages.push({ role: 'system', content: assistantInstructions });
        }

        // Process MCP context if available
        let mcpContext = '';
        let mcpErrors: any[] = []; // Capture MCP errors for logging
        try {
          // Fetch MCP configurations
          console.log(`[Agent: ${agentId}] Fetching MCP configurations...`);
          const mcpConfigs = await getMCPConfigurations(agentId);

          if (mcpConfigs.length > 0) {
            console.log(`[Agent: ${agentId}] Found ${mcpConfigs.length} active MCP configurations. Resolving API keys...`);

            // Resolve API keys from vault
            const configsWithKeys = await Promise.all(
              mcpConfigs.map(async (config) => {
                if (config.vault_api_key_id) {
                  console.log(`[Agent: ${agentId}, Config: ${config.config_id}] Attempting to get API key from vault ID: ${config.vault_api_key_id}`);
                  const apiKey = await getVaultAPIKey(config.vault_api_key_id);
                  if (apiKey) {
                    console.log(`[Agent: ${agentId}, Config: ${config.config_id}] Successfully retrieved API key from vault.`);
                    // IMPORTANT: Do NOT log the key itself
                    return {
                      ...config,
                      api_key: apiKey
                    };
                  } else {
                      console.warn(`[Agent: ${agentId}, Config: ${config.config_id}] Failed to retrieve API key from vault ID: ${config.vault_api_key_id}. Skipping this server.`);
                      mcpErrors.push({ serverId: config.id, error: `Failed to retrieve API key from vault ID: ${config.vault_api_key_id}` });
                      return null;
                  }
                }
                // If no vault_api_key_id, assume public or no auth needed
                console.log(`[Agent: ${agentId}, Config: ${config.config_id}] No vault API key ID specified.`);
                return { ...config, api_key: null }; // Pass null if no key needed/specified
              })
            );

            // Filter out configs where key retrieval failed (already logged warning/error)
            const validConfigs = configsWithKeys.filter((config): config is MCPServerConfig & { api_key: string | null } =>
              config !== null
            );

            if (validConfigs.length > 0) {
              console.log(`[Agent: ${agentId}] Preparing MCP context for ${validConfigs.length} servers.`);
              // Prepare context data for MCP
              const contextData = await prepareMCPContext(
                messages,
                agentId,
                agentName,
                agentPersonality,
                systemInstructions,
                assistantInstructions
              );

              // Initialize MCPManager and process context
              console.log(`[Agent: ${agentId}] Initializing MCPManager and processing context...`);
              const mcpManager = new MCPManager(validConfigs); // Pass configs with potentially null keys
              const mcpResults = await mcpManager.processContext(contextData);

              // Clean up MCP connections
              console.log(`[Agent: ${agentId}] Disconnecting MCP clients...`);
              mcpManager.disconnectAll();

              // Format MCP results for LLM context
              if (mcpResults.resources.length > 0) {
                console.log(`[Agent: ${agentId}] Received ${mcpResults.resources.length} resources from MCP servers.`);
                mcpContext = 'External Context from MCP Servers:\n\n' +
                  mcpResults.resources
                    .map(resource => `${resource.type} (${resource.id}):\n${JSON.stringify(resource.content)}`) // Stringify content for logging
                    .join('\n\n');

                // Add MCP context as a system message
                contextMessages.push({
                  role: 'system',
                  content: mcpContext
                });
              }

              // Log any MCP errors
              if (mcpResults.errors.length > 0) {
                console.warn(`[Agent: ${agentId}] MCP processing errors encountered:`, mcpResults.errors);
                mcpErrors.push(...mcpResults.errors); // Add manager errors to log
              }
              console.log(`[Agent: ${agentId}] Finished processing MCP context.`);
            } else {
              console.log(`[Agent: ${agentId}] No valid MCP configurations remain after API key resolution.`);
            }
          } else {
             console.log(`[Agent: ${agentId}] No active MCP configurations found.`);
          }
        } catch (mcpProcessingError) {
          console.error(`[Agent: ${agentId}] Uncaught error during MCP context processing:`, mcpProcessingError);
          mcpErrors.push({ error: `Uncaught MCP processing error: ${mcpProcessingError.message}` });
          // Continue without MCP context on error
        }

        // Get vector search results
        const vectorContext = await getVectorSearchResults(messages[messages.length - 1].content, agentId);
        if (vectorContext) {
          contextMessages.push({ role: 'system', content: vectorContext });
        }

        // Add conversation messages
        contextMessages.push(...messages);

        // Create chat completion stream
        console.log('Calling OpenAI chat.completions.create...');
        const stream = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: contextMessages,
          temperature: 0.7,
          max_tokens: 500,
          stream: true,
        });

        // Create and configure the stream response
        const responseStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let fullResponse = '';

            try {
              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  fullResponse += content;
                  controller.enqueue(encoder.encode(content));
                }
              }
            } catch (error) {
              console.error('Error during streaming:', error);
              // Encode error as SSE data
              const errorMessage = JSON.stringify({
                error: 'Error during streaming',
                details: error.message
              });
              controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
            } finally {
              // Store the interaction in the database
              try {
                console.log(`[Agent: ${agentId}] Storing interaction in database...`);
                const { error: insertError } = await supabaseClient
                  .from('agent_interactions')
                  .insert({
                    agent_id: agentId,
                    user_message: messages[messages.length - 1].content,
                    assistant_response: fullResponse,
                    vector_context: vectorContext || null,
                    mcp_context: mcpContext || null,
                    // Store stringified errors
                    error: mcpErrors.length > 0 ? JSON.stringify(mcpErrors) : null
                  });

                if (insertError) {
                  console.error(`[Agent: ${agentId}] Error storing interaction:`, insertError);
                } else {
                  console.log(`[Agent: ${agentId}] Interaction stored successfully.`);
                }
              } catch (dbError) {
                console.error(`[Agent: ${agentId}] Database error storing interaction:`, dbError);
              }

              controller.close();
            }
          },

          cancel(reason) {
            console.log('Stream cancelled:', reason);
          },
        });

        return new Response(responseStream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });

      } catch (error) {
        console.error('Error processing request:', error);

        // Determine error type and appropriate status code
        let status = 500;
        let errorMessage = 'Internal server error';

        if (error.message === 'Invalid request format' || error.message === 'Missing required parameters') {
          status = 400;
          errorMessage = error.message;
        } else if (error.message === 'Agent not found') {
          status = 404;
          errorMessage = error.message;
        } else if (error.message.includes('OpenAI API')) {
          status = 502;
          errorMessage = 'Error communicating with OpenAI';
        } else if (error.message.includes('MCP')) {
          // Log MCP errors but don't fail the request
          console.warn('MCP processing error:', error);
          status = 200; // Continue with partial success
          errorMessage = 'Processed without MCP context';
        }

        // Store the error in the database if we have an agent ID
        try {
          if (agentId) { // Only store if we have an agentId
            console.log(`[Agent: ${agentId}] Storing interaction error in database: ${errorMessage}`);
            const { error: insertError } = await supabaseClient
              .from('agent_interactions')
              .insert({
                agent_id: agentId,
                user_message: messages?.[messages.length - 1]?.content,
                assistant_response: null,
                vector_context: null,
                mcp_context: null, // No MCP context if request failed before/during processing
                // Store the primary error message and any MCP errors encountered before failure
                error: JSON.stringify({ mainError: errorMessage, mcpErrors: mcpErrors })
              });

            if (insertError) {
              console.error(`[Agent: ${agentId}] Error storing interaction error details:`, insertError);
            }
          }
        } catch (dbError) {
          console.error('Database error while storing interaction error:', dbError);
        }

        return new Response(
          JSON.stringify({
            error: errorMessage,
            details: error.message
          }),
          {
            status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Handle unsupported methods
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});