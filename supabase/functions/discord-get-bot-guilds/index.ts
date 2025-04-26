import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // Assuming a shared CORS file

// TEMPORARY - Use only while encryption is not implemented in discord-connect
async function decryptToken(supposedlyEncryptedToken: string): Promise<string> {
  console.warn("decryptToken function is NOT decrypting; returning raw value. Implement encryption in discord-connect.");
  // Simply return the raw token since discord-connect isn't encrypting yet
  return supposedlyEncryptedToken;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extract agentId from request body
    const body = await req.json();
    const agentId = body?.agentId;
    // const url = new URL(req.url);
    // const agentId = url.searchParams.get('agentId'); // Old method: query param
    if (!agentId) {
      throw new Error('agentId is required in the request body.');
    }

    // 2. Create Supabase client using Service Role Key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use Service Role Key
    );

    // 3. Fetch the token
    const { data: agentData, error: agentError } = await supabase
      .from('agents')
      .select('discord_bot_key') // Use correct column name
      .eq('id', agentId)
      .maybeSingle(); // Use maybeSingle in case agent not found

    if (agentError) throw agentError;
    if (!agentData?.discord_bot_key) {
      console.log(`No bot token found in discord_bot_key for agent ${agentId}`);
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      });
    }

    // 4. Use the token (no decryption needed for now)
    const botToken = agentData.discord_bot_key; 
    console.log(`[discord-get-bot-guilds] Using token (last 5 chars): ...${botToken.slice(-5)} to fetch guilds.`);

    // 5. Call Discord API - Get Guilds
    const discordApiBase = 'https://discord.com/api/v10';
    console.log(`[discord-get-bot-guilds] Fetching from: ${discordApiBase}/users/@me/guilds`);
    const guildsResponse = await fetch(`${discordApiBase}/users/@me/guilds`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    const responseStatus = guildsResponse.status;
    const responseText = await guildsResponse.text();
    console.log(`[discord-get-bot-guilds] Discord API response status: ${responseStatus}`);
    console.log(`[discord-get-bot-guilds] Discord API response body: ${responseText}`);

    if (!guildsResponse.ok) {
      console.error(`Discord API error (${responseStatus}): ${responseText}`); 
      throw new Error(`Failed to fetch guilds from Discord: ${guildsResponse.statusText}`);
    }

    let guilds: any[] = [];
    try {
        guilds = JSON.parse(responseText);
        console.log(`[discord-get-bot-guilds] Parsed guilds successfully:`, guilds);
    } catch (parseError) {
        console.error(`[discord-get-bot-guilds] Failed to parse Discord API response JSON:`, parseError);
        throw new Error(`Failed to parse guilds response from Discord.`);
    }
    
    // 7. Return formatted data (just id and name)
    const simplifiedGuilds = guilds.map(g => ({ id: g.id, name: g.name }));
    console.log(`[discord-get-bot-guilds] Returning simplified guilds:`, simplifiedGuilds);
    return new Response(JSON.stringify(simplifiedGuilds), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error("Error in discord-get-bot-guilds function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Use 400 for client errors, 500 for server errors
    })
  }
})
