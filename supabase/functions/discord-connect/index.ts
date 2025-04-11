/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface RequestBody {
  agentId: string
  botToken: string
}

// This function needs to be implemented securely using environment variables for the encryption key
async function encryptToken(token: string): Promise<string> {
  // TODO: Implement secure encryption using environment variables
  // This is a placeholder - DO NOT use in production without proper implementation
  return token;
}

async function validateDiscordBotToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bot ${token}`,
      },
    });
    return response.status === 200;
  } catch (error) {
    console.error('Error validating Discord bot token:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Parse request body
    const { agentId, botToken } = await req.json() as RequestBody

    // Validate required fields
    if (!agentId || !botToken) {
      throw new Error('Missing required fields: agentId and botToken')
    }

    // Validate the bot token with Discord API
    const isValidToken = await validateDiscordBotToken(botToken)
    if (!isValidToken) {
      throw new Error('Invalid Discord bot token')
    }

    // Encrypt the token before storing
    const encryptedToken = await encryptToken(botToken)

    // Create Supabase client with service role key for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update the agent record with the encrypted token
    const { error: updateError } = await supabaseClient
      .from('agents')
      .update({ discord_bot_token_encrypted: encryptedToken })
      .eq('id', agentId)

    if (updateError) {
      throw new Error(`Failed to update agent: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({ message: 'Discord bot token stored successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})