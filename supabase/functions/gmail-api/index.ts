import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GmailAPIRequest {
  agent_id: string;
  action: string;
  parameters: Record<string, any>;
}

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestData: GmailAPIRequest = await req.json()
    const { agent_id, action, parameters } = requestData
    
    if (!agent_id || !action) {
      throw new Error('agent_id and action are required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header provided')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Validate agent permissions for Gmail
    const requiredScopes = getRequiredScopes(action)
    const { data: hasPermissions, error: permissionError } = await supabase.rpc(
      'validate_agent_gmail_permissions',
      {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_required_scopes: requiredScopes
      }
    )

    if (permissionError || !hasPermissions) {
      throw new Error('Agent does not have required permissions for this Gmail operation')
    }

    // Get user's Gmail connection and decrypt tokens
    const { data: gmailConnection, error: connectionError } = await supabase.rpc(
      'get_user_gmail_connection',
      { p_user_id: user.id }
    )

    if (connectionError || !gmailConnection || gmailConnection.length === 0) {
      throw new Error('No active Gmail connection found')
    }

    const connection = gmailConnection[0]

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await supabase.rpc(
      'vault_decrypt',
      { vault_id: connection.vault_access_token_id }
    )

    if (decryptError || !accessToken) {
      throw new Error('Failed to decrypt Gmail access token')
    }

    // Check if token needs refresh
    const tokenExpiresAt = new Date(connection.token_expires_at)
    const now = new Date()
    
    let currentAccessToken = accessToken
    if (tokenExpiresAt <= now) {
      // Token has expired, refresh it
      currentAccessToken = await refreshGmailToken(supabase, connection, user.id)
    }

    // Execute Gmail operation
    const startTime = Date.now()
    let result: any
    let quotaConsumed = 0

    try {
      switch (action) {
        case 'send_email':
          result = await sendEmail(currentAccessToken, parameters as EmailMessage)
          quotaConsumed = 100 // Sending emails costs 100 quota units
          break
        
        case 'read_emails':
          result = await readEmails(currentAccessToken, parameters)
          quotaConsumed = 5 * (parameters.max_results || 50) // 5 units per message
          break
        
        case 'search_emails':
          result = await searchEmails(currentAccessToken, parameters)
          quotaConsumed = 5 * (parameters.max_results || 50)
          break
        
        case 'manage_labels':
          result = await manageLabels(currentAccessToken, parameters)
          quotaConsumed = 5 // Label operations cost 5 units
          break
        
        default:
          throw new Error(`Unsupported Gmail action: ${action}`)
      }

      const executionTime = Date.now() - startTime

      // Log successful operation
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_operation_type: action,
        p_operation_params: parameters,
        p_operation_result: result,
        p_status: 'success',
        p_quota_consumed: quotaConsumed,
        p_execution_time_ms: executionTime
      })

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          quota_consumed: quotaConsumed,
          execution_time_ms: executionTime
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } catch (operationError) {
      const executionTime = Date.now() - startTime
      
      // Log failed operation
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_operation_type: action,
        p_operation_params: parameters,
        p_operation_result: null,
        p_status: 'error',
        p_error_message: operationError.message,
        p_quota_consumed: 0,
        p_execution_time_ms: executionTime
      })

      throw operationError
    }

  } catch (error) {
    console.error('Gmail API error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Helper function to get required scopes for each action
function getRequiredScopes(action: string): string[] {
  const scopeMap: Record<string, string[]> = {
    'send_email': ['gmail.send'],
    'read_emails': ['gmail.readonly'],
    'search_emails': ['gmail.readonly'],
    'manage_labels': ['gmail.labels'],
  }
  
  return scopeMap[action] || []
}

// Gmail API Operations

async function sendEmail(accessToken: string, message: EmailMessage): Promise<any> {
  // Create RFC 2822 email format
  const boundary = `boundary_${Date.now()}`
  let email = ''
  
  // Headers
  email += `To: ${message.to}\r\n`
  email += `Subject: ${message.subject}\r\n`
  email += 'MIME-Version: 1.0\r\n'
  
  if (message.attachments && message.attachments.length > 0) {
    email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`
    
    // Text/HTML body
    email += `--${boundary}\r\n`
    email += `Content-Type: ${message.html ? 'text/html' : 'text/plain'}; charset="UTF-8"\r\n\r\n`
    email += `${message.html || message.body}\r\n\r\n`
    
    // Attachments
    for (const attachment of message.attachments) {
      email += `--${boundary}\r\n`
      email += `Content-Type: ${attachment.contentType}\r\n`
      email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`
      email += 'Content-Transfer-Encoding: base64\r\n\r\n'
      email += `${attachment.content}\r\n\r\n`
    }
    
    email += `--${boundary}--`
  } else {
    email += `Content-Type: ${message.html ? 'text/html' : 'text/plain'}; charset="UTF-8"\r\n\r\n`
    email += `${message.html || message.body}`
  }

  // Convert to base64url
  const encodedEmail = btoa(email)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedEmail
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorDetails = ''
    
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error) {
        errorDetails = errorJson.error.message || errorJson.error.code || errorText
      } else {
        errorDetails = errorText
      }
    } catch {
      errorDetails = errorText
    }
    
    console.error('Gmail API error response:', {
      status: response.status,
      statusText: response.statusText,
      error: errorDetails
    })
    
    // Provide user-friendly error messages
    if (response.status === 401) {
      throw new Error('Gmail authentication failed. Please reconnect your Gmail account.')
    } else if (response.status === 403) {
      throw new Error('Permission denied. Please ensure you granted email sending permissions.')
    } else if (response.status === 400) {
      throw new Error(`Invalid email format: ${errorDetails}`)
    } else {
      throw new Error(`Failed to send email: ${errorDetails}`)
    }
  }

  return await response.json()
}

async function readEmails(accessToken: string, parameters: any): Promise<any> {
  const { query = '', max_results = 50, label_ids = [] } = parameters
  
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max_results}`
  
  if (query) {
    url += `&q=${encodeURIComponent(query)}`
  }
  
  if (label_ids.length > 0) {
    label_ids.forEach((labelId: string) => {
      url += `&labelIds=${encodeURIComponent(labelId)}`
    })
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to read emails: ${error}`)
  }

  const messageList = await response.json()
  
  // Get detailed information for each message
  if (messageList.messages && messageList.messages.length > 0) {
    const detailedMessages = await Promise.all(
      messageList.messages.slice(0, Math.min(10, messageList.messages.length)).map(async (msg: any) => {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        )
        
        if (detailResponse.ok) {
          return await detailResponse.json()
        }
        return msg
      })
    )
    
    messageList.detailed_messages = detailedMessages
  }

  return messageList
}

async function searchEmails(accessToken: string, parameters: any): Promise<any> {
  const { query, labels = [], max_results = 50 } = parameters
  
  let searchQuery = query
  if (labels.length > 0) {
    searchQuery += ` label:(${labels.join(' OR ')})`
  }

  return await readEmails(accessToken, { query: searchQuery, max_results })
}

async function manageLabels(accessToken: string, parameters: any): Promise<any> {
  const { action, label_name, label_id, message_ids = [] } = parameters
  
  switch (action) {
    case 'create':
      const createResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: label_name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }),
      })
      
      if (!createResponse.ok) {
        const error = await createResponse.text()
        throw new Error(`Failed to create label: ${error}`)
      }
      
      return await createResponse.json()
    
    case 'list':
      const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      
      if (!listResponse.ok) {
        const error = await listResponse.text()
        throw new Error(`Failed to list labels: ${error}`)
      }
      
      return await listResponse.json()
    
    case 'apply':
      if (!label_id || message_ids.length === 0) {
        throw new Error('label_id and message_ids are required for apply action')
      }
      
      const results = await Promise.all(
        message_ids.map(async (messageId: string) => {
          const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                addLabelIds: [label_id]
              }),
            }
          )
          
          return {
            messageId,
            success: response.ok,
            result: response.ok ? await response.json() : await response.text()
          }
        })
      )
      
      return { applied_to_messages: results }
    
    default:
      throw new Error(`Unsupported label action: ${action}`)
  }
}

async function refreshGmailToken(supabase: any, connection: any, userId: string): Promise<string> {
  // Decrypt refresh token
  const { data: refreshToken, error: decryptError } = await supabase.rpc(
    'vault_decrypt',
    { vault_id: connection.vault_refresh_token_id }
  )

  if (decryptError || !refreshToken) {
    throw new Error('Failed to decrypt refresh token')
  }

  // Get Google OAuth credentials
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

  // Refresh the token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const tokens = await tokenResponse.json()

  // Encrypt new access token
  const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc(
    'vault_encrypt',
    {
      secret: tokens.access_token,
      key_id: 'gmail_oauth_tokens'
    }
  )

  if (encryptError) {
    throw new Error('Failed to encrypt refreshed access token')
  }

  // Update the connection with new token
  await supabase
    .from('user_oauth_connections')
    .update({
      vault_access_token_id: encryptedAccessToken,
      token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', connection.connection_id)

  return tokens.access_token
} 