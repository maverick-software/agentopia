// services/discord-worker/src/worker.ts

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in the service directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Add helper for timestamp
const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => console[level](new Date().toISOString(), '[WK]', ...args);

console.log("--- Discord Worker Starting ---");
console.log(`[WORKER START] Process started. AgentID: ${process.env.AGENT_ID}, ConnectionID: ${process.env.CONNECTION_ID}`);

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
    log('log', `Attempting to update status to: ${status} for connection ${CONNECTION_ID} (Type: ${typeof CONNECTION_ID})`);
    log('log', `Using filter: .eq('id', '${CONNECTION_ID}')`);
    try {
        log('log', `Checking existence of connection ${CONNECTION_ID} before update...`);
        const { data: checkData, error: checkError } = await supabase
            .from('agent_discord_connections')
            .select('id', { count: 'exact', head: true })
            .eq('id', CONNECTION_ID);

        if (checkError) {
            log('error', `Supabase error CHECKING connection ${CONNECTION_ID} BEFORE update:`, JSON.stringify(checkError, null, 2));
        } else if (!checkData || checkData.length === 0) {
            log('error', `CRITICAL: Connection ${CONNECTION_ID} NOT FOUND in DB right before update attempt! Update will fail.`);
            return;
        } else {
            log('log', `Connection ${CONNECTION_ID} confirmed to exist before update attempt.`);
        }

        log('log', `Proceeding with update for connection ${CONNECTION_ID}...`);
        const { data, error } = await supabase
            .from('agent_discord_connections')
            .update({ worker_status: status })
            .eq('id', CONNECTION_ID)
            .select();

        if (error) {
            log('error', `Supabase error UPDATING status for connection ${CONNECTION_ID}:`, JSON.stringify(error, null, 2));
        } else {
            log('log', `Successfully ran update in DB for connection ${CONNECTION_ID}. Result:`, JSON.stringify(data, null, 2));
        }
    } catch (err) {
        log('error', `Exception during status update for connection ${CONNECTION_ID}:`, err);
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
        log('log', `Resetting inactivity timer (${TIMEOUT_MINUTES} minutes)...`);
        inactivityTimer = setTimeout(() => {
            log('log', "Inactivity timeout reached. Shutting down...");
            shutdown('inactive'); // Trigger graceful shutdown due to inactivity
        }, TIMEOUT_MINUTES * 60 * 1000);
    } else {
        log('log', "Inactivity timer is disabled.");
    }
}

/**
 * Handles graceful shutdown of the worker.
 */
async function shutdown(finalStatus: 'inactive' | 'error' = 'inactive', errorMessage?: string) {
    log('log', `Initiating shutdown with status: ${finalStatus}`);
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null; // Explicitly nullify
    }
    try {
        await updateStatus(finalStatus, errorMessage); 
        log('log', "Destroying Discord client...");
        client.destroy();
        log('log', "Shutdown complete.");
        process.exit(0); // Exit cleanly
    } catch (err) {
        log('error', "Error during shutdown:", err);
        process.exit(1); // Exit with error
    }
}

// *** ADDED: DB Check Function ***
async function checkDbRecord(recordType: 'agent' | 'connection', id: string): Promise<boolean> {
    log('log', `[WORKER DB CHECK] Checking for ${recordType} with ID: ${id}`);
    let tableName: string;
    let columnName: string;

    if (recordType === 'agent') {
        tableName = 'agents';
        columnName = 'id';
    } else if (recordType === 'connection') {
        tableName = 'agent_discord_connections';
        columnName = 'id'; // Assuming CONNECTION_ID is the primary key
    } else {
        log('error', "[WORKER DB CHECK] Invalid record type specified.");
        return false;
    }

    if (!id) {
         log('error', `[WORKER DB CHECK] Cannot check for ${recordType}, ID is missing.`);
         return false;
    }

    try {
        // Use the existing anon client for the worker
        const { data, error, count } = await supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true })
            .eq(columnName, id);

        if (error) {
            log('error', `[WORKER DB CHECK] Supabase error checking ${recordType} ${id}:`, error.message);
            return false; // Assume not found on error
        } 
        
        const exists = count !== null && count > 0;
        log('log', `[WORKER DB CHECK] ${recordType} ${id} ${exists ? 'FOUND' : 'NOT FOUND'}.`);
        return exists;

    } catch (err) {
        log('error', `[WORKER DB CHECK] Exception checking ${recordType} ${id}:`, err);
        return false;
    }
}
// *** END ADDED ***

// --- Discord Event Handlers --- 

client.once(Events.ClientReady, async (readyClient) => {
    log('log', `[WORKER LOGIN SUCCESS] Logged in as ${readyClient.user.tag}!`);
    await checkDbRecord('agent', AGENT_ID);
    const connectionExists = await checkDbRecord('connection', CONNECTION_ID);
    log('log', `[WORKER PRE-STATUS-UPDATE] Attempting to update status to active. Connection exists: ${connectionExists}`);
    await updateStatus('active'); // Set status to active in DB
    resetInactivityTimer(); // Start the inactivity timer (or confirm it's disabled)
});

client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots or itself
    if (message.author.bot) return;

    // --- Activity Detection & Timer Reset --- 
    const botMention = `<@${client.user?.id}>`;
    const wasMentioned = message.content.includes(botMention);

    if (wasMentioned) {
        log('log', `Bot mentioned by ${message.author.tag}. Resetting timer.`);
        resetInactivityTimer();

        const messageContent = message.content.replace(botMention, '').trim();
        await message.channel.sendTyping();

        if (messageContent) {
            log('log', `Processing message for agent core. Agent ID: ${AGENT_ID}`);
            try {
                // *** NEW: Fetch agent details ***
                const { data: agentData, error: agentFetchError } = await supabase
                    .from('agents')
                    .select('name, personality, system_instructions, assistant_instructions')
                    .eq('id', AGENT_ID)
                    .single();

                if (agentFetchError || !agentData) {
                    log('error', "Error fetching agent details for chat:", agentFetchError);
                    await message.reply("Sorry, I couldn't retrieve my configuration.");
                    return; // Don't proceed if agent details are missing
                }

                // *** NEW: Construct messages array ***
                const chatMessages = [
                    // We could potentially fetch actual history here in the future
                    { role: 'user', content: messageContent }
                ];
                
                // *** NEW: Construct payload matching chat function ***
                const chatPayload = {
                    messages: chatMessages,
                    agentId: AGENT_ID, // Already have this
                    agentName: agentData.name, // From fetched data
                    agentPersonality: agentData.personality, // From fetched data
                    systemInstructions: agentData.system_instructions, // From fetched data
                    assistantInstructions: agentData.assistant_instructions, // From fetched data
                    // Remove fields not expected by chat function:
                    // userId: message.author.id, 
                    // userName: message.author.username, 
                    // channelId: message.channel.id, 
                    // guildId: message.guild?.id, 
                    // message: messageContent 
                };

                log('log', "Sending payload to chat function:", JSON.stringify(chatPayload, null, 2));

                // --- MODIFIED: Use fetch to handle streaming response --- 
                const functionUrl = `${SUPABASE_URL}/functions/v1/chat`;
                let accumulatedReply = '';
                let fetchError: Error | null = null;

                try {
                    const response = await fetch(functionUrl, {
                        method: 'POST',
                        headers: {
                            // Pass Supabase Anon Key for function invocation (if RLS needed)
                            // Note: Service Role key used *inside* the function itself
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(chatPayload)
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        let detail = `Function returned error ${response.status}`;
                        try { detail = JSON.parse(errorBody).error || detail; } catch(e) {}
                        throw new Error(detail);
                    }

                    // Check if response is a stream
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('text/event-stream') && response.body) {
                        log('log', "Received stream response from chat function.");
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value, { stream: true });
                            // Simple handling: Assume chunk is the content itself
                            // More robust SSE parsing might be needed if using event types/ids
                            accumulatedReply += chunk;
                            // Optional: Send partial replies? Could be complex with rate limits.
                        }
                        log('log', "Finished reading stream. Full reply length:", accumulatedReply.length);
                    } else {
                        // Handle non-stream response (e.g., direct JSON error)
                        const nonStreamResponse = await response.json();
                        log('warn', "Received non-stream response:", nonStreamResponse);
                        // Try to extract an error or default
                         accumulatedReply = nonStreamResponse?.reply || nonStreamResponse?.error || "Received unexpected response format.";
                    }
                
                } catch (err) {
                    log('error', "Error fetching/processing chat function response:", err);
                    // --- MODIFIED: Type check before assignment ---
                    if (err instanceof Error) {
                        fetchError = err; // Assign if it's an Error
                    } else {
                        // Handle cases where the caught thing isn't an Error object
                        fetchError = new Error(`Caught non-Error value: ${String(err)}`); 
                    }
                    // --- END MODIFIED ---
                }
                // --- END MODIFIED --- 

                // --- MODIFIED: Handle reply based on fetch result --- 
                if (fetchError) {
                    // If fetch itself or reading the stream failed
                    await message.reply(`Sorry, I encountered an error: ${fetchError.message}`);
                } else if (accumulatedReply) {
                   // If we successfully accumulated a reply
                    if (accumulatedReply.length > 2000) {
                        await message.reply({ content: accumulatedReply.substring(0, 1997) + '...' });
                    } else {
                        await message.reply({ content: accumulatedReply });
                    }
                } else {
                    // If fetch succeeded but no reply content was accumulated (shouldn't happen often)
                    await message.reply("Sorry, I couldn't generate a response. (Empty reply received)");
                }
                // --- END MODIFIED --- 

            } catch (err) { // Catch errors from *before* fetch (e.g., fetching agent details)
                log('error', "Exception before invoking chat function:", err); 
                await message.reply("Sorry, there was an unexpected issue preparing your request.");
            }
        } else {
             await message.reply("Hello! How can I help you today?"); 
        }
    } else {
        // Optional: Reset timer even on non-mention messages in specific channels/guilds?
        // For now, only mentions reset the timer.
    }
});

client.on(Events.Error, async (error) => {
    log('error', "Discord Client Error:", error);
    // Attempt to report error status before shutting down
    await shutdown('error', error.message);
});

client.on(Events.Warn, (warning) => {
    log('warn', "Discord Client Warning:", warning);
});

// --- Process Signal Handling --- 
// Gracefully handle common termination signals
process.on('SIGINT', () => shutdown('inactive'));
process.on('SIGTERM', () => shutdown('inactive'));

// --- Login --- 
log('log', "[WORKER PRE-LOGIN] Attempting to log into Discord...");
(async () => { // Wrap check in async IIFE
    await checkDbRecord('agent', AGENT_ID);
    await checkDbRecord('connection', CONNECTION_ID);
    log('log', "[WORKER PRE-LOGIN] DB checks complete. Proceeding with login.");

    client.login(BOT_TOKEN).catch(async (error) => {
        log('error', "Failed to login:", error);
        // Update status to error if login fails
        await updateStatus('error', `Failed to login: ${error.message}`);
        process.exit(1);
    }); 
})(); // Immediately invoke the async function 