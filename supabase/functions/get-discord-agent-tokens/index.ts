/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"; // Use appropriate version
import { corsHeaders } from "../_shared/cors.ts"; // Assuming shared CORS headers

// Define the expected structure for agent tokens
interface AgentTokenInfo {
  agent_id: string;
  discord_bot_key: string;
}

console.log("Initializing 'get-discord-agent-tokens' function...");

// --- Environment Variables ---
const gatewaySecret = Deno.env.get("GATEWAY_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!gatewaySecret) {
  console.error("FATAL: GATEWAY_SECRET_KEY environment variable not set.");
}
if (!supabaseUrl) {
  console.error("FATAL: SUPABASE_URL environment variable not set.");
}
if (!serviceRoleKey) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable not set.");
}

serve(async (req) => {
  // --- Handle OPTIONS request for CORS preflight ---
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- Authentication ---
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${gatewaySecret}`;

  if (!gatewaySecret) {
      // If the secret isn't configured in the function's env, we can't proceed.
      console.error("Server configuration error: GATEWAY_SECRET_KEY is not set.");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  }

  if (!authHeader || authHeader !== expectedAuth) {
    console.warn("Unauthorized attempt to access get-discord-agent-tokens.");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // --- Database Query ---
  try {
    if (!supabaseUrl || !serviceRoleKey) {
       // Redundant check, but ensures Supabase client won't fail silently below
       console.error("Server configuration error: Supabase URL or Service Role Key missing after initial load.");
       return new Response(JSON.stringify({ error: "Server configuration error" }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // Initialize Supabase client with Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    console.log("Fetching agent Discord bot keys...");

    // Query the agents table for agents with a non-null discord_bot_key
    // IMPORTANT: Ensure your table is named 'agents' and column is 'discord_bot_key'
    const { data, error } = await supabaseAdmin
      .from('agents') // Adjust table name if different
      .select('id, discord_bot_key') // Select agent ID and the key
      .not('discord_bot_key', 'is', null); // Only get agents where the key is set

    if (error) {
      console.error("Supabase query error:", error);
      throw error; // Let the catch block handle it
    }

    console.log(`Found ${data?.length ?? 0} agents with Discord bot keys.`);

    // Rename 'id' to 'agent_id' for clarity if needed, or adjust the select statement
    const agentTokens: AgentTokenInfo[] = data?.map(agent => ({
        agent_id: agent.id, // Assuming the agent's primary key is 'id'
        discord_bot_key: agent.discord_bot_key
    })) || [];

    // --- Return Tokens ---
    return new Response(JSON.stringify(agentTokens), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Error fetching agent tokens:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to fetch agent tokens" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log("'get-discord-agent-tokens' function started successfully."); 