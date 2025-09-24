// Edge Function: Temporary Chat Message Handler
// Description: Processes messages from anonymous users and integrates with agent chat system
// Authentication: Anonymous access with session token validation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SendMessageRequest {
  session_token: string
  message: string
  message_type?: 'text' | 'file'
  metadata?: Record<string, any>
}

interface RateLimitCheck {
  allowed: boolean
  current_count: number
  limit_per_minute: number
  reset_time: string
}

serve(async (req) => {
  console.log('[temporary-chat-handler] === REQUEST START ===')
  console.log(`[temporary-chat-handler] Method: ${req.method}`)
  console.log(`[temporary-chat-handler] URL: ${req.url}`)
  console.log(`[temporary-chat-handler] Headers:`, Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[temporary-chat-handler] Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    console.log('[temporary-chat-handler] Method not allowed:', req.method)
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log('[temporary-chat-handler] Processing POST request')

  try {
    console.log('[temporary-chat-handler] Parsing request body...')
    const { 
      session_token, 
      message, 
      message_type = 'text', 
      metadata = {} 
    }: SendMessageRequest = await req.json()

    console.log(`[temporary-chat-handler] Request parsed:`, {
      session_token: session_token ? `${session_token.substring(0, 8)}...` : 'null',
      message: message ? `${message.substring(0, 50)}...` : 'null',
      message_type,
      metadata
    })

    // Validate required parameters
    if (!session_token || !message) {
      console.log('[temporary-chat-handler] Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: session_token, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate message length
    if (message.length > 4000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (maximum 4000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-handler] Processing message for session: ${session_token.substring(0, 8)}...`)

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validate session and get session info
    console.log(`[temporary-chat-handler] Calling validate_temp_chat_session with token: ${session_token.substring(0, 8)}...`)
    
    const { data: sessionData, error: validationError } = await supabase.rpc('validate_temp_chat_session', {
      p_session_token: session_token
    })

    console.log(`[temporary-chat-handler] Validation result:`, {
      error: validationError,
      dataLength: sessionData?.length,
      firstRow: sessionData?.[0],
      isValid: sessionData?.[0]?.is_valid
    })

    if (validationError || !sessionData?.[0]?.is_valid) {
      console.log(`[temporary-chat-handler] Invalid session: ${session_token.substring(0, 8)}...`)
      console.log(`[temporary-chat-handler] Validation error:`, validationError)
      console.log(`[temporary-chat-handler] Session data:`, sessionData)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired session',
          details: validationError?.message || 'Session not valid'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const session = sessionData[0]

    // Check if session has reached message limit
    if (session.current_message_count >= session.max_messages_per_session) {
      return new Response(
        JSON.stringify({ 
          error: 'Message limit reached for this session',
          max_messages: session.max_messages_per_session,
          current_messages: session.current_message_count
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting check
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc('check_temp_chat_rate_limit', {
      p_session_token: session_token
    })

    if (rateLimitError) {
      console.error('[temporary-chat-handler] Rate limit check error:', rateLimitError)
    } else if (rateLimitData?.[0] && !rateLimitData[0].allowed) {
      const rateLimit = rateLimitData[0]
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          current_count: rateLimit.current_count,
          limit_per_minute: rateLimit.limit_per_minute,
          reset_time: rateLimit.reset_time
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Content validation and sanitization
    const sanitizedMessage = sanitizeMessage(message)
    if (sanitizedMessage !== message) {
      console.warn(`[temporary-chat-handler] Message sanitized for session: ${session_token.substring(0, 8)}...`)
    }

    // Get client information for security tracking
    const clientIP = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') ||
                     'unknown'

    // Save user message to chat_messages_v2
    const { data: userMessage, error: userMessageError } = await supabase
      .from('chat_messages_v2')
      .insert({
        conversation_id: session.conversation_id,
        role: 'user',
        content: {
          text: sanitizedMessage,
          type: message_type,
          metadata: {
            ...metadata,
            temporary_chat: true,
            session_id: session.session_id,
            ip_address: clientIP
          }
        },
        sender_user_id: null, // Anonymous user
        sender_agent_id: null
      })
      .select('id, created_at')
      .single()

    if (userMessageError) {
      console.error('[temporary-chat-handler] Error saving user message:', userMessageError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save message',
          details: userMessageError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-handler] User message saved: ${userMessage.id}`)

    // Update session metrics
    const { error: updateError } = await supabase
      .from('temporary_chat_sessions')
      .update({
        message_count: session.current_message_count + 1,
        total_characters_sent: (metadata.total_characters_sent || 0) + sanitizedMessage.length,
        last_activity_at: new Date().toISOString(),
        session_metadata: {
          ...metadata,
          last_message_id: userMessage.id,
          last_message_at: userMessage.created_at
        }
      })
      .eq('id', session.session_id)

    if (updateError) {
      console.error('[temporary-chat-handler] Error updating session:', updateError)
      // Continue processing even if session update fails
    }

    // Process message with agent via chat function
    try {
      console.log(`[temporary-chat-handler] Calling chat function for agent: ${session.agent_id}`)
      
      const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat', {
        body: {
          message: sanitizedMessage,
          conversationId: session.conversation_id,
          agentId: session.agent_id,
          sessionType: 'temporary_chat',
          sessionContext: {
            session_id: session.session_id,
            session_token: session_token,
            participant_name: metadata.participant_name,
            is_temporary_chat: true,
            max_messages: session.max_messages_per_session,
            current_messages: session.current_message_count + 1
          }
        }
      })

      if (chatError) {
        console.error('[temporary-chat-handler] Chat function error:', chatError)
        
        // Save error message to chat for user visibility
        await supabase
          .from('chat_messages_v2')
          .insert({
            conversation_id: session.conversation_id,
            role: 'assistant',
            content: {
              text: 'I apologize, but I encountered an error processing your message. Please try again.',
              type: 'error',
              metadata: {
                error_type: 'chat_processing_error',
                temporary_chat: true,
                session_id: session.session_id
              }
            },
            sender_user_id: null,
            sender_agent_id: session.agent_id
          })

        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to process message with agent',
            message_id: userMessage.id,
            conversation_id: session.conversation_id,
            details: chatError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[temporary-chat-handler] Chat processing successful`)

      return new Response(
        JSON.stringify({ 
          success: true,
          message_id: userMessage.id,
          conversation_id: session.conversation_id,
          session_id: session.session_id,
          agent_name: session.agent_name,
          processed_at: new Date().toISOString(),
          remaining_messages: session.max_messages_per_session - (session.current_message_count + 1)
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (chatProcessingError) {
      console.error('[temporary-chat-handler] Chat processing exception:', chatProcessingError)
      
      // Save error message to chat
      await supabase
        .from('chat_messages_v2')
        .insert({
          conversation_id: session.conversation_id,
          role: 'assistant',
          content: {
            text: 'I apologize, but I\'m having trouble responding right now. Please try sending your message again.',
            type: 'error',
            metadata: {
              error_type: 'chat_processing_exception',
              temporary_chat: true,
              session_id: session.session_id
            }
          },
          sender_user_id: null,
          sender_agent_id: session.agent_id
        })

      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Chat processing failed',
          message_id: userMessage.id,
          conversation_id: session.conversation_id,
          message: 'Your message was received but could not be processed. Please try again.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('[temporary-chat-handler] Global error:', error)
    console.error('[temporary-chat-handler] Error stack:', error.stack)
    console.error('[temporary-chat-handler] Error name:', error.name)
    console.error('[temporary-chat-handler] Error message:', error.message)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } finally {
    console.log('[temporary-chat-handler] === REQUEST END ===')
  }
})

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sanitizeMessage(message: string): string {
  // Basic sanitization to prevent XSS and other issues
  let sanitized = message.trim()
  
  // Remove potentially dangerous patterns
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ]
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[Content removed for security]')
  }
  
  // Limit excessive whitespace
  sanitized = sanitized.replace(/\s{3,}/g, '   ')
  
  // Ensure reasonable length
  if (sanitized.length > 4000) {
    sanitized = sanitized.substring(0, 3997) + '...'
  }
  
  return sanitized
}

function isValidMessageType(type: string): boolean {
  return ['text', 'file'].includes(type)
}

function logSecurityEvent(
  supabase: any,
  eventType: string,
  sessionToken: string,
  details: Record<string, any>
) {
  // Log security events for monitoring
  // This would integrate with the existing audit system
  try {
    supabase
      .from('tool_execution_logs')
      .insert({
        agent_id: null,
        user_id: null,
        tool_name: 'temporary_chat_security_event',
        execution_status: 'warning',
        execution_details: {
          event_type: eventType,
          session_token_hint: sessionToken.substring(0, 8),
          timestamp: new Date().toISOString(),
          ...details
        }
      })
  } catch (error) {
    console.error('[temporary-chat-handler] Failed to log security event:', error)
  }
}
