import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefreshRequest {
  connection_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { connection_id } = await req.json() as RefreshRequest
    
    if (!connection_id) {
      throw new Error('connection_id is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user from JWT or extract from connection if using service role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header provided')
    }

    let userId: string
    
    // Check if this is a service role key (starts with 'eyJ' and is longer than user tokens)
    const token = authHeader.replace('Bearer ', '')
    const isServiceRole = token === supabaseServiceKey
    
    if (isServiceRole) {
      // When using service role, get user from the connection
      const { data: connData, error: connError } = await supabase
        .from('user_oauth_connections')
        .select('user_id')
        .eq('id', connection_id)
        .single()
      
      if (connError || !connData) {
        throw new Error('Connection not found')
      }
      
      userId = connData.user_id
    } else {
      // Regular user auth
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      
      if (userError || !user) {
        throw new Error('Invalid or expired token')
      }
      
      userId = user.id
    }

    // Get the Gmail connection using the same RPC as gmail-api
    const { data: gmailConnection, error: connectionError } = await supabase.rpc(
      'get_user_gmail_connection',
      { p_user_id: userId }
    )

    if (connectionError || !gmailConnection || gmailConnection.length === 0) {
      throw new Error('No active Gmail connection found')
    }

    const connection = gmailConnection[0]
    
    // Verify this is the requested connection
    if (connection.connection_id !== connection_id) {
      throw new Error('Connection ID mismatch')
    }

    // Handle refresh based on provider
    let refreshResult = null
    refreshResult = await refreshGmailToken(supabase, connection, userId)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token refreshed successfully',
        expires_at: refreshResult.expires_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('OAuth refresh error:', error)
    
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

async function refreshGmailToken(supabase: any, connection: any, userId: string): Promise<any> {
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

  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

  // Update the connection with new token
  const { error: updateError } = await supabase
    .from('user_oauth_connections')
    .update({
      vault_access_token_id: encryptedAccessToken,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.connection_id)
    .eq('user_id', userId)

  if (updateError) {
    throw new Error('Failed to update connection with new token')
  }

  return {
    expires_at: newExpiresAt
  }
} 