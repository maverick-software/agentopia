import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // Assuming a shared CORS file

// Define the structure expected by the frontend
interface DiscordChannel {
  id: string;
  name: string;
  // Add other relevant fields if needed, like type
  type?: number; 
}

interface DiscordGuild {
  id: string;
  name: string;
  channels: DiscordChannel[];
}

// Placeholder for your decryption function - **IMPLEMENT THIS**
// It should take the encrypted base64 string and return the decrypted token
// Use environment variables for the secret key
async function decryptToken(encryptedToken: string): Promise<string> {
  console.warn("decryptToken function needs to be implemented using environment variables for the key!");
  // Example using Web Crypto API (AES-GCM) - Adapt as needed!
  // This is a simplified example and requires proper IV handling and key management.
  /*
  try {
    const encryptionKey = Deno.env.get('DISCORD_BOT_TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('Encryption key not set in environment variables.');

    // Key needs to be imported correctly based on how it was generated/stored
    // const key = await crypto.subtle.importKey(...) 

    // Assuming the encrypted string contains IV + ciphertext, properly encoded
    // const iv = ... // Extract IV
    // const ciphertext = ... // Extract ciphertext

    // const decrypted = await crypto.subtle.decrypt(
    //   { name: 'AES-GCM', iv: iv },
    //   key,
    //   ciphertext
    // );
    // return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt bot token.');
  }
  */
  // ** TEMPORARY - Replace with actual decryption **
  // This assumes the stored value is NOT encrypted for testing ONLY
   return atob(encryptedToken); // Very insecure if used in production!
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extract agentId from query params
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId');
    if (!agentId) {
      throw new Error('agentId query parameter is required.');
    }

    // 2. Create Supabase client
    const supabase = createClient(
      // Supabase API URL - env var recommended
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var recommended
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function?
      // Or use service role key if function needs broader permissions?
      // Using anon key for now, assuming RLS allows reading the token.
      // { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 3. Fetch encrypted token
    const { data: agentData, error: agentError } = await supabase
      .from('agents')
      .select('discord_bot_token_encrypted')
      .eq('id', agentId)
      .maybeSingle(); // Use maybeSingle in case agent not found

    if (agentError) throw agentError;
    if (!agentData?.discord_bot_token_encrypted) {
      console.log(`No encrypted bot token found for agent ${agentId}`);
      // Return empty array if no token is configured
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      });
    }

    // 4. Decrypt token (Replace placeholder)
    const decryptedToken = await decryptToken(agentData.discord_bot_token_encrypted);

    // 5. Call Discord API - Get Guilds
    const discordApiBase = 'https://discord.com/api/v10';
    const guildsResponse = await fetch(`${discordApiBase}/users/@me/guilds`, {
      headers: {
        Authorization: `Bot ${decryptedToken}`,
      },
    });

    if (!guildsResponse.ok) {
      const errorBody = await guildsResponse.text();
      console.error(`Discord API error (${guildsResponse.status}): ${errorBody}`);
      throw new Error(`Failed to fetch guilds from Discord: ${guildsResponse.statusText}`);
    }

    const guilds: any[] = await guildsResponse.json();

    // 6. Fetch Channels for each Guild (Optional but needed for UI)
    const guildsWithChannels: DiscordGuild[] = [];
    for (const guild of guilds) {
        try {
            const channelsResponse = await fetch(`${discordApiBase}/guilds/${guild.id}/channels`, {
                headers: { Authorization: `Bot ${decryptedToken}` },
            });

            if (!channelsResponse.ok) {
                console.warn(`Failed to fetch channels for guild ${guild.id} (${guild.name}). Status: ${channelsResponse.status}`);
                // Skip this guild or add with empty channels? Let's add with empty for now.
                 guildsWithChannels.push({
                    id: guild.id,
                    name: guild.name,
                    channels: [],
                });
                continue; 
            }

            const channels: DiscordChannel[] = (await channelsResponse.json())
                // Filter for standard text channels (type 0) - Adjust if other types needed
                .filter((ch: any) => ch.type === 0) 
                .map((ch: any) => ({ id: ch.id, name: ch.name }));

            guildsWithChannels.push({
                id: guild.id,
                name: guild.name,
                channels: channels,
            });
        } catch (channelError) {
             console.warn(`Error processing channels for guild ${guild.id} (${guild.name}):`, channelError);
             // Add guild with empty channels if channel fetch fails
             guildsWithChannels.push({
                id: guild.id,
                name: guild.name,
                channels: [],
            });
        }
    }

    // 7. Return formatted data
    return new Response(JSON.stringify(guildsWithChannels), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error in discord-get-bot-guilds function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Use 400 for client errors, 500 for server errors
    })
  }
})
