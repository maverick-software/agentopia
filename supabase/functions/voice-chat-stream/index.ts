/**
 * Real-time Voice Chat Stream Edge Function
 * 
 * Handles streaming voice conversations using GPT-4o Audio Preview
 * - Accepts audio input (base64)
 * - Streams back audio + text responses
 * - Supports MCP tool calling
 * - No audio file storage (text-only persistence)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface VoiceChatRequest {
  audio_input: string;              // Base64 encoded audio
  conversation_id?: string;         // Existing conversation (optional - will create if not provided)
  agent_id: string;                 // Agent configuration
  format?: 'wav' | 'mp3' | 'pcm16'; // Audio format (default: wav)
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'; // Voice selection
}

/**
 * Fetch OpenAI API key from system_api_keys table and Supabase Vault
 */
async function getOpenAIAPIKey(supabase: any): Promise<string | null> {
  try {
    const { data: systemKey, error } = await supabase
      .from('system_api_keys')
      .select('vault_secret_id, is_active')
      .eq('provider_name', 'openai')
      .eq('is_active', true)
      .single();

    if (error || !systemKey?.vault_secret_id) {
      console.warn('[VoiceChatStream] No system API key found for OpenAI');
      return null;
    }

    const { data: secretData, error: vaultError } = await supabase
      .rpc('get_secret', { secret_id: systemKey.vault_secret_id });

    if (vaultError || !secretData || secretData.length === 0) {
      console.error('[VoiceChatStream] Failed to decrypt OpenAI key:', vaultError);
      return null;
    }

    return secretData[0]?.key || null;
  } catch (err) {
    console.error('[VoiceChatStream] Error fetching system API key for OpenAI:', err);
    return null;
  }
}

/**
 * Get agent's available MCP tools
 */
async function getAgentTools(supabase: any, agentId: string, userId: string): Promise<any[]> {
  try {
    // Call existing get-agent-tools edge function
    const { data, error } = await supabase.functions.invoke('get-agent-tools', {
      body: { agent_id: agentId }
    });

    if (error) {
      console.error('[VoiceChatStream] Error fetching agent tools:', error);
      return [];
    }

    return data?.tools || [];
  } catch (err) {
    console.error('[VoiceChatStream] Error getting agent tools:', err);
    return [];
  }
}

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  supabase: any, 
  conversationId: string, 
  limit: number = 10
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages_v2')
      .select('role, content, tool_calls')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[VoiceChatStream] Error fetching conversation history:', error);
      return [];
    }

    // Reverse to chronological order
    return (data || []).reverse();
  } catch (err) {
    console.error('[VoiceChatStream] Error getting conversation history:', err);
    return [];
  }
}

/**
 * Format tools for OpenAI function calling
 */
function formatToolsForOpenAI(tools: any[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || tool.parameters || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }));
}

/**
 * Execute MCP tool call
 */
async function executeToolCall(
  supabase: any,
  toolName: string,
  toolArgs: any,
  agentId: string,
  userId: string,
  authToken: string
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    console.log(`[VoiceChatStream] Executing tool: ${toolName}`);

    // Call mcp-execute edge function
    const { data, error } = await supabase.functions.invoke('mcp-execute', {
      body: {
        tool_name: toolName,
        parameters: toolArgs,
        agent_id: agentId,
        user_id: userId
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (error) {
      console.error(`[VoiceChatStream] Tool execution error:`, error);
      return {
        success: false,
        result: null,
        error: error.message || 'Tool execution failed'
      };
    }

    return {
      success: true,
      result: data
    };

  } catch (err) {
    console.error(`[VoiceChatStream] Error executing tool ${toolName}:`, err);
    return {
      success: false,
      result: null,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Save message to database (text only, no audio)
 */
async function saveMessage(
  supabase: any,
  conversationId: string,
  agentId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: any = {}
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('chat_messages_v2')
      .insert({
        conversation_id: conversationId,
        agent_id: agentId,
        user_id: userId,
        role,
        content,
        metadata: {
          ...metadata,
          input_method: 'realtime_voice',
          model: 'gpt-4o-audio-preview',
          audio_stored: false  // Explicitly mark that we don't store audio
        }
      })
      .select('id')
      .single();

    if (error) {
      console.error('[VoiceChatStream] Error saving message:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[VoiceChatStream] Error saving message:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: VoiceChatRequest = await req.json();
    let { audio_input, conversation_id, agent_id, format = 'wav', voice = 'alloy' } = body;

    if (!audio_input || !agent_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: audio_input, agent_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create conversation if it doesn't exist
    if (!conversation_id || conversation_id.trim() === '') {
      console.log('[VoiceChatStream] Creating new conversation');
      const { data: newConv, error: convError } = await supabaseServiceClient
        .from('conversations')
        .insert({
          agent_id,
          user_id: user.id,
          title: 'Voice Conversation',
          metadata: { started_via: 'realtime_voice' }
        })
        .select('id')
        .single();

      if (convError || !newConv) {
        console.error('[VoiceChatStream] Error creating conversation:', convError);
        return new Response(
          JSON.stringify({ error: 'Failed to create conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      conversation_id = newConv.id;
      console.log(`[VoiceChatStream] Created new conversation: ${conversation_id}`);
    }

    console.log(`[VoiceChatStream] Starting voice chat for user ${user.id}, agent ${agent_id}`);

    // Get OpenAI API key
    const OPENAI_API_KEY = await getOpenAIAPIKey(supabaseServiceClient);
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Voice chat service not configured. Admin: Please add OpenAI API key.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent tools and conversation history
    const [tools, history] = await Promise.all([
      getAgentTools(supabaseServiceClient, agent_id, user.id),
      getConversationHistory(supabaseServiceClient, conversation_id, 10)
    ]);

    console.log(`[VoiceChatStream] Loaded ${tools.length} tools and ${history.length} history messages`);

    // Build messages array for GPT-4o
    const messages: any[] = [
      // System message (if agent has instructions)
      // TODO: Fetch from agent.instructions field
      {
        role: 'system',
        content: 'You are a helpful AI assistant with real-time voice capabilities.'
      },
      // Conversation history
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      // Current audio input
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: audio_input,
              format: format
            }
          }
        ]
      }
    ];

    // Format tools for OpenAI
    const formattedTools = formatToolsForOpenAI(tools);

    // Call GPT-4o Audio Preview API with streaming
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        modalities: ['text', 'audio'],
        audio: { 
          voice: voice, 
          format: format 
        },
        messages: messages,
        tools: formattedTools.length > 0 ? formattedTools : undefined,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('[VoiceChatStream] OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || `Voice chat failed: ${openaiResponse.status}` 
        }),
        { status: openaiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Server-Sent Events stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullTextTranscript = '';
        let audioChunks: string[] = [];
        let toolCalls: any[] = [];

        // Send conversation_id immediately
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          event: 'conversation_created',
          conversation_id: conversation_id
        })}\n\n`));

        try {
          // Parse streaming response from OpenAI
          const reader = openaiResponse.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.trim() === 'data: [DONE]') continue;
              if (!line.startsWith('data: ')) continue;

              try {
                const jsonStr = line.slice(6); // Remove 'data: ' prefix
                const chunk = JSON.parse(jsonStr);
                const delta = chunk.choices?.[0]?.delta;

                if (!delta) continue;

                // Handle text delta
                if (delta.content) {
                  fullTextTranscript += delta.content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    event: 'text',
                    data: delta.content,
                    timestamp: new Date().toISOString()
                  })}\n\n`));
                }

                // Handle audio delta
                if (delta.audio) {
                  audioChunks.push(delta.audio);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    event: 'audio',
                    data: delta.audio,
                    timestamp: new Date().toISOString()
                  })}\n\n`));
                }

                // Handle tool calls
                if (delta.tool_calls) {
                  for (const toolCall of delta.tool_calls) {
                    if (toolCall.function) {
                      // Tool call request
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        event: 'tool_call',
                        tool_name: toolCall.function.name,
                        arguments: toolCall.function.arguments,
                        timestamp: new Date().toISOString()
                      })}\n\n`));

                      // Execute tool
                      const toolResult = await executeToolCall(
                        supabaseServiceClient,
                        toolCall.function.name,
                        JSON.parse(toolCall.function.arguments || '{}'),
                        agent_id,
                        user.id,
                        authHeader.replace('Bearer ', '')
                      );

                      // Send tool result
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        event: 'tool_result',
                        tool_name: toolCall.function.name,
                        result: toolResult,
                        timestamp: new Date().toISOString()
                      })}\n\n`));

                      toolCalls.push({
                        tool_name: toolCall.function.name,
                        arguments: toolCall.function.arguments,
                        result: toolResult
                      });
                    }
                  }
                }

              } catch (parseError) {
                console.error('[VoiceChatStream] Error parsing SSE chunk:', parseError);
              }
            }
          }

          // Save messages to database (text only, no audio)
          console.log(`[VoiceChatStream] Saving messages (transcript only, no audio files)`);
          
          // Save user message
          await saveMessage(
            supabaseServiceClient,
            conversation_id,
            agent_id,
            user.id,
            'user',
            '[Voice input - transcript not available]', // We don't have user transcription from GPT-4o
            { voice_duration_ms: 0 }
          );

          // Save assistant message
          const assistantMessageId = await saveMessage(
            supabaseServiceClient,
            conversation_id,
            agent_id,
            user.id,
            'assistant',
            fullTextTranscript,
            {
              voice: voice,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined
            }
          );

          // Send completion event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            event: 'complete',
            message_id: assistantMessageId,
            transcript: fullTextTranscript,
            timestamp: new Date().toISOString()
          })}\n\n`));

          console.log(`[VoiceChatStream] Stream completed successfully`);

        } catch (streamError) {
          console.error('[VoiceChatStream] Stream error:', streamError);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            event: 'error',
            error: streamError instanceof Error ? streamError.message : 'Stream error',
            timestamp: new Date().toISOString()
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('[VoiceChatStream] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

