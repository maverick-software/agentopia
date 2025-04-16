import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts"; 

console.log("Function 'manage-discord-worker' started.");

// Get Worker Manager URL and Secret from environment variables
const managerUrl = Deno.env.get("MANAGER_URL");
const managerSecretKey = Deno.env.get("MANAGER_SECRET_KEY");

if (!managerUrl || !managerSecretKey) {
    console.error("FATAL: MANAGER_URL or MANAGER_SECRET_KEY environment variables not set.");
}

serve(async (req) => {
  // --- Define variables for logging --- 
  let agentId: string | null = null; 
  let connectionId: string | null = null;
  // --- End Define ---

  // --- START CORS Preflight Handling ---
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request for CORS preflight.");
    return new Response("ok", { headers: corsHeaders });
  }
  // --- END CORS Preflight Handling ---

  try {
    // 1. Create Supabase client with user's auth context
    // We need this to verify the user owns the agent they are trying to manage
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false } 
      }
    );

    // 2. Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth Error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. Parse request body
    let action: 'start' | 'stop' | null = null;
    let guildIdFromRequest: string | null = null; // *** NEW: Variable for guildId from request ***
    try {
      const body = await req.json();
      agentId = body.agentId;
      action = body.action;
      guildIdFromRequest = body.guildId; // *** NEW: Get guildId from body ***
      // *** ADDED LOGGING ***
      console.log(`[FUNC START] Invoked with Action: ${action}, AgentID: ${agentId}`);
      // *** END ADDED LOGGING ***
    } catch (e) {
       return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), { 
         status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    if (!agentId || !action || (action !== 'start' && action !== 'stop')) {
      return new Response(JSON.stringify({ error: "Bad Request: Missing or invalid agentId/action" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 4. Verify agent ownership (using Supabase Admin for potentially restricted access)
    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "", 
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: agentData, error: agentError } = await supabaseAdmin
        .from('agents')
        // Select the required fields using the CORRECT column names
        .select('id, user_id, discord_bot_key, name, system_instructions, assistant_instructions') 
        .eq('id', agentId)
        .single();

    if (agentError || !agentData) {
      console.error("Agent fetch error:", agentError);
      return new Response(JSON.stringify({ error: "Agent not found" }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    if (agentData.user_id !== user.id) {
       console.warn(`User ${user.id} attempted to manage agent ${agentId} owned by ${agentData.user_id}`);
       return new Response(JSON.stringify({ error: "Forbidden" }), { 
         status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }
    // *** NEW: Check if bot key exists (only needed for start) ***
    if (action === 'start' && !agentData.discord_bot_key) {
       console.error(`Bot token (discord_bot_key) is missing for agent ${agentId}`);
       return new Response(JSON.stringify({ error: "Bad Request: Agent is missing Discord Bot Key." }), { 
         status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    // *** MODIFIED: Step 4.5: Fetch Connection details (id, guild_id, timeout) ***
    let connectionDetails: any = null;
    // We need connection ID and potentially timeout for START
    // We only strictly need agentId for STOP
    // Fetch details ONLY if starting or if needed for consistency check later
    console.log(`[FUNC FETCH] Fetching agent ${agentId} connection details (needed for start)...`);
    const { data: connData, error: connError } = await supabaseAdmin
        .from('agent_discord_connections')
        .select('id, guild_id, inactivity_timeout_minutes') 
        .eq('agent_id', agentId)
        .maybeSingle(); 

    if (connError) {
        console.error(`Error fetching discord connection details for agent ${agentId}:`, connError);
        // Don't fail the whole function if just fetching fails, manager might handle it
        // But log that we couldn't fetch it
        connectionDetails = null;
    }
    if (action === 'start' && !connData) { // Connection record MUST exist to start
         console.error(`Discord connection record not found for agent ${agentId}. Required for start action.`);
         return new Response(JSON.stringify({ error: "Bad Request: Discord connection record missing for agent." }), { 
             status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
    }
    connectionDetails = connData; // Store fetched data (could be null if not found)
    connectionId = connectionDetails?.id || null; // Use optional chaining
    console.log(`[FUNC POST-FETCH] Fetched connection details for agent ${agentId}: ID=${connectionId}, Guild=${connectionDetails?.guild_id}, Timeout=${connectionDetails?.inactivity_timeout_minutes}`);
    // *** END MODIFIED FETCH ***

    // 5. Forward request to Worker Manager service
    if (!managerUrl || !managerSecretKey) {
        console.error("Worker Manager URL or Secret Key not configured in function environment.");
        return new Response(JSON.stringify({ error: "Internal Server Error: Service configuration missing." }), { 
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const managerEndpoint = action === 'start' ? `${managerUrl}/start-worker` : `${managerUrl}/stop-worker`;
    console.log(`Forwarding ${action} request for agent ${agentId} to ${managerEndpoint}`);

    // *** START MODIFIED: Construct payload based on action ***
    let managerPayload: any = {}; // Start with empty object

    if (action === 'start') {
        // Check required data for start
        if (!agentData?.discord_bot_key) {
             console.error(`Bot token (discord_bot_key) is missing for agent ${agentId}`);
             return new Response(JSON.stringify({ error: "Bad Request: Agent is missing Discord Bot Key." }), { 
                 status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
             });
        }
        if (!connectionId) {
             console.error(`Connection ID is missing for agent ${agentId}. Cannot construct payload.`);
             return new Response(JSON.stringify({ error: "Internal Error: Missing connection details for start action." }), { 
                 status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
             });
        }
        
        // CORRECTED CHECK: Only require the agent name
        if (!agentData?.name) {
            console.error(`Agent name missing for agent ${agentId}`);
            return new Response(JSON.stringify({ error: "Bad Request: Agent configuration incomplete (name)." }), { 
                 status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
             });
        }

        managerPayload = {
            agentId: agentId,
            botToken: agentData.discord_bot_key, 
            connectionDbId: connectionId, 
            inactivityTimeout: connectionDetails?.inactivity_timeout_minutes ?? 10, 
            // Map the CORRECT database columns to the expected payload keys
            // These values can be null if they are null in the DB
            agentName: agentData.name,                         
            systemPrompt: agentData.system_instructions,       
            agentInstructions: agentData.assistant_instructions  
        };

    } else if (action === 'stop') {
         // Stop only needs agentId according to manager endpoint
         managerPayload = { agentId: agentId };
    }
    // *** END MODIFIED ***

    // --- ADDED: Log the exact payload being sent ---
    const payloadString = JSON.stringify(managerPayload);
    console.log(`[FUNC FORWARDING PAYLOAD] Payload: ${payloadString}`);
    // --- END ADDED ---

    const managerResponse = await fetch(managerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerSecretKey}` // Authenticate with the manager service
      },
      // *** MODIFIED: Use the constructed payload ***
      body: JSON.stringify(managerPayload) 
    });

    if (!managerResponse.ok) {
      const errorText = await managerResponse.text();
      console.error(`Worker Manager service error (${managerResponse.status}): ${errorText}`);
      // Try to return the manager's error if possible
      let detail = `Worker Manager failed: ${managerResponse.statusText}`;
       try { detail = JSON.parse(errorText).error || detail; } catch(e) {}
      return new Response(JSON.stringify({ error: detail }), { 
        status: 500, // Or maybe map managerResponse.status?
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const managerResult = await managerResponse.json();
    // *** ADDED LOGGING ***
    console.log("[FUNC POST-FORWARD] Worker Manager response:", JSON.stringify(managerResult, null, 2));
    // *** END ADDED LOGGING ***
    
    // 6. Return success (or the manager's response)
    return new Response(
      JSON.stringify({ message: `Worker ${action} request sent successfully.`, details: managerResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}); 