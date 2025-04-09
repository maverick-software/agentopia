import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    if (type !== 'MESSAGE_CREATE') {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
      }
    );

    // Find agent by channel ID
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .select('*')
      .eq('discord_channel', data.channel_id)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found for this channel');
    }

    // Don't respond to bot messages
    if (data.author.bot) {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `${agent.system_instructions || ''}\n\nYou are ${agent.name}, an AI agent with the following personality: ${agent.personality}\n\n${agent.assistant_instructions || ''}`
        },
        {
          role: 'user',
          content: data.content
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    // Send response back to Discord
    const response = await fetch(
      `https://discord.com/api/v10/channels/${data.channel_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${agent.discord_bot_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: completion.choices[0].message.content,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message to Discord');
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Discord webhook error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process Discord webhook',
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