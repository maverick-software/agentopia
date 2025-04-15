/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
// Import tweetnacl from esm.sh
import nacl from "https://esm.sh/tweetnacl@1.0.3";
// Import Supabase client
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { decrypt } from "../_shared/security.ts"; // Try relative path one level up

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

async function verifySignature(request: Request, publicKey: string | undefined, rawBody: string): Promise<{ isValid: boolean }> {
  if (!publicKey) {
      console.error("Verification skipped: Public key was not provided.");
      return { isValid: false }; 
  }

  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  
  if (!signature || !timestamp || !rawBody) {
    return { isValid: false };
  }

  try {
      const isValid = nacl.sign.detached.verify(
        new TextEncoder().encode(timestamp + rawBody),
        hexToUint8Array(signature),
        hexToUint8Array(publicKey)
      );
      return { isValid };
  } catch (e) {
      console.error("Error during signature verification:", e);
      return { isValid: false };
  }
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
async function sendFollowup(interactionToken: string, content: string, discordAppId: string | undefined) {
  if (!discordAppId) {
    console.error('Cannot send followup: Discord App ID is missing.');
    return;
  }
  const url = `https://discord.com/api/v10/webhooks/${discordAppId}/${interactionToken}`;
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
async function handleCommand(interaction: Interaction, discordAppId: string | undefined): Promise<Response> {
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
        const selectedAgentId = agentOption?.value as string; 

        if (!selectedAgentId) {
            console.error("Agent ID missing from activate command options.", interaction.data?.options);
            return new Response(JSON.stringify({ type: 4, data: { content: "❌ Error: Agent ID was not provided correctly." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        console.log(`Deferring response for /activate command (Agent ID: ${selectedAgentId})`);
        const deferResponse = new Response(JSON.stringify({ type: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        let activationSuccess = false;
        let errorMessage = "An unknown error occurred during activation.";
        
        try {
            console.log(`Processing /activate for Agent ID "${selectedAgentId}" in Guild ${guildId}...`);

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
                        discord_bot_key, 
                        user_id -- <<< Fetch user_id of agent owner
                    )
                `)
                .eq('guild_id', guildId)
                .eq('agent_id', selectedAgentId) // <<< Filter by agent ID now
                .single(); // Expect only one connection per agent+guild

            if (connectionError) {
                console.error("Supabase error fetching connection by agent ID:", connectionError);
                throw new Error("Database error retrieving connection details.");
            }
            if (!connectionData) {
                // This shouldn't happen if the agent ID came from valid autocomplete 
                // or the user provided a valid ID they own connection to.
                console.warn(`No connection found for Agent ID "${selectedAgentId}" in Guild ${guildId}.`); 
                throw new Error("This agent is not linked to this server. Please check the agent ID or configuration.");
            }
            // --- End fetch ---

            // --- Check agent data and fetch owner's encryption key --- 
            if (!connectionData.agents) {
                 throw new Error("Internal Error: Agent data missing from connection join.");
            }
            const agentOwnerUserId = connectionData.agents.user_id;
            const encryptedBotKey = connectionData.agents.discord_bot_key;
            const agentName = connectionData.agents.name; // Get name for messages

            if (!agentOwnerUserId) {
                throw new Error("Configuration Error: Agent owner information missing.");
            }
            if (!encryptedBotKey) {
                console.error(`Encrypted bot token missing for Agent ${selectedAgentId} (Name: ${agentName})`);
                throw new Error("Configuration Error: Bot token is missing or not encrypted for the agent.");
            }

            const { data: secretData, error: secretError } = await supabaseAdmin
                .from('user_secrets')
                .select('encryption_key')
                .eq('user_id', agentOwnerUserId)
                .single();

            if (secretError || !secretData?.encryption_key) {
                console.error(`Encryption key fetch error for agent owner ${agentOwnerUserId}:`, secretError);
                throw new Error("Internal Server Error: Could not retrieve agent owner encryption key.");
            }
            const ownerEncryptionKey = secretData.encryption_key;
            // --- End key fetch ---

            // --- Decrypt the Bot Token ---
            let botToken: string;
            try {
                botToken = await decrypt(encryptedBotKey, ownerEncryptionKey);
            } catch (decryptionError) {
                console.error(`Failed to decrypt token for agent ${selectedAgentId}:`, decryptionError);
                throw new Error("Internal Server Error: Failed to decrypt agent credentials.");
            }
            // --- End Decryption ---

            const connectionId = connectionData.id;
            const timeoutMinutes = connectionData.inactivity_timeout_minutes || 10;
            const currentStatus = connectionData.worker_status;

            console.log(`Connection ID: ${connectionId}, Agent ID: ${selectedAgentId}, Owner: ${agentOwnerUserId}, Status: ${currentStatus}`);

            if (currentStatus === 'active' || currentStatus === 'activating') {
                 console.log(`Agent ${selectedAgentId} (Name: ${agentName}) is already active or activating.`);
                 errorMessage = "Agent is already active or being activated.";
                 await sendFollowup(interactionToken, errorMessage, discordAppId);
                 return deferResponse; // Return deferred response
            }
            
            console.log(`Setting status to 'activating' for connection ${connectionId}`);
            const { error: updateError } = await supabaseAdmin
                .from('agent_discord_connections')
                .update({ worker_status: 'activating' })
                .eq('id', connectionId);
            if (updateError) {
                console.error("Supabase error updating status to activating:", updateError);
            }
            
            console.log(`Calling manager service at ${managerUrl}/start-worker for Agent ID ${selectedAgentId}`);
            const managerResponse = await fetch(`${managerUrl}/start-worker`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${managerSecretKey}` 
                },
                body: JSON.stringify({ 
                    agentId: selectedAgentId, 
                    botToken: botToken, // <<< Use decrypted token
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

            console.log(`Manager service successfully triggered worker for Agent ID ${selectedAgentId} (Name: ${agentName})`);
            activationSuccess = true;
            errorMessage = `✅ Agent '${agentName}' activation initiated! (Timeout: ${timeoutMinutes} mins)`;

        } catch (error) {
            console.error(`Error during /activate processing for Agent ID "${selectedAgentId}":`, error);
            errorMessage = `❌ Activation failed: ${error.message}`;
            // Attempt to set status to error using the found connectionId if available
            // Needs adjustment if connectionData lookup failed earlier
            // ... error status update logic ...
        } finally {
            console.log(`Sending followup for interaction ${interactionId}: ${errorMessage}`);
            await sendFollowup(interactionToken, errorMessage, discordAppId);
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

  // --- Step 1: Preliminary Body Parse for PING Check --- 
  // We need to check for PING *before* validating signature or fetching secrets
  // Clone request first as body can only be read once
  let rawBody: string;
  let preliminaryInteraction: Interaction | null = null;
  try {
    rawBody = await req.clone().text(); // Read body from clone
    preliminaryInteraction = JSON.parse(rawBody);
  } catch (e) {
    console.error("Failed to parse initial request body:", e);
    return new Response(JSON.stringify({ error: "Bad Request" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // --- Step 2: Handle PING Immediately --- 
  if (preliminaryInteraction?.type === 1) {
    console.log("Constructing PING response...");
    const pingResponseBody = JSON.stringify({ type: 1 });
    const pingResponseHeaders = { 'Content-Type': 'application/json' };
    const pingStatus = 200;
    
    // Log the details before sending
    console.log(`-- PING Response Details --`);
    console.log(`Status: ${pingStatus}`);
    console.log(`Headers: ${JSON.stringify(pingResponseHeaders)}`);
    console.log(`Body: ${pingResponseBody}`);
    console.log(`--------------------------`);
    
    const pingResponse = new Response(pingResponseBody, { 
        headers: pingResponseHeaders,
        status: pingStatus
    });
    return pingResponse; // Return the constructed response
  }

  // --- If not a PING, proceed with normal flow ---

  // --- Parse Interaction Secret from URL ---
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const interactionSecret = pathSegments.length === 5 && pathSegments[1] === 'functions' && pathSegments[2] === 'v1' && pathSegments[3] === 'discord-interaction-handler' 
                          ? pathSegments[4] 
                          : null;
                          
  if (!interactionSecret) {
      console.error("Bad Request: Interaction secret missing or URL format incorrect.", url.pathname);
      return new Response(JSON.stringify({ error: "Bad Request: Invalid interaction URL." }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
  }
  console.log(`Parsed interaction secret: ${interactionSecret.substring(0, 10)}...`);

  // --- Lookup Connection by Secret ---
  const { data: connDetails, error: connError } = await supabaseAdmin
      .from('agent_discord_connections')
      .select('discord_public_key, discord_app_id, agent_id, guild_id') 
      .eq('interaction_secret', interactionSecret)
      .maybeSingle();
  
  if (connError || !connDetails) {
      console.error("Database error looking up connection by secret:", connError);
      return new Response(JSON.stringify({ error: "Internal Server Error: Failed to validate interaction source." }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
  }
  console.log(`Found connection for agent ${connDetails.agent_id} via secret.`);

  // --- Verify Request Signature using fetched key --- 
  // Pass the already read rawBody to verifySignature to avoid reading twice
  const { isValid } = await verifySignature(req, connDetails.discord_public_key, rawBody);
  if (!isValid) {
    console.warn("Invalid request signature received (using key from DB).");
    return new Response("Invalid request signature", { status: 401 });
  }
  console.log("Request signature verified successfully (using key from DB).");

  // --- Handle Verified Interactions (COMMAND, AUTOCOMPLETE, etc.) ---
  // Check if preliminaryInteraction is valid before proceeding
  if (!preliminaryInteraction) {
      console.error("Internal error: Interaction object became null unexpectedly after PING check.");
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const interaction: Interaction = preliminaryInteraction; // Now assigned safely
  try {
    const fetchedAppId = connDetails.discord_app_id;

    switch (interaction.type) {
      case 2: // APPLICATION_COMMAND
        return await handleCommand(interaction, fetchedAppId);
      case 4: // APPLICATION_COMMAND_AUTOCOMPLETE
        return await handleAutocomplete(interaction);
      default:
        console.warn(`Received unhandled interaction type: ${interaction.type}`);
        return new Response(JSON.stringify({ type: 4, data: { content: "Unhandled interaction type." } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
      console.error("Error processing interaction:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process interaction" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});

// --- Step 7.5: Remove Env Var Dependencies (Done implicitly by not using them) ---
// We no longer read DISCORD_PUBLIC_KEY or DISCORD_APP_ID from Deno.env

console.log("'discord-interaction-handler' function started."); 