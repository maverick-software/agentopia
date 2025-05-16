import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_APP_ID; // Also known as Application ID
const guildId = process.env.DISCORD_GUILD_ID; // Specific server ID for testing/development

if (!token) {
    throw new Error('Missing DISCORD_BOT_TOKEN in .env file');
}
if (!clientId) {
    throw new Error('Missing DISCORD_APP_ID in .env file');
}
if (!guildId) {
    console.warn('Missing DISCORD_GUILD_ID in .env file. Registering command globally (may take up to an hour).');
    // If you want to force global registration, remove the guildId check and the Routes.applicationGuildCommands line below
    // and uncomment the Routes.applicationCommands line.
}

// --- Command Definition ---

const activateCommand = new SlashCommandBuilder()
    .setName('activate')
    .setDescription('Activates your Agentopia bot for a period of time.')
    // Add the required 'agent' option with autocomplete
    .addStringOption(option =>
        option.setName('agent')
            .setDescription('The name or ID of the agent to activate')
            .setRequired(true)
            .setAutocomplete(true) // Enable autocomplete
    )
    .toJSON(); // Convert builder to JSON format for the API

const commands = [
    activateCommand
];

// --- Registration ---

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        let data;
        if (guildId) {
            // Registering commands to a specific guild (instantaneous update)
            console.log(`Registering commands for guild ${guildId}...`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`);
        } else {
            // Registering commands globally (can take up to an hour to propagate)
            console.log('Registering commands globally...');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
        }

    } catch (error) {
        console.error('Error registering commands:', error);
    }
})(); 