// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { corsHeaders } from '../_shared/cors.ts'; // Assuming shared CORS headers

// Define the structure for the /activate command
const ACTIVATE_COMMAND = {
  name: 'activate',
  description: 'Activate the agent in the current server/channel.',
  options: [
    {
      name: 'agent',
      description: 'The specific agent configuration to activate.',
      type: 3, // STRING type
      required: true,
      // Autocomplete is handled by the discord-interaction-handler, not defined here
    },
  ],
};

console.log('Register Agent Commands function booting up...');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Ensure POST request
    if (req.method !== 'POST') {
      throw new Error('Method Not Allowed: Only POST requests are accepted.');
    }

    // --- Get Agent ID from request ---
    let agentId: string | null = null;
    try {
      const body = await req.json();
      agentId = body.agentId;
      if (!agentId || typeof agentId !== 'string') {
        throw new Error('Missing or invalid agentId in request body.');
      }
      console.log(`Received request to register commands for agent: ${agentId}`);
    } catch (error) {
      console.error('Error parsing request body:', error);
      throw new Error(`Bad Request: ${error.message}`);
    }

    // --- Create Supabase Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use Service Role Key
    );

    // --- Fetch Agent Details ---
    console.log(`Fetching details for agent ${agentId}...`);
    const { data: agentData, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('discord_app_id, discord_bot_key')
      .eq('id', agentId)
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }
    if (!agentData) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    if (!agentData.discord_app_id || !agentData.discord_bot_key) {
      throw new Error(`Agent ${agentId} is missing Discord Application ID or Bot Token.`);
    }
    console.log(`Found App ID for agent ${agentId}`);

    // --- Register Command with Discord ---
    const discordApiUrl = `https://discord.com/api/v10/applications/${agentData.discord_app_id}/commands`;
    const commandPayload = [ACTIVATE_COMMAND]; // Discord expects an array

    console.log(`Registering command(s) to URL: ${discordApiUrl}`);
    console.log('Command Payload:', JSON.stringify(commandPayload, null, 2));

    const discordResponse = await fetch(discordApiUrl, {
      method: 'PUT', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${agentData.discord_bot_key}`,
      },
      body: JSON.stringify(commandPayload),
    });

    const responseBody = await discordResponse.json();

    if (!discordResponse.ok) {
      console.error('Discord API Error Response:', JSON.stringify(responseBody, null, 2));
      throw new Error(`Discord API Error (${discordResponse.status}): ${responseBody.message || 'Failed to register commands.'}`);
    }

    console.log(`Successfully registered command(s) for App ID ${agentData.discord_app_id}. Response:`, JSON.stringify(responseBody, null, 2));

    // --- Return Success Response ---
    return new Response(
      JSON.stringify({ success: true, message: `Command(s) registered successfully for agent ${agentId}.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    // --- Return Error Response ---
    console.error('Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.startsWith('Database error') ? 500 :
                error.message.startsWith('Agent not found') ? 404 :
                error.message.startsWith('Agent is missing') ? 400 :
                error.message.startsWith('Method Not Allowed') ? 405 :
                error.message.startsWith('Bad Request') ? 400 :
                error.message.startsWith('Discord API Error') ? 502 : // Bad Gateway
                500, // Generic server error
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/register-agent-commands' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
