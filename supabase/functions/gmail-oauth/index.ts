import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface UserInfo {
  email: string;
  name: string;
  picture: string;
  id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, state, redirect_uri, code_verifier } = await req.json()
    
    if (!code) {
      throw new Error('Authorization code is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Google OAuth credentials from environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    // Build token exchange parameters
    const tokenParams: any = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirect_uri,
    }

    // Add code_verifier if using PKCE
    if (code_verifier) {
      tokenParams.code_verifier = code_verifier
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const tokens: OAuthTokenResponse = await tokenResponse.json()

    // Get user information from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      console.error('User info fetch failed:', {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        error: errorText
      })
      throw new Error(`Failed to fetch user information: ${userInfoResponse.status} - ${errorText}`)
    }

    const userInfo: UserInfo = await userInfoResponse.json()

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

    // Get Gmail OAuth provider ID
    const { data: oauthProvider, error: providerError } = await supabase
      .from('oauth_providers')
      .select('id')
      .eq('name', 'gmail')
      .single()

    if (providerError) {
      console.error('OAuth provider query error:', {
        error: providerError,
        message: providerError.message,
        details: providerError.details,
        hint: providerError.hint
      })
      throw new Error(`Gmail OAuth provider query failed: ${providerError.message}`)
    }

    if (!oauthProvider) {
      throw new Error('Gmail OAuth provider not found in database')
    }

    // Store tokens in Supabase Vault
    console.log('Starting vault storage for tokens...')
    let vaultAccessTokenId: string | null = null
    let vaultRefreshTokenId: string | null = null

    // Create vault secret for access token
    console.log('Creating vault secret for access token...')
    const { data: accessTokenSecret, error: accessTokenError } = await supabase.rpc('create_vault_secret', {
      secret_value: tokens.access_token,
      name: `gmail_access_token_${user.id}_${Date.now()}`,
      description: `Gmail access token for user ${userInfo.email}`
    })

    if (accessTokenError) {
      throw new Error(`Failed to store access token in vault: ${accessTokenError.message}`)
    }

    vaultAccessTokenId = accessTokenSecret
    console.log('Access token vault ID:', vaultAccessTokenId)

    // Create vault secret for refresh token if it exists
    if (tokens.refresh_token) {
      const { data: refreshTokenSecret, error: refreshTokenError } = await supabase.rpc('create_vault_secret', {
        secret_value: tokens.refresh_token,
        name: `gmail_refresh_token_${user.id}_${Date.now()}`,
        description: `Gmail refresh token for user ${userInfo.email}`
      })

      if (refreshTokenError) {
        throw new Error(`Failed to store refresh token in vault: ${refreshTokenError.message}`)
      }

      vaultRefreshTokenId = refreshTokenSecret
    }

    // Check if user already has a Gmail connection
    const { data: existingConnection } = await supabase
      .from('user_oauth_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('oauth_provider_id', oauthProvider.id)
      .single()

    let connectionId: string

    if (existingConnection) {
      // Update existing connection
      const { data: updatedConnection, error: updateError } = await supabase
        .from('user_oauth_connections')
        .update({
          external_user_id: userInfo.id,
          external_username: userInfo.email,
          scopes_granted: tokens.scope.split(' '),
          vault_access_token_id: vaultAccessTokenId,
          vault_refresh_token_id: vaultRefreshTokenId,
          token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
          connection_status: 'active',
          connection_metadata: {
            user_name: userInfo.name,
            user_picture: userInfo.picture,
            last_connected: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id)
        .select('id')
        .single()

      if (updateError) {
        throw new Error(`Failed to update OAuth connection: ${updateError.message}`)
      }

      connectionId = updatedConnection.id
    } else {
      // Create new connection
      const { data: newConnection, error: insertError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          oauth_provider_id: oauthProvider.id,
          external_user_id: userInfo.id,
          external_username: userInfo.email,
          scopes_granted: tokens.scope.split(' '),
          vault_access_token_id: vaultAccessTokenId,
          vault_refresh_token_id: vaultRefreshTokenId,
          token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
          connection_status: 'active',
          connection_metadata: {
            user_name: userInfo.name,
            user_picture: userInfo.picture,
            first_connected: new Date().toISOString(),
          },
        })
        .select('id')
        .single()

      if (insertError) {
        throw new Error(`Failed to create OAuth connection: ${insertError.message}`)
      }

      connectionId = newConnection.id
    }

    // Create or update Gmail configuration
    const { error: configError } = await supabase
      .from('gmail_configurations')
      .upsert({
        user_oauth_connection_id: connectionId,
        security_settings: {
          require_confirmation_for_send: true,
          allow_delete_operations: false,
          restrict_to_specific_labels: [],
        },
        rate_limit_settings: {
          max_requests_per_minute: 100,
          batch_size: 10,
        },
      })

    if (configError) {
      console.error('Failed to create Gmail configuration:', {
        error: configError,
        message: configError.message,
        details: configError.details,
        hint: configError.hint,
        code: configError.code
      })
      // Don't fail the request for configuration errors
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection_id: connectionId,
        user_email: userInfo.email,
        scopes: tokens.scope.split(' '),
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Gmail OAuth error:', error)
    
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