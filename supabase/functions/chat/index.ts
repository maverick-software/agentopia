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
    agentId: string | null; // Can be null if message is just from user
    message: string;
    authorId?: string; // Keep if used elsewhere
    workspaceId?: string; // NEW - ID of the workspace
    channelId?: string; // NEW - ID of the channel within the workspace
    // members?: BasicRoomMember[]; // REMOVE - We fetch this server-side
}

interface BasicWorkspaceMember {
  id: string;
  role: string | null;
  user_id?: string | null;
  agent_id?: string | null;
  team_id?: string | null;
  // Include details if needed later
  user_name?: string | null; // Example: From user_profiles
  agent_name?: string | null; // Example: From agents
  team_name?: string | null; // Example: From teams
}

interface WorkspaceDetails {
  id: string;
  name: string;
  context_window_size: number;
  context_window_token_limit: number;
  members: BasicWorkspaceMember[];
}

/**
 * Fetches workspace details, members, and context settings.
 */
async function getWorkspaceDetails(workspaceId: string): Promise<WorkspaceDetails | null> {
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
    const agentId = reqData.agentId; // Target agent ID (can be null)
    const channelId = reqData.channelId;
    const workspaceId = reqData.workspaceId;

    // --- Workspace Context Fetch ---
    let workspaceDetails: WorkspaceDetails | null = null;
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

    // --- *** CONDITIONAL LOGIC *** ---
    if (!agentId) {
      // --- Handle User-Only Message (No Agent Target) ---
      console.log(`Handling user-only message for channel: ${channelId} in workspace: ${workspaceId}`);

      if (!userMessageContent) {
          return new Response(JSON.stringify({ error: 'Message content is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!channelId) {
          return new Response(JSON.stringify({ error: 'Channel ID is required for workspace messages.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Save the user message to the database
      const { error: insertError } = await supabaseClient
          .from('chat_messages')
          .insert({
              channel_id: channelId,
              content: userMessageContent,
              sender_user_id: userId,
              sender_agent_id: null, // Explicitly null
              // metadata: {} // Add if needed
          });

      if (insertError) {
          console.error('Error saving user-only message:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to save message.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Return success without a reply
      return new Response(JSON.stringify({ success: true, message: "Message saved." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
      });

    } else {
      // --- Handle Message Targeting an Agent ---
      console.log(`Handling message for agent: ${agentId} in workspace: ${workspaceId} channel: ${channelId}`);

      // Validate Agent ID and Message Content (Keep existing validation)
      if (!agentId || typeof agentId !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid request format. AgentId valid: false.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!userMessageContent || typeof userMessageContent !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid request format. UserMessage valid: false.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // --- Fetch Agent Details --- (Keep existing logic)
      const { data: agent, error: agentError } = await supabaseClient
        .from('agents')
        .select('id, name, system_instructions, assistant_instructions')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        console.error('Agent fetch error:', agentError);
        return new Response(JSON.stringify({ error: 'Agent not found or error fetching agent' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // --- Prepare Context (Vector Search, History, MCP, Workspace) ---
      const vectorContext = await getVectorSearchResults(userMessageContent, agentId);

      // TODO: Fetch chat history using workspaceDetails context settings
      const chatHistory: ChatMessage[] = [ /* Placeholder for actual history fetch */ ];

      const systemMessages: ChatMessage[] = [];
      // ** Add Workspace Context to System Messages **
      if (workspaceDetails) {
          let workspaceContext = `You are in the workspace "${workspaceDetails.name}".\n`;
          if (workspaceDetails.members.length > 0) {
              workspaceContext += "Current members in this workspace:\n";
              workspaceDetails.members.forEach(member => {
                  let memberInfo = `- `;
                  if (member.agent_name) memberInfo += `Agent: ${member.agent_name}`;
                  else if (member.user_name) memberInfo += `User: ${member.user_name}`;
                  else if (member.team_name) memberInfo += `Team: ${member.team_name}`;
                  else memberInfo += `Unknown Member (ID: ${member.id})`;
                  if (member.role) memberInfo += ` (Role: ${member.role})`;
                  workspaceContext += memberInfo + '\n';
              });
          } else {
              workspaceContext += "You are the only member currently listed.\n";
          }
          // TODO: Add channel context (name/topic) if available
          systemMessages.push({ role: 'system', content: workspaceContext });
      }
      // Add Agent system instructions
      if (agent.system_instructions) {
        systemMessages.push({ role: 'system', content: agent.system_instructions });
      }
      // Add Vector context
      if (vectorContext) {
        systemMessages.push({ role: 'system', content: vectorContext });
      }
      // Add assistant instructions
       if (agent.assistant_instructions) {
          systemMessages.push({ role: 'system', content: `ASSISTANT INSTRUCTIONS: ${agent.assistant_instructions}` });
       }

      const messages: ChatMessage[] = [
        ...systemMessages,
        ...chatHistory, // Add fetched history here (TODO)
        { role: 'user', content: userMessageContent },
      ];

      let agentReplyContent: string | null = null;
      let mcpResults: AggregatedMCPResults | null = null;

      // --- MCP Logic --- (Keep existing logic, but fix usage)
      const mcpConfigs = await getMCPConfigurations(agentId);
      if (mcpConfigs.length > 0) {
          console.log(`Agent ${agentId} has ${mcpConfigs.length} active MCP configurations. Attempting MCP...`);
          const mcpContext = await prepareMCPContext(messages, agent.id, agent.name ?? 'Agent', /* personality */ '', systemMessages.map(m=>m.content).join('\n'), agent.assistant_instructions ?? '');
          // FIX: Constructor only takes configs
          const mcpManager = new MCPManager(mcpConfigs /*, getVaultAPIKey */);
          try {
              // FIX: Call processContext and expect AggregatedMCPResults { resources, errors }
              mcpResults = await mcpManager.processContext(mcpContext);

              // FIX: Process resources as context, don't expect a direct reply
              if (mcpResults && mcpResults.resources.length > 0) {
                  console.log(`MCP successful for agent ${agentId}. Received ${mcpResults.resources.length} resources.`);
                  // Format MCP resources into a context string
                  const mcpResourceContext = 'External Context from MCP Servers:\n\n' +
                      mcpResults.resources
                          .map(resource => `${resource.type} (${resource.id}):\n${JSON.stringify(resource.content)}`) // Simple stringification
                          .join('\n\n');
                  // Add MCP context as a system message for OpenAI
                  messages.push({ role: 'system', content: mcpResourceContext });
                  console.log(`Added MCP resource context to messages for agent ${agentId}.`);
              } else {
                  console.log(`MCP process completed for agent ${agentId}, but yielded no resources.`);
              }

              if (mcpResults && mcpResults.errors.length > 0) {
                   console.warn(`MCP processing encountered errors for agent ${agentId}:`, mcpResults.errors);
                   // Log errors but continue to OpenAI fallback
              }

          } catch (mcpError) {
               console.error(`Critical error during MCP processing for agent ${agentId}:`, mcpError);
               // Ensure mcpResults is at least an empty structure if error occurred before assignment
               if (!mcpResults) mcpResults = { resources: [], errors: [{ serverId: -1, error: mcpError }] };
               else mcpResults.errors.push({ serverId: -1, error: mcpError });
          } finally {
              // Ensure MCP clients are disconnected
              // NOTE: MCPManager constructor doesn't exist in this scope anymore.
              // Need to consider how to handle cleanup if MCPManager was intended
              // to be reused or if client cleanup is handled internally.
              // Assuming MCPClient handles its own cleanup or manager does on processContext completion.
              // If manager needs explicit disconnect, this needs rethink.
              // For now, removing disconnectAll() call here as manager instance may not be accessible
              // and processContext should ideally handle internal cleanup or client lifetime.
          }

      } else {
          console.log(`No active MCP configurations for agent ${agentId}. Skipping MCP processing.`);
          // Fall through to primary model
      }


       // --- Primary Model Fallback (OpenAI) --- (Now always runs, potentially with added MCP context)
       // FIX: Remove the check for agentReplyContent === null, as MCP no longer sets it directly.
       // Always attempt OpenAI call unless a critical *unrecoverable* error happened earlier.
       // (Current logic proceeds even if MCP had errors/no resources).
       console.log(`Invoking primary OpenAI model for agent ${agentId}...`);
       try {
           const completion = await openai.chat.completions.create({
               model: 'gpt-4o', // Or your preferred model
               messages: messages as any, // Cast needed if type doesn't align perfectly
               temperature: 0.7,
           });
           agentReplyContent = completion.choices[0]?.message?.content?.trim() || null;
           if (agentReplyContent) {
               console.log(`Primary OpenAI model successful for agent ${agentId}.`);
           } else {
              console.warn(`Primary OpenAI model returned no content for agent ${agentId}.`);
           }
       } catch (openaiError) {
           console.error(`Primary OpenAI model invocation error for agent ${agentId}:`, openaiError);
           // Do not error out the whole request, just return no reply
           agentReplyContent = null;
       }


      // --- Save Messages --- (Keep existing logic, save user message + agent reply if exists)
      const messagesToInsert = [
        { channel_id: channelId, content: userMessageContent, sender_user_id: userId, sender_agent_id: null },
      ];
      if (agentReplyContent) {
        messagesToInsert.push({ channel_id: channelId, content: agentReplyContent, sender_user_id: null, sender_agent_id: agentId });
      } else {
        console.log(`Agent ${agentId} did not provide a reply to save.`);
      }

      const { error: insertError } = await supabaseClient
        .from('chat_messages')
        .insert(messagesToInsert);

      if (insertError) {
        console.error('Error saving messages:', insertError);
        // Don't fail the request if saving fails, but log it
      }

      // --- Return Response --- (Keep existing logic)
      return new Response(JSON.stringify({ reply: agentReplyContent, agentId: agentId, agentName: agent?.name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    // --- *** END CONDITIONAL LOGIC *** ---

  } catch (error) {
    console.error('Critical Chat Function Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});