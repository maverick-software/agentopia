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

    // Fetch *A* Connection detail (id, timeout) - This logic remains for passing *a* connection ID to manager
    let connectionDetails: any = null;
    let connectionId: string | null = null;
    console.log(`[FUNC FETCH] Fetching agent ${agentId} connection details (needed for start/stop)...`); // Log added for stop too
    const { data: connDataArray, error: connError } = await supabaseAdmin
        .from('agent_discord_connections')
        .select('id, inactivity_timeout_minutes') 
        .eq('agent_id', agentId)
        .limit(1); 

    if (connError) {
        console.error(`Error fetching discord connection details for agent ${agentId}:`, connError);
        connectionDetails = null;
    }
    if (connDataArray && connDataArray.length > 0) {
        connectionDetails = connDataArray[0]; 
        connectionId = connectionDetails.id;
    } else {
        connectionDetails = null;
        connectionId = null;
         // If starting, we previously errored if no connectionId. Keep that check?
         // For stopping, we might proceed without a connectionId if the manager only needs agentId.
         if (action === 'start') {
             console.error(`No Discord connection records found for agent ${agentId}. Required for start action.`);
             return new Response(JSON.stringify({ error: "Bad Request: Discord connection record missing for agent." }), { 
                 status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
             });
         }
    }
    console.log(`[FUNC POST-FETCH] Using connection details for agent ${agentId}: ID=${connectionId}, Timeout=${connectionDetails?.inactivity_timeout_minutes}`);
    
    // 5. Forward request to Worker Manager service
    if (!managerUrl || !managerSecretKey) {
        console.error("Worker Manager URL or Secret Key not configured in function environment.");
        return new Response(JSON.stringify({ error: "Internal Server Error: Service configuration missing." }), { 
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const managerEndpoint = action === 'start' ? `${managerUrl}/start-worker` : `${managerUrl}/stop-worker`;
    console.log(`Forwarding ${action} request for agent ${agentId} to ${managerEndpoint}`);

    // Construct payload (logic remains largely the same, requires connectionId for start)
    let managerPayload: any = {};
    if (action === 'start') {
        // ... (validation for botKey, connectionId, agentName) ...
        managerPayload = {
            agentId: agentId,
            botToken: agentData.discord_bot_key, 
            connectionDbId: connectionId, // Still passing one ID
            inactivityTimeout: connectionDetails?.inactivity_timeout_minutes ?? 10, 
            agentName: agentData.name,                         
            systemPrompt: agentData.system_instructions,       
            agentInstructions: agentData.assistant_instructions  
        };
    } else if (action === 'stop') {
         managerPayload = { agentId: agentId }; // Manager stop might only need agentId
    }
    
    const payloadString = JSON.stringify(managerPayload);
    console.log(`[FUNC FORWARDING PAYLOAD] Payload: ${payloadString}`);

    // Call the manager service
    const managerResponse = await fetch(managerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${managerSecretKey}` },
        body: payloadString 
    });

    // Check manager response
    if (!managerResponse.ok) {
        const errorText = await managerResponse.text();
        console.error(`Worker Manager service error (${managerResponse.status}): ${errorText}`);
        let detail = `Worker Manager failed: ${managerResponse.statusText}`;
        try { detail = JSON.parse(errorText).error || detail; } catch(e) {}
        // *** NEW: Attempt to revert status on manager failure? Maybe set to 'error'? ***
        // For now, just return error
        return new Response(JSON.stringify({ error: detail }), { 
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // Manager call was successful!
    const managerResult = await managerResponse.json();
    console.log("[FUNC POST-FORWARD] Worker Manager response:", JSON.stringify(managerResult, null, 2));

    // *** NEW: Update DB status AFTER successful manager response ***
    if (action === 'start') {
        console.log(`[FUNC POST-MANAGER] Setting status to 'active' for enabled connections of agent ${agentId}...`);
        const { error: updateActiveError } = await supabaseAdmin
            .from('agent_discord_connections')
            .update({ worker_status: 'active' })
            .eq('agent_id', agentId)
            .eq('is_enabled', true); // Only update enabled ones
        if (updateActiveError) {
            console.error(`[FUNC POST-MANAGER] Error setting status to 'active' for agent ${agentId}:`, updateActiveError);
        }
        console.log(`[FUNC POST-MANAGER] Status set to 'active' for enabled connections.`);

    } else if (action === 'stop') {
        console.log(`[FUNC POST-MANAGER] Setting status to 'inactive' for all connections of agent ${agentId}...`);
         const { error: updateInactiveError } = await supabaseAdmin
            .from('agent_discord_connections')
            .update({ worker_status: 'inactive' })
            .eq('agent_id', agentId); // Update ALL connections for the agent
        if (updateInactiveError) {
             console.error(`[FUNC POST-MANAGER] Error setting status to 'inactive' for agent ${agentId}:`, updateInactiveError);
        }
        console.log(`[FUNC POST-MANAGER] Status set to 'inactive' for all connections.`);
    }
    // *** END NEW DB UPDATE ***

    // 6. Return success response
    return new Response(
      JSON.stringify({ message: `Worker ${action} request sent successfully.`, details: managerResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    // ... (existing catch block) ...
  }
});