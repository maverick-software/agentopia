import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // Assuming a shared CORS file

// TEMPORARY - Use only while encryption is not implemented in discord-connect
async function decryptToken(supposedlyEncryptedToken: string): Promise<string> {
  console.warn("decryptToken function is NOT decrypting; returning raw value. Implement encryption in discord-connect.");
  // Simply return the raw token since discord-connect isn't encrypting yet
  return supposedlyEncryptedToken;
}

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let agentId: string | null = null;
  try {
    const body = await req.json();
    agentId = body?.agentId;
    if (!agentId) {
      throw new Error('agentId is required in the request body.');
    }
  } catch(e) {
     return new Response(JSON.stringify({ error: 'Bad Request: Invalid JSON body or missing agentId.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
  }

  try {
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

    // --- Retry Logic for Discord API Call --- 
    let attempts = 0;
    let guildsResponse: Response | null = null;
    let responseText: string | null = null;
    let responseStatus: number | null = null;
    const maxAttempts = 2; // Try once, then retry once
    const retryDelay = 500; // 500ms delay between attempts

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[discord-get-bot-guilds] Attempt ${attempts}/${maxAttempts} to fetch guilds for agent ${agentId}...`);
      try {
        const discordApiBase = 'https://discord.com/api/v10';
        guildsResponse = await fetch(`${discordApiBase}/users/@me/guilds`, {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        });

        responseStatus = guildsResponse.status;
        responseText = await guildsResponse.text(); // Read text response

        console.log(`[discord-get-bot-guilds] Attempt ${attempts} - Discord API response status: ${responseStatus}`);

        if (guildsResponse.ok) {
          break; // Success, exit the loop
        } else {
          console.warn(`[discord-get-bot-guilds] Attempt ${attempts} failed with status ${responseStatus}. Response: ${responseText}`);
          if (attempts >= maxAttempts) {
             // Exhausted attempts, throw error based on last response
             throw new Error(`Discord API Error (${responseStatus}): ${responseText || guildsResponse.statusText}`);
          } else {
             // Wait before retrying
             console.log(`[discord-get-bot-guilds] Waiting ${retryDelay}ms before retry...`);
             await delay(retryDelay);
          }
        }
      } catch (fetchError) {
        console.error(`[discord-get-bot-guilds] Error during fetch attempt ${attempts}:`, fetchError);
        if (attempts >= maxAttempts) {
          // If fetch itself failed on last attempt, throw
          throw new Error(`Network or other error during Discord API call: ${fetchError.message}`);
        }
         // Wait before retrying even on network error
         console.log(`[discord-get-bot-guilds] Waiting ${retryDelay}ms before retry after fetch error...`);
         await delay(retryDelay);
      }
    }
    // --- End Retry Logic --- 

    // If loop finished and guildsResponse is still null or not ok, something went wrong despite retries
    if (!guildsResponse || !guildsResponse.ok || responseText === null) {
        console.error(`[discord-get-bot-guilds] Failed to fetch guilds after ${maxAttempts} attempts for agent ${agentId}. Last status: ${responseStatus}`);
         // Use the status and text from the last failed attempt captured above
        return new Response(JSON.stringify({ 
            error: `Failed to fetch guilds from Discord after retries. Last Status: ${responseStatus}`, 
            discord_response: responseText 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: responseStatus && responseStatus >= 400 && responseStatus < 500 ? responseStatus : 502, // Forward 4xx, use 502 otherwise
        });
    }

    // Parse the successful response
    let guilds: any[];
    try {
      guilds = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[discord-get-bot-guilds] Failed to parse Discord API response JSON for agent ${agentId}:`, parseError, `Response Text: ${responseText}`);
      return new Response(JSON.stringify({ error: 'Failed to parse guilds response from Discord.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, 
      });
    }
    
    // 7. Return formatted data (just id and name)
    const simplifiedGuilds = guilds.map(g => ({ id: g.id, name: g.name }));
    console.log(`[discord-get-bot-guilds] Successfully fetched and returned ${simplifiedGuilds.length} guilds for agent ${agentId}.`);
    return new Response(JSON.stringify(simplifiedGuilds), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    // Catch-all for errors before the retry loop (e.g., fetching agent token, initial setup)
    console.error(`[discord-get-bot-guilds] Pre-Discord call error for agent ${agentId}:`, error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred before contacting Discord.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      // Use specific status codes if available (like 404/500 from token fetch), otherwise 500
      status: error.status || 500, 
    });
  }
})
