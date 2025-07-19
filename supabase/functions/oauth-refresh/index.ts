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

    console.log('Starting OAuth refresh for connection:', connection_id, 'user:', userId)

    // This function now ONLY uses the secure Vault retrieval method.
    // The legacy fallback has been removed as it was causing errors.
    // The root cause is in the get_oauth_token SQL function, which will be fixed.

    // Handle refresh based on provider
    let refreshResult = null
    refreshResult = await refreshGmailToken(supabase, connection_id, userId)

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

async function refreshGmailToken(supabase: any, connection_id: string, userId: string): Promise<any> {
  let refreshToken: string
  
  try {
    // Try to get refresh token from secure vault storage
    const { data: secureTokens, error: tokenError } = await supabase.rpc(
      'get_oauth_token',
      { p_user_id: userId, p_provider: 'gmail' }
    )

    if (tokenError) {
      throw new Error(`Failed to retrieve secure tokens: ${tokenError.message}`)
    }

    if (!secureTokens || secureTokens.length === 0) {
      throw new Error('No secure tokens found')
    }

    refreshToken = secureTokens[0].refresh_token

  } catch (vaultError) {
    console.error('Secure token retrieval failed:', vaultError)
    throw new Error('Failed to retrieve refresh token - no active Gmail connection found')
  }

  if (!refreshToken) {
    throw new Error('No refresh token available')
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

  const tokens: any = await tokenResponse.json()

  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

  try {
    // Use the secure update function
    await supabase.rpc('update_oauth_token', {
      p_user_id: userId,
      p_provider: 'gmail',
      p_new_access_token: tokens.access_token,
      p_new_refresh_token: tokens.refresh_token || null,
      p_new_expires_in: tokens.expires_in
    })
    console.log('Token refreshed and stored securely')

  } catch (updateError) {
    console.warn('Secure token update failed, falling back to legacy update:', updateError)
    
    // Fallback to legacy update method
    // Encrypt new access token using legacy method
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

    // Update using legacy method
    const { error: legacyUpdateError } = await supabase
      .from('user_oauth_connections')
      .update({
        vault_access_token_id: encryptedAccessToken,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection_id)
      .eq('user_id', userId)

    if (legacyUpdateError) {
      throw new Error('Failed to update connection with new token using legacy method')
    }
    
    console.log('Token refreshed using legacy storage')
  }

  return {
    expires_at: newExpiresAt
  }
} 