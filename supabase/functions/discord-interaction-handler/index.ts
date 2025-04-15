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
    console.log("--- Handling Autocomplete Request ---");
    console.log("Received interaction data:", JSON.stringify(interaction.data, null, 2));

    const focusedOption = interaction.data?.options?.find(opt => opt.focused);
    const guildId = interaction.guild_id;

    console.log(`Guild ID: ${guildId}, Focused Option: ${JSON.stringify(focusedOption)}`);

    if (!focusedOption || focusedOption.name !== 'agent' || !guildId) {
        console.log("Autocomplete conditions not met (no focused 'agent' option or guildId). Returning empty choices.");
        return new Response(JSON.stringify({ type: 8, data: { choices: [] } }), {
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const searchQuery = focusedOption.value?.toString().toLowerCase() || '';
    console.log(`Autocomplete query for guild ${guildId}: "${searchQuery}"`);

    try {
        console.log("Attempting Supabase query for agents...");
        const { data, error } = await supabaseAdmin
            .from('agent_discord_connections')
            .select(`
                agent_id,
                agents!inner ( id, name )
            `)
            .eq('guild_id', guildId)
            .ilike('agents.name', `%${searchQuery}%`) // Case-insensitive search on agent name
            .limit(25);

        if (error) {
            console.error("Supabase query error:", error);
            throw error;
        }

        console.log(`Supabase query successful. Found ${data?.length || 0} potential matches.`);

        const choices: AutocompleteChoice[] = data?.map(conn => ({
            name: `${conn.agents.name} (ID: ${conn.agents.id})`,
            value: conn.agents.id
        })) || [];

        console.log(`Returning ${choices.length} choices for "${searchQuery}":`, JSON.stringify(choices));
        return new Response(JSON.stringify({ type: 8, data: { choices } }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error inside handleAutocomplete catch block:", error);
        return new Response(JSON.stringify({ type: 8, data: { choices: [] } }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
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
    
    console.log(`--- Handling Command Execution Request: '${commandName}' (ID: ${interactionId}) ---`);

    if (commandName === 'activate') {
        if (!guildId || !channelId) {
            return new Response(JSON.stringify({ type: 4, data: { content: "❌ This command can only be used within a server channel." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const agentOption = interaction.data?.options?.find(opt => opt.name === 'agent');
        const selectedAgentName = agentOption?.value as string; 

        if (!selectedAgentName) {
            console.error("Agent NAME missing from activate command options.", interaction.data?.options);
            return new Response(JSON.stringify({ type: 4, data: { content: "❌ Error: Agent name was not provided correctly." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        console.log(`Deferring response for /activate command (Agent Name: ${selectedAgentName})`);
        const deferResponse = new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        let activationSuccess = false;
        let errorMessage = "An unknown error occurred during activation.";
        let agentIdToSend: string | null = null; // Need agent ID to send to manager
        
        try {
            console.log(`Processing /activate for Agent Name "${selectedAgentName}" in Guild ${guildId}...`);

            const { data: connectionData, error: connectionError } = await supabaseAdmin
                .from('agent_discord_connections')
                .select(`
                    id, 
                    agent_id, 
                    inactivity_timeout_minutes, 
                    worker_status, 
                    agents!inner (
                        id, 
                        name, 
                        discord_bot_key 
                    )
                `)
                .eq('guild_id', guildId)
                .eq('agents.name', selectedAgentName) // Filter by agent NAME
                .maybeSingle(); // Assume name is unique per guild for this lookup

            if (connectionError) {
                console.error("Supabase error fetching connection by name:", connectionError);
                throw new Error("Database error retrieving connection details.");
            }
            if (!connectionData) {
                console.warn(`No connection found for Agent Name "${selectedAgentName}" in Guild ${guildId}.`);
                // Note: If names aren't unique per guild, this might fetch the wrong one or none.
                throw new Error("This agent name is not linked to this server. Please check the name or configuration.");
            }
            if (!connectionData.agents || !connectionData.agents.discord_bot_key) {
                console.error(`Bot token missing for Agent ${connectionData.agent_id} (Name: ${selectedAgentName})`);
                throw new Error("Configuration Error: Bot token is missing for the agent.");
            }

            const connectionId = connectionData.id;
            const botToken = connectionData.agents.discord_bot_key;
            const timeoutMinutes = connectionData.inactivity_timeout_minutes || 10;
            const currentStatus = connectionData.worker_status;
            agentIdToSend = connectionData.agent_id; // Get the actual agent ID here

            console.log(`Connection ID: ${connectionId}, Agent ID: ${agentIdToSend}, Current Status: ${currentStatus}`);

            if (currentStatus === 'active' || currentStatus === 'activating') {
                console.log(`Agent ${agentIdToSend} (Name: ${selectedAgentName}) is already active or activating.`);
                activationSuccess = true;
                errorMessage = "Agent is already active or being activated.";
                // Send followup immediately and return the deferred response
                await sendFollowup(interactionToken, errorMessage);
                return deferResponse; // Fix: Return the deferred response object
            }
            
            console.log(`Setting status to 'activating' for connection ${connectionId}`);
            const { error: updateError } = await supabaseAdmin
                .from('agent_discord_connections')
                .update({ worker_status: 'activating' })
                .eq('id', connectionId);
            if (updateError) {
                console.error("Supabase error updating status to activating:", updateError);
            }
            
            console.log(`Calling manager service at ${managerUrl}/start-worker for Agent ID ${agentIdToSend}`);
            const managerResponse = await fetch(`${managerUrl}/start-worker`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${managerSecretKey}` 
                },
                body: JSON.stringify({ 
                    agentId: agentIdToSend, // Send the actual agent ID
                    botToken: botToken, 
                    timeoutMinutes: timeoutMinutes,
                    guildId: guildId, 
                    channelId: channelId, 
                    connectionId: connectionId 
                 })
            });

            if (!managerResponse.ok) {
                const managerErrorText = await managerResponse.text();
                console.error(`Manager service failed (${managerResponse.status}): ${managerErrorText}`);
                await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'error' }).eq('id', connectionId).maybeSingle();
                throw new Error(`Activation failed: Could not start the agent process (Manager status: ${managerResponse.status}).`);
            }

            console.log(`Manager service successfully triggered worker for Agent ID ${agentIdToSend} (Name: ${selectedAgentName})`);
            activationSuccess = true;
            errorMessage = `✅ Agent '${selectedAgentName}' activation initiated! (Timeout: ${timeoutMinutes} mins)`;

        } catch (error) {
            console.error(`Error during /activate processing for Agent Name "${selectedAgentName}":`, error);
            errorMessage = `❌ Activation failed: ${error.message}`;
            // Attempt to set status to error using the found connectionId if available
            const connDataForError = await supabaseAdmin
               .from('agent_discord_connections')
               .select('id')
               .eq('guild_id', guildId)
               .eq('agents.name', selectedAgentName) 
               .maybeSingle();
            if (connDataForError?.data?.id) {
                await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'error' }).eq('id', connDataForError.data.id).maybeSingle();
            }
        } finally {
            console.log(`Sending followup for interaction ${interactionId}: ${errorMessage}`);
            await sendFollowup(interactionToken, errorMessage);
        }
        
        return deferResponse;
        
    } else {
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