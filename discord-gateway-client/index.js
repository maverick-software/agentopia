import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables from the root .env file
dotenv.config({ path: '../.env' });

// Basic Intents: Guilds for server info, GuildMessages for receiving messages, MessageContent for reading message content
// Note: MessageContent intent requires verification and enabling in the Discord Developer Portal
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const chatFunctionUrl = process.env.SUPABASE_CHAT_FUNCTION_URL;

// --- Event Listeners ---

// When the client is ready, run this code (only once)
client.once('ready', readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Listen for message creation events
client.on('messageCreate', async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the bot was mentioned
    // Ensure client.user is available before checking mentions
    if (!client.user || !message.mentions.has(client.user.id)) {
        return; // Exit if the bot wasn't mentioned
    }

    console.log(`Received mention from ${message.author.tag} in channel ${message.channel.id}: "${message.content}"`);

    // --- Placeholder: Fetch Agent ID based on channel --- 
    // TODO: Implement logic to query Supabase 'agent_discord_connections' table
    //       to find the agentId associated with message.channel.id
    const agentId = 'PLACEHOLDER_AGENT_ID'; // Replace with actual lookup
    console.log(`[Placeholder] Using agentId: ${agentId}`);

    // --- Placeholder: Fetch Conversation History --- 
    // TODO: Implement logic to fetch recent messages (e.g., from Supabase or cache)
    const conversationHistory = [
        { role: 'user', content: message.content } // Simplistic history
    ];
    console.log('[Placeholder] Using simple conversation history.');

    // --- Prepare Payload for 'chat' Function --- 
    // !!! CRITICAL: Verify and update this payload structure !!!
    // This needs to exactly match what the 'chat' Supabase function expects.
    const payload = {
        agentId: agentId, 
        messages: conversationHistory,
        // Add any other required fields by the chat function
        // stream: false // Example: Specify if streaming is needed
    };
    console.log('Prepared payload for chat function:', JSON.stringify(payload, null, 2));

    // --- Call 'chat' Supabase Function --- 
    try {
        console.log(`Calling chat function at ${chatFunctionUrl}...`);
        const response = await fetch(chatFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // !!! CRITICAL: Verify Authentication !!!
                // Is Anon key sufficient, or is a service_role key or user JWT needed?
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey // Supabase often uses apikey header too
            },
            body: JSON.stringify(payload)
        });

        console.log(`Chat function response status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Chat function failed with status ${response.status}: ${errorBody}`);
        }

        // --- Handle Response --- 
        // !!! CRITICAL: Verify and update response handling !!!
        // Does the function return { "reply": "..." }? A stream? Plain text?
        const result = await response.json(); // Assumes JSON response like { "reply": "..." }
        const replyContent = result.reply; 

        if (!replyContent) {
            throw new Error('Chat function response did not contain a reply.');
        }

        console.log(`Received reply from chat function: "${replyContent}"`);

        // --- Send Response back to Discord --- 
        await message.reply(replyContent);
        console.log('Sent reply back to Discord.');

    } catch (error) {
        console.error('Error processing message:', error);
        try {
            // Attempt to notify the user in Discord about the error
            await message.reply("Sorry, I encountered an error trying to process that.");
        } catch (discordError) {
            console.error('Failed to send error message to Discord:', discordError);
        }
    }
});

// --- Login ---
if (!discordBotToken) {
    console.error('Error: DISCORD_BOT_TOKEN environment variable is not set.');
    process.exit(1); // Exit if the token is missing
}
if (!chatFunctionUrl) {
    console.error('Error: SUPABASE_CHAT_FUNCTION_URL environment variable is not set.');
    process.exit(1); // Exit if the chat function URL is missing
}
if (!supabaseAnonKey || !supabaseUrl) {
    console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY environment variables are missing.');
    // Don't necessarily exit here, as anon key might not be needed if service role is used later
    // process.exit(1);
}

console.log('Logging into Discord...');
client.login(discordBotToken)
    .then(() => {
        console.log('Successfully logged in!');
    })
    .catch(error => {
        console.error('Failed to log in:', error);
        process.exit(1);
    }); 