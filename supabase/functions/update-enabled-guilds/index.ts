import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, PostgrestError } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Define the expected structure for each item in the enabledGuilds array
interface EnabledGuildInfo {
  guild_id: string;
  is_enabled: boolean;
  // Include other fields that need to be preserved or updated during upsert
  discord_app_id: string; 
  discord_public_key: string;
  inactivity_timeout_ms: number | null; // Match DB schema type
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse request body
    const { 
      agentId, 
      enabledGuilds 
    }: { 
      agentId: string; 
      enabledGuilds: EnabledGuildInfo[]; 
    } = await req.json();

    if (!agentId || !Array.isArray(enabledGuilds)) {
      throw new Error('Missing required fields: agentId and enabledGuilds array.');
    }
    // Add more validation for the contents of enabledGuilds if needed
    if (enabledGuilds.some(g => !g.guild_id || typeof g.is_enabled !== 'boolean')) {
        throw new Error('Invalid data in enabledGuilds array. Each item must have guild_id and is_enabled.');
    }

    // 2. Create Supabase client with Service Role Key for upsert
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 3. Perform Upsert operation for each guild
    // We use Promise.all to run upserts potentially in parallel, 
    // but handle errors carefully.
    const upsertPromises = enabledGuilds.map(guildInfo => {
      // Construct the object to upsert
      // This includes the is_enabled flag and potentially other fields
      // if they need to be set on insert or updated.
      const upsertData = {
        agent_id: agentId,
        guild_id: guildInfo.guild_id,
        is_enabled: guildInfo.is_enabled,
        // Pass through other required fields provided by the frontend
        // These are necessary because the primary key is just 'id', not composite.
        // If a row for agent_id/guild_id doesn't exist, upsert creates it,
        // and needs these values. If it does exist, they might be updated.
        discord_app_id: guildInfo.discord_app_id,
        discord_public_key: guildInfo.discord_public_key,
        inactivity_timeout_ms: guildInfo.inactivity_timeout_ms,
        // worker_status is likely managed by the worker/manager, not set here
      };

      console.log(`Upserting for agent ${agentId}, guild ${guildInfo.guild_id} with data:`, upsertData);

      // Upsert based on agent_id and guild_id. 
      // Since (agent_id, guild_id) is only unique for non-null guild_id via an index,
      // we need a way to handle the upsert logic. 
      // Option 1: Query first, then insert or update. (Safer but slower)
      // Option 2: Use RPC function to handle upsert logic atomically. (Recommended)
      // Option 3: Try direct upsert with `onConflict` - This won't work directly with our partial index.
      
      // Implementing Option 1 for now:
      return (async () => {
        // Check if a record exists for this specific agent_id and guild_id
        const { data: existing, error: selectError } = await supabaseAdmin
            .from('agent_discord_connections')
            .select('id') // Select the actual primary key
            .eq('agent_id', agentId)
            .eq('guild_id', guildInfo.guild_id)
            .maybeSingle(); 

        if (selectError) {
            console.error(`Error checking existing connection for agent ${agentId}, guild ${guildInfo.guild_id}:`, selectError);
            throw selectError; // Propagate error
        }

        if (existing) {
            // Record exists, perform UPDATE on that specific record using its ID
            console.log(`Record exists (ID: ${existing.id}), updating...`);
            const { error: updateError } = await supabaseAdmin
                .from('agent_discord_connections')
                .update({ 
                    is_enabled: guildInfo.is_enabled,
                    // Update other fields if necessary?
                    discord_app_id: guildInfo.discord_app_id,
                    discord_public_key: guildInfo.discord_public_key,
                    inactivity_timeout_ms: guildInfo.inactivity_timeout_ms,
                 })
                .eq('id', existing.id); // Match on the actual primary key
             if (updateError) throw updateError;
             console.log(`Update successful for ID: ${existing.id}`);

        } else {
            // Record does not exist, perform INSERT
            console.log(`Record does not exist, inserting...`);
            // We need ALL required fields for insert, including those potentially
            // associated with the agent but stored denormalized here.
             const { error: insertError } = await supabaseAdmin
                .from('agent_discord_connections')
                .insert(upsertData); // Insert the full record
             if (insertError) throw insertError;
             console.log(`Insert successful for agent ${agentId}, guild ${guildInfo.guild_id}`);
        }
      })();
    });

    // Wait for all operations to complete
    const results = await Promise.allSettled(upsertPromises);

    // Check for errors
    const errors = results
        .filter(result => result.status === 'rejected')
        // deno-lint-ignore no-explicit-any
        .map(result => (result as PromiseRejectedResult).reason as any);

    if (errors.length > 0) {
      console.error('Errors during upsert operations:', errors);
      // Try to return a more specific error if possible
      const firstError = errors[0] as PostgrestError; // Type assertion
      throw new Error(`Failed to update some guilds: ${firstError?.message || 'Unknown error'}`);
    }

    // 4. Return success response
    return new Response(JSON.stringify({ message: 'Guild enablement status updated successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in update-enabled-guilds function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Default to 400 for client errors
    });
  }
}); 