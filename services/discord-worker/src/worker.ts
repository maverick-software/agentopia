// services/discord-worker/src/worker.ts
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import logger from './logger'; // Import the new logger

// --- DIAGNOSTIC LOGGING --- 
logger.debug(`--- Worker process starting ---`);
// Log all available environment variables passed by PM2
logger.debug(`process.env: ${JSON.stringify(process.env, null, 2)}`);
// --- END DIAGNOSTIC LOGGING ---

// REMOVED: Old log helper
// const log = (level: 'log' | 'warn' | 'error', ...args: any[]) => { ... };

logger.info("Worker process script execution starting.");

try {
    logger.info("Loading environment variables...");
// Load environment variables from .env file in the service directory
// NOTE: This is likely NOT needed if PM2 is injecting correctly, but keep for potential local testing
dotenv.config({ path: path.resolve(__dirname, '../.env') });
    logger.info("Environment variables potentially loaded (dotenv). Checking process.env...");

// --- Configuration --- 
    logger.info("Reading configuration from process.env...");
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const AGENT_ID = process.env.AGENT_ID;
const CONNECTION_ID = process.env.CONNECTION_DB_ID; // *** Corrected based on manager ***
    const timeoutEnvVar = process.env.INACTIVITY_TIMEOUT_MINUTES; // *** Corrected based on manager ***
    let TIMEOUT_MINUTES: number | null = null; // Use null to indicate no timeout
    if (timeoutEnvVar) {
        const parsed = parseInt(timeoutEnvVar, 10);
        if (!isNaN(parsed) && parsed > 0) {
            TIMEOUT_MINUTES = parsed;
        }
    }
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // *** Check if worker needs anon or service role ***
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // *** Added based on manager passing it ***
    logger.info("Configuration read complete. Validating...");

// Validate necessary configuration
// *** ADDED OPENAI_API_KEY validation ***
if (!BOT_TOKEN || !AGENT_ID || !CONNECTION_ID || !SUPABASE_URL || !SUPABASE_ANON_KEY || !OPENAI_API_KEY) { 
        logger.error("FATAL: Missing required environment variables.", {
            BOT_TOKEN: !!BOT_TOKEN,
            AGENT_ID: !!AGENT_ID,
            CONNECTION_ID: !!CONNECTION_ID,
            SUPABASE_URL: !!SUPABASE_URL,
            SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY, // *** Check if ANON_KEY is correct ***
            OPENAI_API_KEY: !!OPENAI_API_KEY      // *** Added check ***
        });
    process.exit(1); // Exit if configuration is missing
}
    logger.info("Configuration validated successfully.");

    logger.info(`Worker configured for Agent ID: ${AGENT_ID}`);
    logger.info(`Connection DB ID: ${CONNECTION_ID}`);
    logger.info(`Inactivity Timeout: ${TIMEOUT_MINUTES !== null ? `${TIMEOUT_MINUTES} minutes` : 'Disabled'}`);

// --- Supabase Client --- 
    logger.info("Initializing Supabase client...");
// *** Consider if worker needs Service Role Key instead of Anon Key for status updates ***    
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { // *** Use ANON_KEY? ***
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});
    logger.info("Supabase client initialized.");

// --- Discord Client --- 
    logger.info("Initializing Discord client...");
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Make sure this intent is enabled in Discord Dev Portal
        // Add other intents as needed (e.g., GuildMembers if needed)
    ]
});
    logger.info("Discord client initialized.");

// --- State --- 
let inactivityTimer: NodeJS.Timeout | null = null;
    logger.info("Initial state defined.");

// --- Functions --- 
    logger.info(`Defining functions (updateStatus, resetInactivityTimer, shutdown, checkDbRecord, handleShutdown) for connection ${CONNECTION_ID}...`);

    // *** REINSTATED: Worker uses RPC to update its own status ***
    async function updateStatus(status: 'active' | 'inactive' | 'stopping' | 'error', errorMessage?: string): Promise<void> {
        logger.info(`Attempting RPC update_worker_status for connection ${CONNECTION_ID} to status: ${status}. Error msg (if any): ${errorMessage}`);
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !serviceKey) {
            logger.error(`[WORKER UPDATE STATUS ${CONNECTION_ID}] Supabase URL or Service Key missing in env. Cannot update status.`);
            return; 
        }
        try {
            // Use Service Role Key for status updates
            const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, { // Use validated key
                 auth: { persistSession: false } 
             });
            const { error: rpcError } = await supabaseAdmin.rpc('update_worker_status', {
                connection_id_in: CONNECTION_ID, 
                new_status_in: status
            });
            if (rpcError) {
                logger.error(`Supabase RPC error calling update_worker_status for connection ${CONNECTION_ID}: ${JSON.stringify(rpcError)}`, { error: rpcError });
            } else {
                 logger.info(`Successfully called RPC update_worker_status for connection ${CONNECTION_ID} to status ${status}.`);
            }
        } catch (err: any) {
            logger.error(`Exception during RPC call update_worker_status for connection ${CONNECTION_ID}: ${err.message}`, { error: err });
        }
    }

    function resetInactivityTimer(): void {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
        if (TIMEOUT_MINUTES !== null && TIMEOUT_MINUTES > 0) { 
            logger.debug(`Resetting inactivity timer (${TIMEOUT_MINUTES} minutes) for connection ${CONNECTION_ID}...`);
    inactivityTimer = setTimeout(() => {
                logger.info(`Inactivity timeout reached for connection ${CONNECTION_ID}. Shutting down...`);
        shutdown('inactive'); // Trigger graceful shutdown due to inactivity
    }, TIMEOUT_MINUTES * 60 * 1000);
        } else {
            logger.debug(`Inactivity timer is disabled for connection ${CONNECTION_ID}.`);
        }
}

    async function shutdown(finalStatus: 'active' | 'inactive' | 'stopping' | 'error' = 'inactive', errorMessage?: string): Promise<void> {
        logger.info(`Initiating shutdown for connection ${CONNECTION_ID} with status: ${finalStatus}`);
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
            inactivityTimer = null; // Explicitly nullify
    }
    try {
         // *** REINSTATED: Update status on shutdown ***
        await updateStatus(finalStatus, errorMessage); 
        logger.info(`Destroying Discord client for connection ${CONNECTION_ID}...`);
        client.destroy();
            logger.info(`Shutdown complete for connection ${CONNECTION_ID}.`);
        process.exit(0); // Exit cleanly
    } catch (err: any) {
            logger.error(`Error during shutdown for connection ${CONNECTION_ID}: ${err.message}`, { error: err });
        process.exit(1); // Exit with error
    }
}

    // *** ADDED: DB Check Function ***
    async function checkDbRecord(recordType: 'agent' | 'connection', id: string): Promise<boolean> {
        logger.debug(`[WORKER DB CHECK ${CONNECTION_ID}] Checking for ${recordType} with ID: ${id}`);
        let tableName: string;
        let columnName: string;

        if (recordType === 'agent') {
            tableName = 'agents';
            columnName = 'id';
        } else if (recordType === 'connection') {
            tableName = 'agent_discord_connections';
            columnName = 'id'; // Assuming CONNECTION_ID is the primary key
        } else {
            logger.error(`[WORKER DB CHECK ${CONNECTION_ID}] Invalid record type specified: ${recordType}`);
            return false;
        }

        if (!id) {
             logger.error(`[WORKER DB CHECK ${CONNECTION_ID}] Cannot check for ${recordType}, ID is missing.`);
             return false;
        }

        try {
            // Use the existing anon client for the worker
            const { data, error, count } = await supabase
                .from(tableName)
                .select('id', { count: 'exact', head: true })
                .eq(columnName, id);

            if (error) {
                logger.error(`[WORKER DB CHECK ${CONNECTION_ID}] Supabase error checking ${recordType} ${id}: ${error.message}`, { error });
                return false; // Assume not found on error
            } 
            
            const exists = count !== null && count > 0;
            logger.debug(`[WORKER DB CHECK ${CONNECTION_ID}] ${recordType} ${id} ${exists ? 'FOUND' : 'NOT FOUND'}.`);
            return exists;

        } catch (err: any) {
            logger.error(`[WORKER DB CHECK ${CONNECTION_ID}] Exception checking ${recordType} ${id}: ${err.message}`, { error: err });
            return false;
        }
    }
    // *** END ADDED ***

    // --- Graceful Shutdown Handling --- 
    let isShuttingDown = false;

    const handleShutdown = async (signal: string): Promise<void> => {
        // Prevent multiple shutdowns if signals are received rapidly
        if (isShuttingDown) {
            logger.warn(`Shutdown already in progress for connection ${CONNECTION_ID}. Ignoring signal: ${signal}`);
            return;
        }
        isShuttingDown = true;
        logger.warn(`Received ${signal} for connection ${CONNECTION_ID}. Initiating graceful shutdown...`);
        await shutdown('inactive'); // Call the existing shutdown function, ensuring status is set to inactive
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// --- Discord Event Handlers --- 

client.once(Events.ClientReady, async (readyClient: any) => {
        logger.info(`[WORKER LOGIN SUCCESS ${CONNECTION_ID}] Logged in as ${readyClient.user.tag}!`);
        await checkDbRecord('agent', AGENT_ID);
        const connectionExists = await checkDbRecord('connection', CONNECTION_ID);
        logger.info(`[WORKER PRE-STATUS-UPDATE ${CONNECTION_ID}] Attempting to update status to active. Connection exists: ${connectionExists}`);
         // *** REINSTATED: Update own status to active ***
         await updateStatus('active'); 
        resetInactivityTimer(); 
});

client.on(Events.MessageCreate, async (message: any) => {
    // Ignore messages from bots or itself
    if (message.author.bot) return;

    // --- Activity Detection & Timer Reset --- 
    const botMention = `<@${client.user?.id}>`;
    const wasMentioned = message.content.includes(botMention);

    if (wasMentioned) {
            logger.info(`Bot mentioned by ${message.author.tag} in channel ${message.channelId}. Resetting timer for connection ${CONNECTION_ID}.`);
        resetInactivityTimer();

        const messageContent = message.content.replace(botMention, '').trim();
        await message.channel.sendTyping();

        if (messageContent) {
                logger.info(`Processing message for agent core. Agent ID: ${AGENT_ID}, Connection ID: ${CONNECTION_ID}`);
                try {
                    // *** NEW: Fetch agent details ***
                    const { data: agentData, error: agentFetchError } = await supabase
                        .from('agents')
                        .select('name, personality, system_instructions, assistant_instructions') // Added system/assistant instructions
                        .eq('id', AGENT_ID)
                        .single();

                    if (agentFetchError || !agentData) {
                         logger.error(`[AGENT ${AGENT_ID}] Error fetching agent details: ${agentFetchError?.message || 'No agent data found'}`, { error: agentFetchError });
                         await message.reply({ content: "Sorry, I encountered an internal error retrieving my configuration." });
                         return;
                    }
                    logger.debug(`[AGENT ${AGENT_ID}] Fetched agent details.`);

                    // *** NEW: Call chat function ***
                    const chatFunctionName = 'chat'; // Name of your Supabase chat function
                    logger.info(`[AGENT ${AGENT_ID}] Invoking Supabase function: ${chatFunctionName}`);
                    const { data: chatResponse, error: functionError } = await supabase.functions.invoke(chatFunctionName, {
                        body: {
                            agent_id: AGENT_ID,
                            agent_name: agentData.name,
                            system_prompt: agentData.system_instructions, // Use fetched value
                            assistant_prompt: agentData.assistant_instructions, // Use fetched value
                            user_message: messageContent,
                            user_id: message.author.id, // Pass invoking user ID
                            channel_id: message.channelId, // Pass channel ID
                            guild_id: message.guildId, // Pass guild ID
                            // Add any other relevant context here
                        }
                    });

                    if (functionError) {
                        logger.error(`[AGENT ${AGENT_ID}] Error invoking ${chatFunctionName} function: ${functionError.message}`, { error: functionError });
                        // More specific error checking
                        let replyMessage = "Sorry, I had trouble generating a response.";
                        if (functionError.message.includes('Failed to fetch')) {
                            replyMessage = "Sorry, I couldn't reach my core processing unit. Please try again later.";
                        } else if (functionError.message.includes('timeout')) {
                             replyMessage = "Sorry, my thought process timed out. Could you try asking again?";
                        }
                        await message.reply({ content: replyMessage });
                        return;
                    }

                    const reply = chatResponse?.reply || "Sorry, I couldn't think of anything to say.";
                    logger.info(`[AGENT ${AGENT_ID}] Received reply from ${chatFunctionName}: ${reply.substring(0, 50)}...`);

                    // Send the reply back to the Discord channel
                    await message.reply({ content: reply });
                    logger.debug(`[AGENT ${AGENT_ID}] Reply sent successfully.`);

                } catch (error: any) {
                    logger.error(`[AGENT ${AGENT_ID}] Error processing message: ${error.message}`, { error });
                    await message.reply({ content: "Oops! Something went wrong while I was thinking." });
                }
            } else {
                logger.info(`Bot mentioned by ${message.author.tag} with no message content.`);
            await message.reply({ content: "Hello there! How can I help you today?" });
                resetInactivityTimer(); // Also reset timer if mentioned with no content
        }
    }
});

// --- Error Handling --- 
client.on(Events.Error, (error: Error) => {
    logger.error('[DISCORD CLIENT ERROR]', error);
    // Consider if a client error should attempt a shutdown/restart or just log
});

client.on(Events.Warn, (info: string) => {
    logger.warn('[DISCORD CLIENT WARN]', info);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('[UNHANDLED REJECTION] Reason:', reason);
    // Optional: Decide if this is fatal and should trigger shutdown
    // shutdown('error', 'Unhandled Rejection');
});

// Catch uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    logger.error('[UNCAUGHT EXCEPTION] Error:', error);
    // This is generally considered fatal
    shutdown('error', 'Uncaught Exception'); 
});

// --- Login --- 
    logger.info("Attempting to log in to Discord...");
client.login(BOT_TOKEN).then(() => {
        logger.info("Discord login promise resolved."); // Login itself is async
}).catch((error: Error) => {
        logger.error("Discord login failed:", error);
    shutdown('error', 'Login Failure'); // Shutdown if login fails
});

} catch (initError: any) {
    // Catch errors during initial setup (config loading, client init)
    logger.error("FATAL: Error during worker initialization:", initError);
    process.exit(1); // Exit immediately on initialization failure
} 