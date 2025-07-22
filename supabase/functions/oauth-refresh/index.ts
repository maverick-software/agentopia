import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefreshRequest {
  connection_id: string;
}

// This helper function will now be shared or colocated
async function createOrUpdateVaultSecrets(
  supabase: SupabaseClient,
  userId: string,
  tokens: { access_token: string; refresh_token?: string }
) {
  const accessTokenName = `gmail_access_token_${userId}`;
  const refreshTokenName = `gmail_refresh_token_${userId}`;
  const description = `Gmail OAuth tokens for user ${userId}`;

  const { data: existingSecrets, error: selectError } = await supabase
    .from('secrets')
    .select('id, name')
    .in('name', [accessTokenName, refreshTokenName])
    .schema('vault');

  if (selectError) throw new Error(`Failed to check for existing secrets: ${selectError.message}`);

  const existingAccessToken = existingSecrets.find(s => s.name === accessTokenName);

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

  if (tokens.refresh_token) {
    const existingRefreshToken = existingSecrets.find(s => s.name === refreshTokenName);
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

async function refreshGmailToken(supabase: SupabaseClient, userId: string): Promise<{ success: boolean }> {
  const refreshTokenName = `gmail_refresh_token_${userId}`;

  // Get the refresh token directly from the Vault using the RPC function
  const { data: secrets, error: rpcError } = await supabase
    .rpc('get_vault_secrets_by_names', { 
      p_secret_names: [refreshTokenName] 
    });

  if (rpcError || !secrets || secrets.length === 0) {
    throw new Error(`Failed to retrieve refresh token from Vault: ${rpcError?.message || 'Not found'}`);
  }

  const refreshToken = secrets[0].decrypted_secret;
  if (!refreshToken) {
    throw new Error('Refresh token is empty in Vault.');
  }
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const newTokens = await tokenResponse.json();

  // We only need to update the access token, as the refresh token might not change
  await createOrUpdateVaultSecrets(supabase, userId, {
    access_token: newTokens.access_token,
  });

  return { success: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { connection_id }: RefreshRequest = await req.json()
    if (!connection_id) {
      throw new Error('connection_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    await refreshGmailToken(supabase, user.id);

    return new Response(JSON.stringify({ success: true, message: 'Token refreshed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('OAuth refresh error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}) 