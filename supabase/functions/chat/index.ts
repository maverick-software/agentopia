import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { RateLimiter } from 'npm:limiter@3.0.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import { MCPManager } from './manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from './types.ts';

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
        timeout_ms,
        max_retries,
        retry_backoff_ms,
        priority,
        is_active,
        server:mcp_servers (
          id,
          name,
          endpoint_url,
          vault_api_key_id
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_active', true);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')){
          console.error(`Database Schema Mismatch: Check columns in mcp_configurations select. Error: ${error.message}`);
      } else {
          console.error('Error fetching MCP configurations:', JSON.stringify(error, null, 2));
      }
      return [];
    }

    if (!configs?.length) {
      console.log(`No active MCP configurations found for agent ${agentId}`);
      return [];
    }

    // Filter out entries where server might be null (shouldn't happen with inner join default)
    const validConfigs = configs.filter(config => !!config.server);

    // Transform to MCPServerConfig format, now including all fields
    return validConfigs.map((config: any): MCPServerConfig => ({
      id: config.server.id,
      config_id: config.id,
      name: config.server.name,
      endpoint_url: config.server.endpoint_url,
      vault_api_key_id: config.server.vault_api_key_id,
      timeout_ms: config.timeout_ms ?? 30000,
      max_retries: config.max_retries ?? 1,
      retry_backoff_ms: config.retry_backoff_ms ?? 100,
      priority: config.priority ?? 0,
      is_active: config.is_active,
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

// Assume ChatRoomMember and MemberType are defined appropriately elsewhere or define inline
// If reusing frontend types isn't feasible, define simplified versions here:
type MemberType = 'user' | 'agent' | 'team';
interface BasicRoomMember {
    member_id: string; // uuid
    member_type: MemberType;
    // Add name/details if the worker sends them
}
interface ChatRequestBody {
    agentId: string;
    message: string;
    authorId?: string; // Keep if used elsewhere
    roomId?: string; // NEW
    channelId?: string; // NEW
    members?: BasicRoomMember[]; // NEW (Optional)
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
      let parsedBody: ChatRequestBody | null = null;
      let agentIdFromRequest: string | null = null;
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
        parsedBody = await req.json();
        // Destructure NEW fields
        const { agentId, message: userMessage, authorId, roomId, channelId, members } = parsedBody as ChatRequestBody;
        agentIdFromRequest = agentId;

        console.log("Received Payload Body:", JSON.stringify(parsedBody, null, 2));
        console.log(`Extracted - agentId: ${agentId}, roomId: ${roomId}, channelId: ${channelId}, userMessage: ${userMessage ? userMessage.substring(0, 50) + '...' : 'null'}`);

        if (!userMessage || !agentId) {
          throw new Error(`Invalid request format. UserMessage valid: ${!!userMessage}. AgentId valid: ${!!agentId}.`);
        }

        // Fetch agent details (ensure active column is included if needed by logic below)
        console.log(`[Agent: ${agentId}] Fetching agent details from database...`);
        const { data: agentData, error: agentFetchError } = await supabaseClient
          .from('agents')
          // Select all potentially relevant fields based on diagram/corrections
          .select('name, system_instructions, assistant_instructions, active')
          .eq('id', agentId)
          .single();

        if (agentFetchError || !agentData) {
          console.error(`[Agent: ${agentId}] Error fetching agent details: ${agentFetchError?.message || 'Agent not found'}`, { error: agentFetchError });
          // Return a specific error if agent details can't be fetched
          return new Response(
            JSON.stringify({ error: 'Internal Server Error: Could not retrieve agent configuration.' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        console.log(`[Agent: ${agentId}] Successfully fetched agent details. Name: ${agentData.name}`);
        const fetchedAgentName = agentData.name;
        // NOTE: fetchedPersonality was dropped from select, adjust if needed
        const fetchedSystemInstructions = agentData.system_instructions;
        const fetchedAssistantInstructions = agentData.assistant_instructions;
        // const fetchedIsActive = agentData.active; // If needed

        // Initialize context array for the LLM
        const contextMessages: ChatMessage[] = [];

        // --- NEW: Add Room/Channel/Member Context --- 
        if (roomId && channelId) {
            let roomContext = `You are currently in chat room ID ${roomId}, channel ID ${channelId}.`;
            // Optional: Add member info if provided
            if (members && members.length > 0) {
                // Basic member summary (adjust formatting as needed)
                const memberSummary = members
                    .map(m => `${m.member_type}:${m.member_id}`)
                    .join(', ');
                roomContext += ` Current members in the room include: ${memberSummary}.`;
            }
            contextMessages.push({ role: 'system', content: roomContext });
        }
        // --- END NEW Context ---

        // Add system message if provided
        if (fetchedSystemInstructions) {
          contextMessages.push({ role: 'system', content: fetchedSystemInstructions });
        }
        // Add assistant instructions if provided
        if (fetchedAssistantInstructions) {
          contextMessages.push({ role: 'system', content: fetchedAssistantInstructions });
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
                [{ role: 'user', content: userMessage, timestamp: new Date().toISOString() }], 
                agentId,
                fetchedAgentName, // Use fetched data
                "", // Personality removed, pass empty or adjust function
                fetchedSystemInstructions,
                fetchedAssistantInstructions
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
        const vectorContext = await getVectorSearchResults(userMessage, agentId);
        if (vectorContext) {
          contextMessages.push({ role: 'system', content: vectorContext });
        }

        // Add conversation messages (just the current user message for now)
        contextMessages.push({ role: 'user', content: userMessage });

        // Create chat completion stream
        console.log(`[Agent: ${agentId}] Calling OpenAI chat.completions.create (stream: false)...`);
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: contextMessages,
          temperature: 0.7,
          max_tokens: 500,
          stream: false,
        });

        // MODIFIED: Get the full response directly
        const fullResponse = completion.choices[0]?.message?.content || '';
        console.log(`[Agent: ${agentId}] Received full response from OpenAI. Length: ${fullResponse.length}`);

        // MODIFIED: Return a standard JSON response
        return new Response(
          JSON.stringify({ reply: fullResponse }), // Return full response in JSON
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json', // <--- CHANGED Content-Type
            },
            status: 200 // Explicitly set status to 200 OK
          }
        );

      } catch (error) { // Outer catch block
        console.error("Error processing request:", error);
        const agentIdForErrorLog = agentIdFromRequest;
        // --- Add error logging to database ---
        try {
            // Attempt to stringify the raw body if available, otherwise the parsed body
            let requestBodyString: string | null = null; // Initialize as string | null
            try {
                 requestBodyString = parsedBody ? JSON.stringify(parsedBody) : 'Could not read request body';
            } catch (stringifyError) {
                 requestBodyString = `Error stringifying request body: ${stringifyError.message}`;
            }
            
            await supabaseClient.from('function_errors').insert({ 
                function_name: 'chat',
                agent_id: agentIdForErrorLog,
                error_message: error.message,
                stack_trace: error.stack,
                request_body: requestBodyString
            });
        } catch (dbError) {
            console.error("Database error while storing interaction error:", dbError);
        }
        // --- END Add error logging ---
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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

  } catch (error) { // This is the outermost catch, unlikely to be hit unless server setup fails
    console.error("General Server Error:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});