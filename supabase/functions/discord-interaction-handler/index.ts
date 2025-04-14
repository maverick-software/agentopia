/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
// Import tweetnacl from esm.sh
import nacl from "https://esm.sh/tweetnacl@1.0.3";
// Import Supabase client
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

console.log("Initializing 'discord-interaction-handler' function...");

// --- Types for Discord Interactions (simplified) ---
interface Interaction {
    type: number;
    id: string;
    token: string;
    guild_id?: string;
    channel_id?: string;
    member?: { user: { id: string } };
    user?: { id: string };
    data?: {
        name?: string; // Command name
        options?: { name: string; value: any; type: number; focused?: boolean }[]; // Command options
    };
}

interface AutocompleteChoice {
    name: string;
    value: string; // Typically the ID
}

// --- Environment Variables ---
const discordPublicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const managerUrl = Deno.env.get("MANAGER_URL"); // URL of the Manager service
const managerSecretKey = Deno.env.get("MANAGER_SECRET_KEY"); // Shared secret with Manager

if (!discordPublicKey) {
  console.error("FATAL: DISCORD_PUBLIC_KEY environment variable not set.");
}
if (!supabaseUrl) {
  console.error("FATAL: SUPABASE_URL environment variable not set.");
}
if (!serviceRoleKey) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable not set.");
}
if (!managerUrl) {
  console.error("FATAL: MANAGER_URL environment variable not set.");
}
if (!managerSecretKey) {
  console.error("FATAL: MANAGER_SECRET_KEY environment variable not set.");
}

// Initialize Supabase client with Service Role Key
const supabaseAdmin = createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
});

async function verifySignature(request: Request): Promise<{ isValid: boolean; body: string }> {
  if (!discordPublicKey) {
      console.error("Verification skipped: DISCORD_PUBLIC_KEY is not configured.");
      return { isValid: false, body: "Configuration error" }; 
  }

  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const body = await request.text();

  if (!signature || !timestamp || !body) {
    return { isValid: false, body };
  }

  const encoder = new TextEncoder();
  const isValid = nacl.sign.detached.verify(
    encoder.encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(discordPublicKey)
  );

  return { isValid, body };
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
}

// --- Autocomplete Handler ---
async function handleAutocomplete(interaction: Interaction): Promise<Response> {
    const focusedOption = interaction.data?.options?.find(opt => opt.focused);
    const guildId = interaction.guild_id;

    if (!focusedOption || focusedOption.name !== 'agent' || !guildId) {
        // Not an autocomplete request for the 'agent' option in a guild
        return new Response(JSON.stringify({ choices: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const searchQuery = focusedOption.value.toLowerCase();
    console.log(`Autocomplete query for guild ${guildId}: "${searchQuery}"`);

    try {
        // Query agents connected to this guild, filtering by name (case-insensitive)
        // Adjust table/column names as needed
        const { data, error } = await supabaseAdmin
            .from('agent_discord_connections')
            .select(`
                agent_id,
                agents!inner ( id, name )
            `)
            .eq('guild_id', guildId)
            .ilike('agents.name', `%${searchQuery}%`) // Case-insensitive search on agent name
            .limit(25); // Discord limits choices to 25

        if (error) throw error;

        const choices: AutocompleteChoice[] = data?.map(conn => ({
            name: `${conn.agents.name} (ID: ...${conn.agent_id.slice(-6)})`, // Display name and partial ID
            value: conn.agent_id // The value sent when selected is the agent_id
        })) || [];

        console.log(`Returning ${choices.length} choices for "${searchQuery}"`);
        return new Response(JSON.stringify({ type: 8, data: { choices } }), { // type 8 = APPLICATION_COMMAND_AUTOCOMPLETE_RESULT
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error fetching autocomplete choices:", error);
        // Don't send error details back in autocomplete
        return new Response(JSON.stringify({ choices: [] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// Helper function to send followup messages
async function sendFollowup(interactionToken: string, content: string) {
  const url = `https://discord.com/api/v10/webhooks/${Deno.env.get("DISCORD_APP_ID")}/${interactionToken}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content }),
    });
    if (!response.ok) {
      console.error(`Failed to send followup: ${response.status}`, await response.text());
    }
  } catch (error) {
    console.error('Error sending followup message:', error);
  }
}

// --- Command Execution Handler ---
async function handleCommand(interaction: Interaction): Promise<Response> {
    const commandName = interaction.data?.name;
    const guildId = interaction.guild_id;
    const channelId = interaction.channel_id;
    const interactionToken = interaction.token;
    const interactionId = interaction.id;
    
    console.log(`Handling command '${commandName}' (ID: ${interactionId}) in guild ${guildId}`);

    if (commandName === 'activate') {
        // --- Activate Command Logic --- 
        if (!guildId || !channelId) {
            // Respond immediately that it must be used in a server channel
            return new Response(JSON.stringify({ type: 4, data: { content: "❌ This command can only be used within a server channel." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get the selected agent_id from the options (value from autocomplete)
        const agentOption = interaction.data?.options?.find(opt => opt.name === 'agent');
        const selectedAgentId = agentOption?.value as string; 

        if (!selectedAgentId) {
            console.error("Agent ID missing from activate command options.", interaction.data?.options);
            // Respond immediately about missing option
            return new Response(JSON.stringify({ type: 4, data: { content: "❌ Error: Agent ID was not provided correctly." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Defer the initial response immediately
        // This tells Discord we've received the command and are working on it.
        console.log(`Deferring response for /activate command (Agent: ${selectedAgentId})`);
        const deferResponse = new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // Perform the actual work *after* sending the deferral
        // Use a try...finally block to ensure followup messages are sent
        let activationSuccess = false;
        let errorMessage = "An unknown error occurred during activation.";
        try {
            console.log(`Processing /activate for Agent ${selectedAgentId} in Guild ${guildId}...`);

            // Fetch connection details AND agent bot token using guild_id AND agent_id
            // Assumption: An entry MUST exist in agent_discord_connections for this agent/guild pair.
            const { data: connectionData, error: connectionError } = await supabaseAdmin
                .from('agent_discord_connections')
                .select(` id, agent_id, inactivity_timeout_minutes, worker_status, agents!inner ( discord_bot_key ) `)
                .eq('guild_id', guildId)
                .eq('agent_id', selectedAgentId) // Filter by the selected agent
                .maybeSingle();

            if (connectionError) {
                console.error("Supabase error fetching connection:", connectionError);
                throw new Error("Database error retrieving connection details.");
            }
            if (!connectionData) {
                console.warn(`No connection found for Agent ${selectedAgentId} in Guild ${guildId}.`);
                throw new Error("This agent is not linked to this server. Please check the configuration.");
            }
            if (!connectionData.agents || !connectionData.agents.discord_bot_key) {
                console.error(`Bot token missing for Agent ${selectedAgentId}`);
                throw new Error("Configuration Error: Bot token is missing for the agent.");
            }

            const connectionId = connectionData.id;
            const botToken = connectionData.agents.discord_bot_key;
            const timeoutMinutes = connectionData.inactivity_timeout_minutes || 10;
            const currentStatus = connectionData.worker_status;

            console.log(`Connection ID: ${connectionId}, Current Status: ${currentStatus}`);

            // Check if already active or activating
            if (currentStatus === 'active' || currentStatus === 'activating') {
                console.log(`Agent ${selectedAgentId} is already active or activating.`);
                activationSuccess = true; // Consider it a success for the message
                errorMessage = "Agent is already active or being activated."; // Set specific message
                // No need to proceed further
                return; // Exit the try block early, finally will send followup
            }
            
            // 1. Update Status to 'activating'
            console.log(`Setting status to 'activating' for connection ${connectionId}`);
            const { error: updateError } = await supabaseAdmin
                .from('agent_discord_connections')
                .update({ worker_status: 'activating' })
                .eq('id', connectionId);
            if (updateError) {
                console.error("Supabase error updating status to activating:", updateError);
                // Proceed but log the error, manager call might still work
            }
            
            // 2. Trigger Worker Start via Manager Service
            console.log(`Calling manager service at ${managerUrl}/start-worker for Agent ${selectedAgentId}`);
            const managerResponse = await fetch(`${managerUrl}/start-worker`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // Use a secret key for simple auth between services
                    'Authorization': `Bearer ${managerSecretKey}` 
                },
                body: JSON.stringify({ 
                    agentId: selectedAgentId, 
                    botToken: botToken, // Send the token needed for the worker
                    timeoutMinutes: timeoutMinutes,
                    guildId: guildId, // Send guild context
                    channelId: channelId, // Send channel context
                    connectionId: connectionId // Send connection ID for status updates
                 })
            });

            if (!managerResponse.ok) {
                const managerErrorText = await managerResponse.text();
                console.error(`Manager service failed (${managerResponse.status}): ${managerErrorText}`);
                // Attempt to set status back to error
                await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'error' }).eq('id', connectionId).maybeSingle();
                throw new Error(`Activation failed: Could not start the agent process (Manager status: ${managerResponse.status}).`);
            }

            console.log(`Manager service successfully triggered worker for Agent ${selectedAgentId}`);
            activationSuccess = true;
            errorMessage = `✅ Agent activation initiated! (Timeout: ${timeoutMinutes} mins)`;

        } catch (error) {
            console.error(`Error during /activate processing for Agent ${selectedAgentId}:`, error);
            errorMessage = `❌ Activation failed: ${error.message}`;
            // Attempt to set status to error if connectionId was found
            const connId = interaction.data?.options?.find(opt => opt.name === 'agent')?.value; // Re-get ID just in case
            if (connId) { 
                 // Find the connection ID again just based on agent/guild if needed
                 const { data: c } = await supabaseAdmin.from('agent_discord_connections').select('id').eq('agent_id', connId).eq('guild_id', guildId).maybeSingle();
                 if (c?.id) {
                     await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'error' }).eq('id', c.id).maybeSingle();
                 }
            }
        } finally {
            // Always send a follow-up message
            console.log(`Sending followup for interaction ${interactionId}: ${errorMessage}`);
            await sendFollowup(interactionToken, errorMessage);
        }
        
        // Return the initial defer response we prepared earlier
        return deferResponse;
        
    } else {
        // --- Handle other commands or unknown command --- 
        console.warn(`Received unhandled command: ${commandName}`);
        return new Response(JSON.stringify({ type: 4, data: { content: `Unknown command: ${commandName}` } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}

// --- Main Server Logic ---
serve(async (req) => {
  // --- Handle OPTIONS request for CORS preflight ---
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request");
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`Received request: ${req.method} ${req.url}`);

  // --- Verify Request Signature (WBS 2.3) ---
  const { isValid, body: rawBody } = await verifySignature(req.clone()); // Clone request to allow reading body twice
  if (!isValid) {
    console.warn("Invalid request signature received.");
    return new Response("Invalid request signature", { status: 401 });
  }
  console.log("Request signature verified successfully.");

  // --- Handle Verified Interactions ---
  try {
    const interaction: Interaction = JSON.parse(rawBody);

    switch (interaction.type) {
      case 1: // PING
        return new Response(JSON.stringify({ type: 1 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      case 2: // APPLICATION_COMMAND
        return await handleCommand(interaction);
      case 4: // APPLICATION_COMMAND_AUTOCOMPLETE
        return await handleAutocomplete(interaction);
      default:
        console.warn(`Received unhandled interaction type: ${interaction.type}`);
        return new Response(JSON.stringify({ type: 4, data: { content: "Unhandled interaction type." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error("Error processing interaction:", error);
    // Avoid sending detailed errors back unless necessary
    return new Response(
      JSON.stringify({ error: "Failed to process interaction" }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

console.log("'discord-interaction-handler' function started."); 