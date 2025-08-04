import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefreshRequest {
  connection_id: string;
}

async function refreshGmailToken(supabase: SupabaseClient, userId: string, connectionId: string): Promise<{ success: boolean; expires_at?: string }> {
  console.log(`Refreshing Gmail token for user ${userId}, connection ${connectionId}`);

  // Get the connection details including credential type
  const { data: connection, error: fetchError } = await supabase
    .from('user_oauth_connections')
    .select('vault_refresh_token_id, external_username, credential_type, oauth_providers!inner(name)')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !connection) {
    throw new Error(`Failed to retrieve connection: ${fetchError?.message || 'Connection not found'}`);
  }

  // Check if this is an API key connection (cannot be refreshed)
  if (connection.credential_type === 'api_key') {
    throw new Error('API keys cannot be refreshed. Please update your API key if it has expired.');
  }

  // Check if this is an OAuth connection with a refresh token
  if (connection.credential_type === 'oauth' && !connection.vault_refresh_token_id) {
    throw new Error('No refresh token found for this OAuth connection.');
  }
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  console.log('Making token refresh request to Google...');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.vault_refresh_token_id,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token refresh failed:', error);
    throw new Error(`Token refresh failed: ${error}`);
  }

  const newTokens = await tokenResponse.json();
  console.log(`Received new tokens. Has refresh token: ${!!newTokens.refresh_token}`);

  // Calculate expiry time
  const expiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString();

  // Update the connection with new tokens
  const updateData: any = {
    vault_access_token_id: newTokens.access_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString()
  };

  // Update refresh token if a new one was provided
  if (newTokens.refresh_token) {
    updateData.vault_refresh_token_id = newTokens.refresh_token;
  }

  const { error: updateError } = await supabase
    .from('user_oauth_connections')
    .update(updateData)
    .eq('id', connectionId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to update tokens: ${updateError.message}`);
  }

  console.log('Token refresh completed successfully, expires at:', expiresAt);
  return { success: true, expires_at: expiresAt };
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

    const { success, expires_at } = await refreshGmailToken(supabase, user.id, connection_id);

    const expiryDate = new Date(expires_at!);
    const message = `Token refreshed successfully! New expiry: ${expiryDate.toLocaleString()}`;

    return new Response(JSON.stringify({ 
      success: success, 
      message: message,
      expires_at: expires_at 
    }), {
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