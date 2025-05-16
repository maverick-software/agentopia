import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
// Assuming shared cors headers exist
import { corsHeaders } from "../_shared/cors.ts"; 

console.log("Function 'discord-get-guild-channels' started.");

serve(async (req) => {
  // --- START CORS Preflight Handling ---
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request for CORS preflight.");
    return new Response("ok", { headers: corsHeaders });
  }
  // --- END CORS Preflight Handling ---

  try {
    // 1. Get agentId and guildId from query parameters
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId');
    const guildId = url.searchParams.get('guildId');

    if (!agentId || !guildId) {
      return new Response(JSON.stringify({ error: "Missing agentId or guildId parameter" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // 2. Create Admin Client to get bot token (SECURITY: Service role key needed)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Fetch the bot token for the agent
    const { data: agentData, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('discord_bot_key')
      .eq('id', agentId)
      .single();

    if (agentError || !agentData?.discord_bot_key) {
      console.error("Error fetching agent token:", agentError);
      return new Response(JSON.stringify({ error: "Agent not found or bot token missing" }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    const botToken = agentData.discord_bot_key;

    // 4. Call Discord API to get channels
    const discordApiUrl = `https://discord.com/api/v10/guilds/${guildId}/channels`;
    const discordResponse = await fetch(discordApiUrl, {
      headers: {
        'Authorization': `Bot ${botToken}`
      }
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error(`Discord API error (${discordResponse.status}): ${errorText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch channels from Discord: ${discordResponse.statusText}` }), { 
        status: discordResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const channels = await discordResponse.json();

    // 5. Filter for text channels (Type 0)
    const textChannels = channels.filter((channel: any) => channel.type === 0);
    
    // 6. Return filtered channels
    return new Response(
      JSON.stringify(textChannels), // Return only the filtered text channels
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}); 