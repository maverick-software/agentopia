import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // Assuming a shared CORS file

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
    // We can use the ANON key here if RLS allows authenticated users to read connections for their own agents
    // If not, we might need to use SERVICE_ROLE_KEY or verify user JWT
    // Let's assume RLS is set up for authenticated users for now.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use Anon Key - Requires RLS policy
      { 
         global: { headers: { Authorization: req.headers.get('Authorization')! } },
         auth: { persistSession: false }
      }
    );

    // Verify user authentication (optional but recommended if using Anon key with RLS)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth Error getting user:', userError);
      throw new Error('User not authenticated.');
    }

    // 3. Fetch enabled guilds for the agent
    // Ensure RLS policy allows this user to select these rows
    const { data: connections, error: fetchError } = await supabase
      .from('agent_discord_connections')
      .select('guild_id, is_enabled')
      .eq('agent_id', agentId);
      // Note: This will include rows where guild_id might be null if they exist
      // The frontend modal should likely filter these out or handle them appropriately.

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      throw fetchError; // Throw the Supabase error directly
    }

    // 4. Format and return data
    // Ensure guild_id is not null before returning, filter out invalid rows
    const enabledGuilds = connections
      .filter(c => c.guild_id !== null)
      .map(c => ({ 
          guild_id: c.guild_id, 
          is_enabled: c.is_enabled 
      }));

    return new Response(JSON.stringify(enabledGuilds), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-enabled-guilds function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      // Use 401 for auth errors, 400 for bad requests, 500 for others
      status: error.message === 'User not authenticated.' ? 401 : (error.code ? 500 : 400), 
    });
  }
}); 