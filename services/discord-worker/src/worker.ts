// services/discord-worker/src/worker.ts

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in the service directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("--- Discord Worker Starting ---");

// --- Configuration --- 
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const AGENT_ID = process.env.AGENT_ID;
const CONNECTION_ID = process.env.CONNECTION_ID; // Database ID for this connection
const timeoutEnvVar = process.env.TIMEOUT_MINUTES;
let TIMEOUT_MINUTES: number | null = null; // Use null to indicate no timeout
if (timeoutEnvVar) {
    const parsed = parseInt(timeoutEnvVar, 10);
    if (!isNaN(parsed) && parsed > 0) {
        TIMEOUT_MINUTES = parsed;
    }
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validate necessary configuration
if (!BOT_TOKEN || !AGENT_ID || !CONNECTION_ID || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("FATAL: Missing required environment variables.");
    process.exit(1); // Exit if configuration is missing
}

console.log(`Worker configured for Agent ID: ${AGENT_ID}`);
console.log(`Connection DB ID: ${CONNECTION_ID}`);
console.log(`Inactivity Timeout: ${TIMEOUT_MINUTES !== null ? `${TIMEOUT_MINUTES} minutes` : 'Disabled'}`);

// --- Supabase Client --- 
// Use Anon key - worker updates its own status, RLS policy should allow this.
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

// --- Discord Client --- 
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Make sure this intent is enabled in Discord Dev Portal
        // Add other intents as needed (e.g., GuildMembers if needed)
    ]
});

// --- State --- 
let inactivityTimer: NodeJS.Timeout | null = null;

// --- Functions --- 

/**
 * Updates the worker status in the Supabase database.
 */
async function updateStatus(status: 'active' | 'inactive' | 'stopping' | 'error', errorMessage?: string) {
    console.log(`Attempting to update status to: ${status} for connection ${CONNECTION_ID} (Type: ${typeof CONNECTION_ID})`);
    console.log(`Using filter: .eq('id', '${CONNECTION_ID}')`);
    try {
        console.log(`Checking existence of connection ${CONNECTION_ID} before update...`);
        const { data: checkData, error: checkError } = await supabase
            .from('agent_discord_connections')
            .select('id', { count: 'exact', head: true })
            .eq('id', CONNECTION_ID);

        if (checkError) {
            console.error(`Supabase error CHECKING connection ${CONNECTION_ID} BEFORE update:`, JSON.stringify(checkError, null, 2));
        } else if (!checkData || checkData.length === 0) {
            console.error(`CRITICAL: Connection ${CONNECTION_ID} NOT FOUND in DB right before update attempt! Update will fail.`);
            return;
        } else {
            console.log(`Connection ${CONNECTION_ID} confirmed to exist before update attempt.`);
        }

        console.log(`Proceeding with update for connection ${CONNECTION_ID}...`);
        const { data, error } = await supabase
            .from('agent_discord_connections')
            .update({ worker_status: status })
            .eq('id', CONNECTION_ID)
            .select();

        if (error) {
            console.error(`Supabase error UPDATING status for connection ${CONNECTION_ID}:`, JSON.stringify(error, null, 2));
        } else {
            console.log(`Successfully ran update in DB for connection ${CONNECTION_ID}. Result:`, JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error(`Exception during status update for connection ${CONNECTION_ID}:`, err);
    }
}

/**
 * Resets the inactivity timer.
 */
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    if (TIMEOUT_MINUTES !== null && TIMEOUT_MINUTES > 0) { 
        console.log(`Resetting inactivity timer (${TIMEOUT_MINUTES} minutes)...`);
        inactivityTimer = setTimeout(() => {
            console.log("Inactivity timeout reached. Shutting down...");
            shutdown('inactive'); // Trigger graceful shutdown due to inactivity
        }, TIMEOUT_MINUTES * 60 * 1000);
    } else {
        console.log("Inactivity timer is disabled.");
    }
}

/**
 * Handles graceful shutdown of the worker.
 */
async function shutdown(finalStatus: 'inactive' | 'error' = 'inactive', errorMessage?: string) {
    console.log(`Initiating shutdown with status: ${finalStatus}`);
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null; // Explicitly nullify
    }
    try {
        await updateStatus(finalStatus, errorMessage); 
        console.log("Destroying Discord client...");
        client.destroy();
        console.log("Shutdown complete.");
        process.exit(0); // Exit cleanly
    } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1); // Exit with error
    }
}

// --- Discord Event Handlers --- 

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}!`);
    await updateStatus('active'); // Set status to active in DB
    resetInactivityTimer(); // Start the inactivity timer (or confirm it's disabled)
});

client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots or itself
    if (message.author.bot) return;

    // --- Activity Detection & Timer Reset --- 
    // Check if the bot was mentioned
    const botMention = `<@${client.user?.id}>`;
    const wasMentioned = message.content.includes(botMention);

    if (wasMentioned) {
        console.log(`Bot mentioned by ${message.author.tag}. Resetting timer.`);
        resetInactivityTimer();

        // --- Agent Interaction Logic --- 
        // Extract the actual message content, removing the mention
        const messageContent = message.content.replace(botMention, '').trim();

        // Show typing indicator while processing
        await message.channel.sendTyping();

        if (messageContent) {
            console.log(`Sending message content to agent core for Agent ID: ${AGENT_ID}`);
            try {
                // Invoke the CORRECT agent core handler function
                const { data: agentResponse, error: agentError } = await supabase.functions.invoke(
                    'chat', // Corrected function name
                    {
                        body: {
                            agentId: AGENT_ID, // Pass the agent ID
                            userId: message.author.id, // Pass the Discord user ID
                            userName: message.author.username, // Pass username
                            channelId: message.channel.id, // Pass channel context
                            guildId: message.guild?.id, // Pass guild context
                            message: messageContent // Pass the actual message
                        }
                    }
                );

                if (agentError) {
                    console.error("Error invoking agent-core-handler:", agentError);
                    await message.reply("Sorry, I encountered an error trying to process that.");
                } else {
                    console.log("Received response from agent core:", agentResponse);
                    // Send the agent's response back to Discord
                    // Assuming agentResponse has a structure like { reply: "..." }
                    const replyContent = agentResponse?.reply || "Sorry, I couldn't generate a response.";
                    // Handle potential Discord message length limits
                    if (replyContent.length > 2000) {
                        await message.reply({ content: replyContent.substring(0, 1997) + '...' });
                    } else {
                        await message.reply({ content: replyContent });
                    }
                }
            } catch (invokeErr) {
                console.error("Exception invoking agent-core-handler:", invokeErr);
                await message.reply("Sorry, there was an unexpected issue connecting to the agent core.");
            }
        } else {
             // Handle cases where the bot is mentioned with no actual message content
             await message.reply("Hello! How can I help you today?"); // Or provide help info
        }
        // --- End Agent Interaction Logic ---
    } else {
        // Optional: Reset timer even on non-mention messages in specific channels/guilds?
        // For now, only mentions reset the timer.
    }
});

client.on(Events.Error, async (error) => {
    console.error("Discord Client Error:", error);
    // Attempt to report error status before shutting down
    await shutdown('error', error.message);
});

client.on(Events.Warn, (warning) => {
    console.warn("Discord Client Warning:", warning);
});

// --- Process Signal Handling --- 
// Gracefully handle common termination signals
process.on('SIGINT', () => shutdown('inactive'));
process.on('SIGTERM', () => shutdown('inactive'));

// --- Login --- 
console.log("Logging into Discord...");
client.login(BOT_TOKEN).catch(async (error) => {
    console.error("Failed to login:", error);
    // Update status to error if login fails
    await updateStatus('error', `Failed to login: ${error.message}`);
    process.exit(1);
}); 