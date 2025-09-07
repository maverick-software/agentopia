import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OutlookApiRequest {
  action: 'send_email' | 'read_emails' | 'create_event' | 'read_events'
  params: {
    to?: string[]
    cc?: string[]
    bcc?: string[]
    subject?: string
    body?: string
    body_type?: 'text' | 'html'
    importance?: 'low' | 'normal' | 'high'
    folder?: string
    limit?: number
    search?: string
    unread_only?: boolean
    start?: string
    end?: string
    location?: string
    attendees?: string[]
    is_online_meeting?: boolean
    start_date?: string
    end_date?: string
  }
  agent_id: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[microsoft-outlook-api] Raw request method: ${req.method}`)
    console.log(`[microsoft-outlook-api] Raw request headers:`, Object.fromEntries(req.headers.entries()))
    
    let requestBody: OutlookApiRequest
    try {
      const rawText = await req.text()
      console.log(`[microsoft-outlook-api] Raw request body:`, rawText)
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Request body is empty')
      }
      
      requestBody = JSON.parse(rawText)
      console.log(`[microsoft-outlook-api] Parsed request body:`, JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error(`[microsoft-outlook-api] JSON parse error:`, parseError)
      throw new Error(`Failed to parse request body: ${parseError.message}`)
    }
    
    const { action, params, agent_id } = requestBody
    console.log('Microsoft Outlook API request:', { action, agent_id })
    console.log('Params received:', JSON.stringify(params, null, 2))

    // Validate required parameters
    if (!action || !params || !agent_id) {
      console.error('Missing parameters:', { action: !!action, params: !!params, agent_id: !!agent_id })
      
      if (!action) {
        throw new Error('Question: What Outlook action would you like me to perform? Please specify send_email, read_emails, create_event, or read_events.')
      }
      if (!agent_id) {
        throw new Error('Missing agent context. Please retry with proper agent identification.')
      }
      if (!params) {
        throw new Error('Question: What Outlook details would you like me to use? Please provide the required parameters for the action.')
      }
      
      throw new Error('Please provide the required Outlook parameters: action, details, and agent context.')
    }

    // Create Supabase clients
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    const user_id = user.id
    console.log(`[microsoft-outlook-api] Processing request for user: ${user_id}, agent: ${agent_id}`)

    // Validate agent permissions
    const { data: permissionData, error: permissionError } = await supabaseServiceRole
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        user_integration_credentials!inner(
          oauth_provider_id,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('user_integration_credentials.service_providers.name', 'microsoft-outlook')
      .eq('is_active', true)
      .single()

    if (permissionError || !permissionData) {
      throw new Error(`No Microsoft Outlook permissions found for agent: ${permissionError?.message || 'None'}`)
    }

    // Get user's Microsoft Outlook access token from integration credentials
    const { data: outlookProvider, error: providerError } = await supabaseServiceRole
      .from('service_providers')
      .select('id')
      .eq('name', 'microsoft-outlook')
      .single()

    if (providerError || !outlookProvider) {
      throw new Error(`Microsoft Outlook OAuth provider not found: ${providerError?.message || 'Not found'}`)
    }

    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .select('vault_access_token_id, vault_refresh_token_id, token_expires_at, connection_status, created_at, updated_at')
      .eq('user_id', user_id)
      .eq('oauth_provider_id', outlookProvider.id)
      .eq('connection_status', 'active')
      .single()

    console.log('[microsoft-outlook-api] Connection query result:', {
      connection,
      connectionError,
      user_id: user_id,
      outlook_provider_id: outlookProvider.id
    })

    if (connectionError || !connection) {
      const { data: allConnections } = await supabaseServiceRole
        .from('user_integration_credentials')
        .select('id, connection_status, oauth_provider_id, created_at, updated_at')
        .eq('user_id', user_id)
      
      console.log('[microsoft-outlook-api] All user connections:', allConnections)
      
      throw new Error(`No active Microsoft Outlook connection found: ${connectionError?.message || 'Not found'}`)
    }

    let accessToken: string
    
    // Check if token is expired and refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      console.log('[microsoft-outlook-api] Access token expired, attempting refresh...')
      
      // Get refresh token from vault
      const { data: refreshTokenData, error: refreshTokenError } = await supabaseServiceRole
        .from('vault.secrets')
        .select('secret')
        .eq('id', connection.vault_refresh_token_id)
        .single()

      if (refreshTokenError || !refreshTokenData) {
        throw new Error(`Failed to get refresh token: ${refreshTokenError?.message || 'Not found'}`)
      }

      // Refresh the access token using Microsoft Graph API
      const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshTokenData.secret,
          client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
          client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
        }),
      })

      if (!refreshResponse.ok) {
        throw new Error(`Failed to refresh Microsoft Outlook token: ${refreshResponse.statusText}`)
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update the access token in vault
      await supabaseServiceRole
        .from('vault.secrets')
        .update({ secret: accessToken })
        .eq('id', connection.vault_access_token_id)

      // Update token expiry
      const newExpiryTime = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
      await supabaseServiceRole
        .from('user_integration_credentials')
        .update({ token_expires_at: newExpiryTime })
        .eq('user_id', user_id)
        .eq('oauth_provider_id', outlookProvider.id)

      console.log('[microsoft-outlook-api] Token refreshed successfully')
    } else {
      // Get current access token from vault
      const { data: tokenData, error: tokenError } = await supabaseServiceRole
        .from('vault.secrets')
        .select('secret')
        .eq('id', connection.vault_access_token_id)
        .single()

      if (tokenError || !tokenData) {
        throw new Error(`Failed to get access token: ${tokenError?.message || 'Not found'}`)
      }

      accessToken = tokenData.secret
    }

    // Execute the requested action
    let result: any

    switch (action) {
      case 'send_email':
        result = await sendOutlookEmail(accessToken, params)
        break
      case 'read_emails':
        result = await readOutlookEmails(accessToken, params)
        break
      case 'create_event':
        result = await createOutlookEvent(accessToken, params)
        break
      case 'read_events':
        result = await readOutlookEvents(accessToken, params)
        break
      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    // Log the operation
    await supabaseServiceRole
      .from('tool_execution_logs')
      .insert({
        user_id: user_id,
        agent_id: agent_id,
        tool_name: 'microsoft_outlook_api',
        operation_type: action,
        operation_params: params,
        operation_result: result,
        status: 'success',
        execution_time_ms: Date.now() - parseInt(req.headers.get('x-request-start') || '0')
      })

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('[microsoft-outlook-api] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

// Helper functions for Microsoft Outlook API operations
async function sendOutlookEmail(accessToken: string, params: any) {
  const { to, cc, bcc, subject, body, body_type = 'text', importance = 'normal' } = params

  if (!to || !to.length || !subject || !body) {
    throw new Error('To, subject, and body are required')
  }

  const emailBody = {
    message: {
      subject: subject,
      body: {
        contentType: body_type,
        content: body
      },
      toRecipients: to.map((email: string) => ({
        emailAddress: {
          address: email
        }
      })),
      ccRecipients: cc ? cc.map((email: string) => ({
        emailAddress: {
          address: email
        }
      })) : [],
      bccRecipients: bcc ? bcc.map((email: string) => ({
        emailAddress: {
          address: email
        }
      })) : [],
      importance: importance
    }
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send Outlook email: ${response.status} ${errorText}`)
  }

  // sendMail returns 202 with no content on success
  return { message: 'Email sent successfully' }
}

async function readOutlookEmails(accessToken: string, params: any) {
  const { folder = 'inbox', limit = 50, search, unread_only = false } = params

  let endpoint = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${limit}&$orderby=receivedDateTime desc`

  if (search) {
    endpoint += `&$search="${search}"`
  }

  if (unread_only) {
    endpoint += `&$filter=isRead eq false`
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to read Outlook emails: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function createOutlookEvent(accessToken: string, params: any) {
  const { subject, start, end, location, attendees = [], body, is_online_meeting = false } = params

  if (!subject || !start || !end) {
    throw new Error('Subject, start, and end are required')
  }

  const eventBody = {
    subject: subject,
    body: body ? {
      contentType: 'text',
      content: body
    } : undefined,
    start: {
      dateTime: start,
      timeZone: 'UTC'
    },
    end: {
      dateTime: end,
      timeZone: 'UTC'
    },
    location: location ? {
      displayName: location
    } : undefined,
    attendees: attendees.map((email: string) => ({
      emailAddress: {
        address: email,
        name: email
      },
      type: 'required'
    })),
    isOnlineMeeting: is_online_meeting,
    onlineMeetingProvider: is_online_meeting ? 'teamsForBusiness' : undefined
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create Outlook event: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function readOutlookEvents(accessToken: string, params: any) {
  const { start_date, end_date, limit = 50 } = params

  let endpoint = `https://graph.microsoft.com/v1.0/me/events?$top=${limit}&$orderby=start/dateTime`

  if (start_date || end_date) {
    const filters = []
    if (start_date) {
      filters.push(`start/dateTime ge '${start_date}T00:00:00.000Z'`)
    }
    if (end_date) {
      filters.push(`end/dateTime le '${end_date}T23:59:59.999Z'`)
    }
    endpoint += `&$filter=${filters.join(' and ')}`
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to read Outlook events: ${response.status} ${errorText}`)
  }

  return await response.json()
}
