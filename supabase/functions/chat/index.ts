import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { RateLimiter } from 'npm:limiter@3.0.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import { MCPManager } from './manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from './types.ts';
import { ContextBuilder, ChatMessage, WorkspaceDetails as ImportedWorkspaceDetails, ContextSettings, BasicWorkspaceMember } from './context_builder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

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
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
});

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
    agentId: string | null; // Can be null if message is just from user
    message: string;
    authorId?: string; // Keep if used elsewhere
    workspaceId?: string; // NEW - ID of the workspace
    channelId?: string; // NEW - ID of the channel within the workspace
    // members?: BasicRoomMember[]; // REMOVE - We fetch this server-side
}

// Define the type for inserting messages into the database
interface ChatMessageInsertPayload {
  channel_id: string | null; // Can be null for direct messages
  content: string;
  sender_user_id: string | null;
  sender_agent_id: string | null;
}

/**
 * Fetches workspace details, members, and context settings.
 */
async function getWorkspaceDetails(workspaceId: string): Promise<ImportedWorkspaceDetails | null> {
  if (!workspaceId) {
    console.error('getWorkspaceDetails: workspaceId is required.');
    return null;
  }

  try {
    // Fetch workspace settings
    const { data: workspaceData, error: workspaceError } = await supabaseClient
      .from('workspaces')
      .select('id, name, context_window_size, context_window_token_limit')
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      console.error(`Error fetching workspace details for ${workspaceId}:`, workspaceError);
      return null;
    }
    if (!workspaceData) {
      console.warn(`Workspace not found: ${workspaceId}`);
      return null;
    }

    // Fetch members with their names
    // This query joins workspace_members with agents, user_profiles, and teams
    // to get names associated with each member type.
    const { data: membersData, error: membersError } = await supabaseClient
      .from('workspace_members')
      .select(`
        id,
        role,
        user_id,
        agent_id,
        team_id,
        user_profiles:user_id ( full_name ),
        agents:agent_id ( name ),
        teams:team_id ( name )
      `)
      .eq('workspace_id', workspaceId);

    if (membersError) {
      console.error(`Error fetching members for workspace ${workspaceId}:`, membersError);
      // Return workspace data even if members fail, but log the error
    }

    const members: BasicWorkspaceMember[] = (membersData || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      user_id: m.user_id,
      agent_id: m.agent_id,
      team_id: m.team_id,
      // Extract names from joined tables
      user_name: m.user_profiles?.full_name ?? null,
      agent_name: m.agents?.name ?? null,
      team_name: m.teams?.name ?? null,
    }));

    return {
      ...workspaceData,
      members: members,
    };

  } catch (error) {
    console.error(`Unexpected error in getWorkspaceDetails for ${workspaceId}:`, error);
    return null;
  }
}

// Fetches chat history - Returns array matching ChatMessage interface
async function getRelevantChatHistory(
    channelId: string | null, 
    userId: string | null, 
    targetAgentId: string | null, 
    limit: number
): Promise<ChatMessage[]> {
  if (limit <= 0) return [];
  console.log(`[getRelevantChatHistory] Attempting fetch - channelId: ${channelId}, userId: ${userId}, targetAgentId: ${targetAgentId}, limit: ${limit}`);

  try {
    let query = supabaseClient
        .from('chat_messages')
        .select('content, created_at, sender_agent_id, sender_user_id, agents:sender_agent_id ( name )')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (channelId) {
        // Workspace Channel History
        console.log(`[getRelevantChatHistory] Mode: Workspace Channel`);
        query = query.eq('channel_id', channelId);
    } else if (userId && targetAgentId) {
        // Direct Chat History (User <-> Agent)
        console.log(`[getRelevantChatHistory] Mode: Direct Chat`);
        query = query.is('channel_id', null) 
                     .or(
                        `sender_user_id.eq.${userId},` +
                        `sender_agent_id.eq.${targetAgentId}`
                     );
                     
        // Let's log the constructed filter parts for clarity (DEBUGGING)
        console.log(`[getRelevantChatHistory] Direct Chat Filters: channel_id IS NULL, OR (` +
            `sender_user_id.eq.${userId},` +
            `sender_agent_id.eq.${targetAgentId}` +
        `)`);
                     
    } else {
        // Invalid state or scenario not supported
        console.warn('[getRelevantChatHistory] Cannot fetch: No channelId AND no valid userId/targetAgentId pair.');
        return [];
    }

    // Log the final query structure before execution (optional, might be complex)
    // console.log("[getRelevantChatHistory] Executing query:", query); // Be cautious logging full queries

    const { data, error } = await query;

    // Log the raw results
    console.log(`[getRelevantChatHistory] Query Result - Error:`, error); 
    console.log(`[getRelevantChatHistory] Query Result - Data Count:`, data?.length ?? 0);
    // console.log(`[getRelevantChatHistory] Query Result - Raw Data:`, data); // Avoid logging potentially sensitive message content unless necessary

    if (error) throw error;

    // Map to ChatMessage type (imported)
    const history = (data || []).map((msg: any) => ({
        role: msg.sender_agent_id ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.created_at,
        agentName: msg.agents?.name ?? null
    } as ChatMessage)).reverse(); 
    
    console.log(`[getRelevantChatHistory] Processed ${history.length} messages for history.`);
    return history;

  } catch (err) {
    console.error(`[getRelevantChatHistory] Error fetching history (channel: ${channelId}, user: ${userId}, agent: ${targetAgentId}):`, err);
    return [];
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Authentication ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = user.id;

    // --- Rate Limiting ---
    if (!limiter.tryRemoveTokens(1)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Parse Request Body ---
    const reqData: ChatRequestBody = await req.json();
    const userMessageContent = reqData.message?.trim();
    const targetAgentId = reqData.agentId;
    const channelId = reqData.channelId;
    const workspaceId = reqData.workspaceId;

    // --- Workspace Context Fetch ---
    let workspaceDetails: ImportedWorkspaceDetails | null = null;
    if (workspaceId) {
      workspaceDetails = await getWorkspaceDetails(workspaceId);
      if (!workspaceDetails) {
        // Decide handling: Maybe proceed without context, or error?
        console.warn(`Could not fetch details for workspace ${workspaceId}. Proceeding without workspace context.`);
        // Return error if workspace context is critical
        // return new Response(JSON.stringify({ error: 'Failed to load workspace context.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
        // If no workspaceId is provided, we might be in a different chat mode (e.g., direct agent chat)
        console.log('No workspaceId provided, assuming non-workspace chat context.');
        // Proceed without workspace context
    }

    // --- Define Context Settings ---
    const contextSettings: ContextSettings = {
      messageLimit: workspaceDetails?.context_window_size ?? 20, 
      tokenLimit: workspaceDetails?.context_window_token_limit ?? 8000, 
    };

    console.log(`[chat] Using context settings - Window Size: ${contextSettings.messageLimit}, Token Limit: ${contextSettings.tokenLimit}`);

    // --- *** CONDITIONAL LOGIC (User vs Agent Message) *** ---
    if (!targetAgentId) {
      // --- Handle User-Only Message --- 
      console.log(`Handling user-only message for channel: ${channelId} in workspace: ${workspaceId}`);
      if (!userMessageContent || !channelId) {
        return new Response(JSON.stringify({ error: 'Message content and Channel ID are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userMessagePayload: ChatMessageInsertPayload = {
          channel_id: channelId,
          content: userMessageContent,
          sender_user_id: userId,
          sender_agent_id: null
      };
      const { error: insertError } = await supabaseClient
        .from('chat_messages')
        .insert(userMessagePayload); 
      if (insertError) { 
          console.error('Error saving user-only message:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to save message.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); 
      }
      return new Response(JSON.stringify({ success: true, message: "Message saved." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      // --- Handle Message Targeting an Agent ---
      console.log(`Handling message for agent: ${targetAgentId} in workspace: ${workspaceId} channel: ${channelId}`);
      if (!userMessageContent) { 
          return new Response(JSON.stringify({ error: 'Message content is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); 
      }

      // --- Fetch Agent Details ---
      const { data: agent, error: agentError } = await supabaseClient
          .from('agents')
          .select('id, name, system_instructions, assistant_instructions, personality') 
          .eq('id', targetAgentId)
          .single();
      if (agentError || !agent) { 
          console.error('Agent fetch error:', agentError);
          return new Response(JSON.stringify({ error: 'Target agent not found or error fetching agent' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // --- Fetch Context Components ---
      const vectorContextStr = await getVectorSearchResults(userMessageContent, targetAgentId);
      const historyMessages = await getRelevantChatHistory(channelId ?? null, userId, targetAgentId, contextSettings.messageLimit);
      let mcpResourceContextStr: string | null = null; 

      // --- MCP Logic (Fetch results before context building) --- 
      const mcpConfigs = await getMCPConfigurations(targetAgentId);
          if (mcpConfigs.length > 0) {
          try {
              // Pass necessary context to prepareMCPContext if needed, simplified for now
              const mcpContext = await prepareMCPContext([], agent.id, agent.name ?? 'Agent', '', agent.system_instructions, agent.assistant_instructions);
              const mcpManager = new MCPManager(mcpConfigs /*, getVaultAPIKey */);
              const mcpResults = await mcpManager.processContext(mcpContext);
              if (mcpResults && mcpResults.resources.length > 0) {
                  mcpResourceContextStr = 'External Context from MCP Servers:\n\n' + 
                      mcpResults.resources.map(r => `${r.type} (${r.id}):\n${JSON.stringify(r.content)}`).join('\n\n');
              }
              if (mcpResults?.errors?.length > 0) {
                   console.warn(`MCP processing encountered errors for agent ${targetAgentId}:`, mcpResults.errors);
              }
          } catch (mcpError) {
              console.error(`Critical error during MCP processing for agent ${targetAgentId}:`, mcpError);
          }
      }

      // --- Create Context Builder ---
      const contextBuilder = new ContextBuilder(contextSettings)
        .addSystemInstruction(agent.system_instructions || '');

      // Add agent identity and personality
      if (agent.name) {
        contextBuilder.addSystemInstruction(`You are ${agent.name}, an AI agent.`);
        if (agent.personality) {
          contextBuilder.addSystemInstruction(`Your personality: ${agent.personality}`);
        }
      }

      // Add workspace context
      if (workspaceDetails) {
        contextBuilder.addWorkspaceContext(workspaceDetails);
      }

      // Add assistant instructions
      if (agent.assistant_instructions) {
        contextBuilder.addAssistantInstruction(agent.assistant_instructions);
      }

      // Add vector search results if available
      if (vectorContextStr) {
        contextBuilder.addVectorMemories(vectorContextStr);
      }

      // Add MCP context if available
      if (mcpResourceContextStr) {
        contextBuilder.addMCPContext(mcpResourceContextStr);
      }

      // Set chat history with agent names
      contextBuilder.setHistory(historyMessages);

      // Set the user's current message
      contextBuilder.setUserInput(userMessageContent);

      // Build the final context
      const messages = contextBuilder.buildContext();

      console.log(`[chat] Final context built - ${messages.length} messages, approximately ${contextBuilder.getTotalTokenCount()} tokens`);

      // --- Get Response from LLM ---
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
      });

      // --- Extract & Save Assistant Response ---
      const completionContent = completion.choices[0].message.content;

      // Save agent response in the database
      const agentResponsePayload: ChatMessageInsertPayload = {
        channel_id: channelId,
        content: completionContent,
        sender_user_id: null,
        sender_agent_id: targetAgentId
      };

      const { error: responseInsertError } = await supabaseClient
        .from('chat_messages')
        .insert(agentResponsePayload);
      if (responseInsertError) {
        console.error('Error saving agent response:', responseInsertError);
        // Note: We still return the response to the client even if saving fails
      }

      return new Response(
        JSON.stringify({
          message: completionContent,
          agent: { id: agent.id, name: agent.name },
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Critical Chat Function Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});