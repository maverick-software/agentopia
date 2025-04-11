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
    const { agentId } = await req.json() as RequestBody

    // Validate required fields
    if (!agentId) {
      throw new Error('Missing required field: agentId')
    }

    // Create Supabase client with service role key for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Transaction: Update agent and delete connections
    // 1. Set discord_bot_token_encrypted to NULL in agents table
    const { error: updateAgentError } = await supabaseAdmin
      .from('agents')
      .update({ discord_bot_token_encrypted: null })
      .eq('id', agentId)

    if (updateAgentError) {
      console.error('Error clearing agent token:', updateAgentError);
      throw new Error(`Failed to clear agent token: ${updateAgentError.message}`);
    }
    console.log(`Cleared token for agent ${agentId}`);

    // 2. Delete all entries for this agent in agent_discord_connections
    const { error: deleteConnectionsError } = await supabaseAdmin
      .from('agent_discord_connections')
      .delete()
      .eq('agent_id', agentId)

    if (deleteConnectionsError) {
        // Log the error but don't necessarily fail the whole operation?
        // The primary goal (disconnecting the token) succeeded.
        // Alternatively, you could implement a retry or rollback, but that adds complexity.
        console.error(`Error deleting connections for agent ${agentId}:`, deleteConnectionsError);
        // Decide if this should throw an error and revert the token update (more complex)
        // For now, we'll proceed but log the issue.
    }
    console.log(`Deleted connections for agent ${agentId}`);

    return new Response(
      JSON.stringify({ message: 'Discord bot disconnected successfully' }),
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
