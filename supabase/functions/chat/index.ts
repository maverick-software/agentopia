import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { RateLimiter } from 'npm:limiter@3.0.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import { MCPManager } from './manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from './types.ts';
import { ContextBuilder, ChatMessage, WorkspaceDetails as ImportedWorkspaceDetails, ContextSettings, BasicWorkspaceMember } from './context_builder.ts';

// Import extracted modules
import { getVectorSearchResults } from './vector_search.ts';
import { prepareMCPContext, processMCPContext } from './mcp_integration.ts';
import { getWorkspaceDetails, createContextSettings } from './workspace_manager.ts';
import { getRelevantChatHistory, saveUserMessage, saveAgentResponse } from './chat_history.ts';
import { 
  handleCORS, 
  authenticateUser, 
  checkRateLimit, 
  validateRequestBody, 
  createErrorResponse, 
  createSuccessResponse 
} from './auth_handler.ts';

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

/**
 * Fetches agent details from the database
 * @param agentId - The ID of the agent to fetch
 * @returns Agent data or null if not found
 */
async function getAgentDetails(agentId: string) {
  const { data: agent, error: agentError } = await supabaseClient
    .from('agents')
    .select('id, name, system_instructions, assistant_instructions, personality') 
    .eq('id', agentId)
    .single();
    
  if (agentError || !agent) { 
    console.error('Agent fetch error:', agentError);
    return null;
  }
  
  return agent;
}

/**
 * Handles user-only messages (no agent target)
 * @param channelId - Channel where message was sent
 * @param userMessageContent - Content of the user message
 * @param userId - ID of the user sending the message
 * @param workspaceId - ID of the workspace
 */
async function handleUserOnlyMessage(
  channelId: string | null,
  userMessageContent: string,
  userId: string,
  workspaceId: string | undefined
): Promise<Response> {
  console.log(`Handling user-only message for channel: ${channelId} in workspace: ${workspaceId}`);
  
  if (!userMessageContent || !channelId) {
    return createErrorResponse('Message content and Channel ID are required.', 400);
  }

  const saveResult = await saveUserMessage(channelId, userMessageContent, userId, supabaseClient);
  
  if (!saveResult.success) {
    console.error('Error saving user-only message');
    return createErrorResponse(saveResult.error || 'Failed to save message.', 500);
  }

  return createSuccessResponse({ success: true, message: "Message saved." });
}

/**
 * Handles messages targeting an agent
 * @param agentId - ID of the target agent
 * @param userMessageContent - Content of the user message
 * @param userId - ID of the user sending the message
 * @param channelId - Channel where message was sent
 * @param workspaceId - ID of the workspace
 */
async function handleAgentMessage(
  agentId: string,
  userMessageContent: string,
  userId: string,
  channelId: string | null,
  workspaceId: string | undefined
): Promise<Response> {
  console.log(`Handling message for agent: ${agentId} in workspace: ${workspaceId} channel: ${channelId}`);

  // Fetch agent details
  const agent = await getAgentDetails(agentId);
  if (!agent) {
    return createErrorResponse('Target agent not found or error fetching agent', 404);
  }

  // Fetch workspace details and create context settings
  let workspaceDetails = null;
  if (workspaceId) {
    workspaceDetails = await getWorkspaceDetails(workspaceId, supabaseClient);
    if (!workspaceDetails) {
      console.warn(`Could not fetch details for workspace ${workspaceId}. Proceeding without workspace context.`);
    }
  } else {
    console.log('No workspaceId provided, assuming non-workspace chat context.');
  }

  const contextSettings = createContextSettings(workspaceDetails);
  console.log(`[chat] Using context settings - Window Size: ${contextSettings.messageLimit}, Token Limit: ${contextSettings.tokenLimit}`);

  // Fetch context components in parallel for performance
  const [vectorContextStr, historyMessages, mcpResourceContextStr] = await Promise.all([
    getVectorSearchResults(userMessageContent, agentId, supabaseClient, openai),
    getRelevantChatHistory(channelId, userId, agentId, contextSettings.messageLimit, supabaseClient),
    processMCPContext(agentId, await prepareMCPContext([], agent.id, agent.name ?? 'Agent', '', agent.system_instructions, agent.assistant_instructions), supabaseClient)
  ]);

  // Create Context Builder
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

  // Get Response from LLM
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    temperature: 0.7,
  });

  // Extract assistant response
  const completionContent = completion.choices[0].message.content;

  // Save agent response in the database
  const saveResult = await saveAgentResponse(channelId, completionContent, agentId, supabaseClient);
  if (!saveResult.success) {
    console.error('Error saving agent response');
    // Note: We still return the response to the client even if saving fails
  }

  return createSuccessResponse({
    message: completionContent,
    agent: { id: agent.id, name: agent.name },
  });
}

/**
 * Main Deno.serve handler - orchestrates the chat functionality
 */
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;

    // Authentication
    const authResult = await authenticateUser(req, supabaseClient);
    if (!authResult.success) {
      return createErrorResponse(authResult.error!, authResult.statusCode!);
    }
    const userId = authResult.userId!;

    // Rate Limiting
    if (!checkRateLimit(limiter)) {
      return createErrorResponse('Rate limit exceeded', 429);
    }

    // Parse and validate request body
    const validationResult = await validateRequestBody(req);
    if (!validationResult.success) {
      return createErrorResponse(validationResult.error!, validationResult.statusCode!);
    }
    
    const reqData = validationResult.data!;
    const userMessageContent = reqData.message?.trim();
    const targetAgentId = reqData.agentId;
    const channelId = reqData.channelId;
    const workspaceId = reqData.workspaceId;

    // Route to appropriate handler based on target
    if (!targetAgentId) {
      // Handle User-Only Message
      return await handleUserOnlyMessage(channelId, userMessageContent, userId, workspaceId);
    } else {
      // Handle Message Targeting an Agent
      return await handleAgentMessage(targetAgentId, userMessageContent, userId, channelId, workspaceId);
    }

  } catch (error) {
    console.error('Critical Chat Function Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
});