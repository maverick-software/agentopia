import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Helper function to create or update secrets in the Vault
async function createOrUpdateVaultSecrets(
  supabase: SupabaseClient,
  userId: string,
  tokens: OAuthTokenResponse
) {
  const accessTokenName = `gmail_access_token_${userId}`;
  const refreshTokenName = `gmail_refresh_token_${userId}`;
  const description = `Gmail OAuth tokens for user ${userId}`;

  // Check if secrets already exist by name using the new RPC function
  const { data: existingSecrets, error: rpcError } = await supabase
    .rpc('get_vault_secrets_by_names', {
      p_secret_names: [accessTokenName, refreshTokenName]
    });

  if (rpcError) {
    throw new Error(`Failed to check for existing secrets via RPC: ${rpcError.message}`);
  }

  const existingAccessToken = existingSecrets.find(s => s.name === accessTokenName);
  const existingRefreshToken = existingSecrets.find(s => s.name === refreshTokenName);

  // Update or create access token
  if (existingAccessToken) {
    const { error } = await supabase.rpc('update_vault_secret', {
      p_secret_id: existingAccessToken.id,
      p_new_secret: tokens.access_token,
    });
    if (error) throw new Error(`Failed to update access token: ${error.message}`);
  } else {
    const { error } = await supabase.rpc('create_vault_secret', {
      p_secret: tokens.access_token,
      p_name: accessTokenName,
      p_description: description,
    });
    if (error) throw new Error(`Failed to create access token: ${error.message}`);
  }

  // Update or create refresh token if it exists
  if (tokens.refresh_token) {
    if (existingRefreshToken) {
      const { error } = await supabase.rpc('update_vault_secret', {
        p_secret_id: existingRefreshToken.id,
        p_new_secret: tokens.refresh_token,
      });
      if (error) throw new Error(`Failed to update refresh token: ${error.message}`);
    } else {
      const { error } = await supabase.rpc('create_vault_secret', {
        p_secret: tokens.refresh_token,
        p_name: refreshTokenName,
        p_description: description,
      });
      if (error) throw new Error(`Failed to create refresh token: ${error.message}`);
    }
  }
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    const tokenParams: any = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirect_uri,
    }

    if (code_verifier) {
      tokenParams.code_verifier = code_verifier
    }

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

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      throw new Error(`Failed to fetch user information: ${userInfoResponse.status} - ${errorText}`)
    }

    const userInfo: UserInfo = await userInfoResponse.json()

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

    await createOrUpdateVaultSecrets(supabase, user.id, tokens);
    console.log('OAuth tokens stored securely in Vault.');

    const { data: oauthProvider, error: providerError } = await supabase
      .from('oauth_providers')
      .select('id')
      .eq('name', 'gmail')
      .single()

    if (providerError) {
      throw new Error(`Gmail OAuth provider query failed: ${providerError.message}`)
    }
    if (!oauthProvider) {
      throw new Error('Gmail OAuth provider not found in database')
    }

    const scopesGranted = tokens.scope.split(' ');
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    const { data: connection, error: upsertError } = await supabase
      .from('user_oauth_connections')
      .upsert({
        user_id: user.id,
        oauth_provider_id: oauthProvider.id,
        external_username: userInfo.email,
        connection_name: userInfo.email,
        external_user_id: userInfo.id,
        scopes_granted: scopesGranted,
        token_expires_at: expiresAt,
        connection_status: 'active',
        connection_metadata: {
          user_name: userInfo.name,
          user_picture: userInfo.picture,
          last_connected: new Date().toISOString(),
        },
      }, {
        onConflict: 'user_id, oauth_provider_id, external_username',
      })
      .select('id')
      .single();

    if (upsertError) {
      throw new Error(`Failed to upsert OAuth connection: ${upsertError.message}`);
    }

    const { error: configError } = await supabase
      .from('gmail_configurations')
      .upsert({
        user_oauth_connection_id: connection.id,
        security_settings: {
          require_confirmation_for_send: true,
          allow_delete_operations: false,
          restrict_to_specific_labels: [],
        },
        rate_limit_settings: {
          max_requests_per_minute: 100,
          batch_size: 10,
        },
      }, {
        onConflict: 'user_oauth_connection_id',
      });

    if (configError) {
      console.error('Failed to create/update Gmail configuration:', configError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection_id: connection.id,
        user_email: userInfo.email,
        scopes: scopesGranted,
        expires_at: expiresAt,
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