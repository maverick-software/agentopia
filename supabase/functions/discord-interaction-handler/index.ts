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

// --- Command Execution Handler ---
async function handleCommand(interaction: Interaction): Promise<Response> {
    const commandName = interaction.data?.name;
    const guildId = interaction.guild_id;
    const interactionToken = interaction.token;
    
    if (commandName === 'activate') {
        if (!guildId) {
            return new Response(JSON.stringify({ type: 4, data: { content: "Activation must be done in a server." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get the selected agent_id from the options
        const agentOption = interaction.data?.options?.find(opt => opt.name === 'agent');
        const selectedAgentId = agentOption?.value as string; // Value is the agent_id from autocomplete

        if (!selectedAgentId) {
            console.error("Agent ID missing from activate command options.");
            return new Response(JSON.stringify({ type: 4, data: { content: "Error: Agent ID was not provided." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Handling /activate command for agent ${selectedAgentId} in guild ${guildId}`);

        let botToken: string | null = null;
        let timeoutMinutes: number = 10;
        let currentStatus: string | null = 'inactive';
        let connectionId: string | null = null;

        try {
            // Fetch connection details using guild_id AND agent_id
            const { data: connectionData, error: connectionError } = await supabaseAdmin
                .from('agent_discord_connections')
                .select(` id, agent_id, inactivity_timeout_minutes, worker_status, agents ( discord_bot_key ) `)
                .eq('guild_id', guildId)
                .eq('agent_id', selectedAgentId) // Filter by the selected agent
                .maybeSingle();

            if (connectionError) throw connectionError;
            if (!connectionData) {
                await sendFollowup(interactionToken, "Could not find a connection for the specified agent in this server.");
                return new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            if (!connectionData.agents || !connectionData.agents.discord_bot_key) {
                await sendFollowup(interactionToken, "Error retrieving agent details. Bot token might be missing.");
                return new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            connectionId = connectionData.id;
            botToken = connectionData.agents.discord_bot_key;
            timeoutMinutes = connectionData.inactivity_timeout_minutes || 10;
            currentStatus = connectionData.worker_status;

            if (currentStatus === 'active' || currentStatus === 'activating') {
                await sendFollowup(interactionToken, "This agent is already active!");
                return new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            // Trigger Worker Start & Update Status
            try {
                await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'activating' }).eq('id', connectionId);
                const managerResponse = await fetch(`${managerUrl}/start-worker`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${managerSecretKey}` },
                    body: JSON.stringify({ agentId: selectedAgentId, botToken: botToken, timeoutMinutes: timeoutMinutes })
                });
                if (!managerResponse.ok) {
                    await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'error' }).eq('id', connectionId);
                    throw new Error("Manager service failed to start worker.");
                }
                await sendFollowup(interactionToken, `✅ Activation initiated for agent (Timeout: ${timeoutMinutes} mins).`);
            } catch (triggerError) {
                console.error("Error triggering worker:", triggerError);
                if (connectionId) { await supabaseAdmin.from('agent_discord_connections').update({ worker_status: 'error' }).eq('id', connectionId); }
                await sendFollowup(interactionToken, `❌ Error initiating activation: ${triggerError.message}`);
            }
            return new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (dbError) {
            console.error("Database error fetching agent details:", dbError);
            await sendFollowup(interactionToken, "Database error finding the specified agent.");
            return new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    } else {
        // Handle other commands if any
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

// Helper function to send follow-up messages to interactions
async function sendFollowup(interactionToken: string, content: string) {
    const appId = Deno.env.get("DISCORD_APP_ID");
    if (!appId) { console.error("Cannot send followup: DISCORD_APP_ID not set."); return; }
    const url = `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`;
    console.log(`Sending followup to ${url}: "${content}"`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content }),
        });
        if (!response.ok) { console.error(`Error sending followup: ${response.status} ${response.statusText}`, await response.text()); }
    } catch (error) { console.error("Error sending followup:", error); }
}

console.log("'discord-interaction-handler' function started."); 