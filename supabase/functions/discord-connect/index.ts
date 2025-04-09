import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DiscordGuild {
  id: string;
  name: string;
  channels: {
    id: string;
    name: string;
    type: number;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { botToken, agentId } = await req.json();

    if (!botToken || !agentId) {
      throw new Error('Missing required parameters');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
      }
    );

    // Verify bot token by fetching guilds
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid bot token');
    }

    const guilds = await response.json();

    // For each guild, fetch channels
    const guildsWithChannels: DiscordGuild[] = await Promise.all(
      guilds.map(async (guild: { id: string; name: string }) => {
        const channelsResponse = await fetch(
          `https://discord.com/api/v10/guilds/${guild.id}/channels`,
          {
            headers: {
              'Authorization': `Bot ${botToken}`,
            },
          }
        );

        if (!channelsResponse.ok) {
          return {
            ...guild,
            channels: [],
          };
        }

        const channels = await channelsResponse.json();
        return {
          ...guild,
          channels: channels.filter((channel: { type: number }) => channel.type === 0), // Only text channels
        };
      })
    );

    // Update agent with bot token
    const { error: updateError } = await supabaseClient
      .from('agents')
      .update({ discord_bot_key: botToken })
      .eq('id', agentId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        guilds: guildsWithChannels,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Discord connection error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to connect to Discord',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});