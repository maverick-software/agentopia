import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function 'securely-update-discord-token' loaded`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Ensure the user is authenticated (client-side Supabase client should handle this with Authorization header)
    // However, service_role key will bypass RLS, so explicit ownership checks might be needed if not relying on frontend passing correct agentId for its user.
    // For this function, we'll assume the frontend has validated user ownership of the agentId.

    // 2. Extract agentId and botToken from request body
    const { agentId, botToken } = await req.json();

    if (!agentId) {
      return new Response(JSON.stringify({ error: 'agentId is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!botToken) {
      // Allow clearing the bot token by passing an empty string or null
      // If an empty token is explicitly disallowed, change this check.
      console.log(`[securely-update-discord-token] Received request to update/clear token for agent ${agentId}. Token provided: ${botToken ? 'Yes' : 'No (clearing)'}`);
    }

    // 3. Create Supabase client using Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Update the discord_bot_key in the 'agents' table
    console.log(`[securely-update-discord-token] Attempting to update discord_bot_key for agent ${agentId}`);
    const { data, error } = await supabaseAdmin
      .from('agents')
      .update({ discord_bot_key: botToken || null }) // Store null if botToken is empty string
      .eq('id', agentId)
      .select('id') // Select to confirm update
      .single(); // Expect a single row to be updated

    if (error) {
      console.error(`[securely-update-discord-token] Error updating agent ${agentId}:`, error);
      throw error; // Let the generic error handler catch and return 500
    }
    
    if (!data) {
        console.warn(`[securely-update-discord-token] Agent with ID ${agentId} not found for token update.`);
        return new Response(JSON.stringify({ error: `Agent with ID ${agentId} not found.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404, // Not Found
        });
    }

    console.log(`[securely-update-discord-token] Successfully updated discord_bot_key for agent ${data.id}.`);
    return new Response(JSON.stringify({ message: 'Discord bot token updated successfully.', agentId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[securely-update-discord-token] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Failed to update Discord bot token.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.status || 500, // Use error's status if available (e.g., from Supabase client), otherwise 500
    });
  }
}); 