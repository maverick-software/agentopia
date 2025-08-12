import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { ChatMessage } from './context_builder.ts';

/**
 * Fetches chat history - Returns array matching ChatMessage interface
 * @param channelId - The channel ID for workspace chats (null for direct chats)
 * @param userId - The user ID for direct chats
 * @param targetAgentId - The agent ID for direct chats
 * @param limit - Maximum number of messages to retrieve
 * @param supabaseClient - Supabase client instance
 * @returns Array of chat messages
 */
export async function getRelevantChatHistory(
    channelId: string | null, 
    userId: string | null, 
    targetAgentId: string | null, 
    limit: number,
    supabaseClient: SupabaseClient
): Promise<ChatMessage[]> {
  if (limit <= 0) return [];
  console.log(`[getRelevantChatHistory] Attempting fetch - channelId: ${channelId}, userId: ${userId}, targetAgentId: ${targetAgentId}, limit: ${limit}`);

  try {
    // Prefer v2 storage
    let v2Query = supabaseClient
        .from('chat_messages_v2')
        .select('role, content, created_at, sender_agent_id, sender_user_id, context, agents:sender_agent_id ( name )')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (channelId) {
        // Workspace Channel History
        console.log(`[getRelevantChatHistory] Mode: Workspace Channel`);
        v2Query = v2Query.eq('channel_id', channelId);
    } else if (userId && targetAgentId) {
        // Direct Chat History (User <-> Agent)
        console.log(`[getRelevantChatHistory] Mode: Direct Chat`);
        v2Query = v2Query.is('channel_id', null)
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

    const { data: v2Data, error: v2Error } = await v2Query;

    // Log the raw results
    console.log(`[getRelevantChatHistory] V2 Result - Error:`, v2Error); 
    console.log(`[getRelevantChatHistory] V2 Result - Data Count:`, v2Data?.length ?? 0);
    // console.log(`[getRelevantChatHistory] Query Result - Raw Data:`, data); // Avoid logging potentially sensitive message content unless necessary

    if (!v2Error && v2Data) {
      const historyV2 = (v2Data || []).map((msg: any) => ({
          role: (msg.role === 'assistant' || msg.sender_agent_id) ? 'assistant' : 'user',
          content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
          timestamp: msg.created_at,
          agentName: msg.agents?.name ?? null
      } as ChatMessage)).reverse();
      console.log(`[getRelevantChatHistory] Processed ${historyV2.length} messages for history (v2).`);
      return historyV2;
    }

    // Fallback to v1 if v2 fails (temporary during migration)
    const { data, error } = await supabaseClient
      .from('chat_messages')
      .select('content, created_at, sender_agent_id, sender_user_id, agents:sender_agent_id ( name )')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
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

/**
 * Saves a user message to the database
 * @param channelId - The channel ID where the message was sent
 * @param content - The message content
 * @param senderId - The ID of the user sending the message
 * @param supabaseClient - Supabase client instance
 * @returns Success status
 */
export async function saveUserMessage(
  channelId: string | null,
  content: string,
  senderId: string,
  supabaseClient: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const userMessagePayload = {
      channel_id: channelId,
      content: content,
      sender_user_id: senderId,
      sender_agent_id: null
    };

    const { error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert(userMessagePayload);

    if (insertError) {
      console.error('Error saving user message:', insertError);
      return { success: false, error: 'Failed to save message.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving user message:', error);
    return { success: false, error: 'Unexpected error occurred.' };
  }
}

/**
 * Saves an agent response to the database
 * @param channelId - The channel ID where the response was sent
 * @param content - The response content
 * @param agentId - The ID of the agent sending the response
 * @param supabaseClient - Supabase client instance
 * @returns Success status
 */
export async function saveAgentResponse(
  channelId: string | null,
  content: string,
  agentId: string,
  supabaseClient: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const agentResponsePayload = {
      channel_id: channelId,
      content: content,
      sender_user_id: null,
      sender_agent_id: agentId
    };

    const { error: responseInsertError } = await supabaseClient
      .from('chat_messages')
      .insert(agentResponsePayload);

    if (responseInsertError) {
      console.error('Error saving agent response:', responseInsertError);
      return { success: false, error: 'Failed to save agent response.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving agent response:', error);
    return { success: false, error: 'Unexpected error occurred.' };
  }
} 