// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'update-agent-discord-token' started.");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Create Supabase client with user's auth context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false } // Important for server-side
      }
    );

    // 2. Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth Error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized: " + (userError?.message ?? 'No user session') }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Parse request body
    let agentId: string | null = null;
    let token: string | null = null;
    try {
      const body = await req.json();
      agentId = body.agentId;
      token = body.token; // Can be null/undefined if disconnecting
    } catch (e) {
       return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!agentId) {
      return new Response(JSON.stringify({ error: "Bad Request: Missing agentId" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Remove User-Specific Encryption Key Fetch ---
    // const supabaseAdmin = createClient(
    //     Deno.env.get("SUPABASE_URL") ?? "", 
    //     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    // );
    // const { data: secretData, error: secretError } = await supabaseAdmin
    //     .from('user_secrets')
    //     .select('encryption_key')
    //     .eq('user_id', user.id)
    //     .single();

    // if (secretError || !secretData?.encryption_key) {
    //     console.error(`Encryption key fetch error for user ${user.id}:`, secretError);
    //     return new Response(JSON.stringify({ error: "Internal Server Error: Could not retrieve user encryption key." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // }
    // const userEncryptionKey = secretData.encryption_key;
    // --- End Remove User-Specific Key Fetch ---

    // 5. Use the raw token (or null if disconnecting)
    let rawToken: string | null = null;
    if (token && token.trim()) {
      rawToken = token.trim();
    } else {
      console.log(`Clearing token for agent ${agentId}`);
    }

    // 6. Update the agent in the database (ensuring ownership)
    // Use supabaseClient which has user's auth context for RLS enforcement
    const { error: updateError } = await supabaseClient // Use user client for RLS
      .from('agents')
      .update({ discord_bot_key: rawToken }) // Save raw token
      .eq('id', agentId)
      .eq('user_id', user.id); // <-- Crucial ownership check still applies!

    if (updateError) {
      console.error("Supabase Update Error:", updateError);
      return new Response(JSON.stringify({ error: "Database Error: " + updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Successfully updated token (raw: ${!!rawToken}) for agent ${agentId} owned by user ${user.id}`);

    // 7. Return success response
    return new Response(
      JSON.stringify({ message: "Agent token updated successfully." }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/update-agent-discord-token' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
