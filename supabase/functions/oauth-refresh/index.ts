import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefreshRequest {
  connection_id: string;
}

async function refreshGmailToken(supabase: SupabaseClient, userId: string, connectionId: string): Promise<{ success: boolean }> {
  console.log(`Refreshing Gmail token for user ${userId}, connection ${connectionId}`);

  // Get the refresh token from user_oauth_connections table
  const { data: connection, error: fetchError } = await supabase
    .from('user_oauth_connections')
    .select('refresh_token, external_username')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !connection) {
    throw new Error(`Failed to retrieve connection: ${fetchError?.message || 'Connection not found'}`);
  }

  if (!connection.refresh_token) {
    throw new Error('No refresh token found for this connection.');
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
      refresh_token: connection.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token refresh failed:', error);
    throw new Error(`Token refresh failed: ${error}`);
  }

  const newTokens = await tokenResponse.json();
  console.log(`Received new tokens. Has refresh token: ${!!newTokens.refresh_token}`);

  // Update the connection with new tokens
  const updateData: any = {
    access_token: newTokens.access_token,
    token_expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString(),
    updated_at: new Date().toISOString()
  };

  // Update refresh token if a new one was provided
  if (newTokens.refresh_token) {
    updateData.refresh_token = newTokens.refresh_token;
  }

  const { error: updateError } = await supabase
    .from('user_oauth_connections')
    .update(updateData)
    .eq('id', connectionId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to update tokens: ${updateError.message}`);
  }

  console.log('Token refresh completed successfully');
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

    await refreshGmailToken(supabase, user.id, connection_id);

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