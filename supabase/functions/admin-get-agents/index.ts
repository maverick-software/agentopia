import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-get-agents' started.");

// --- Helper Functions (Copied from admin-get-users/admin-set-user-status) ---
// It's recommended to move these to _shared eventually
async function getUserIdFromRequest(req: Request, supabaseClient: SupabaseClient): Promise<string | null> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  return userError ? null : user?.id ?? null;
}

async function checkAdminRole(userId: string, supabaseClient: SupabaseClient): Promise<boolean> {
   if (!userId) return false;
   const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('user_has_role', {
        user_id: userId,
        role_name: 'admin'
    });
    if (rpcError) {
        console.error("RPC Error checking admin role:", rpcError);
        return false;
    }
    return isAdmin ?? false;
}
// --- End Helper Functions ---

// --- Main Handler ---
serve(async (req) => {
  // Handle CORS preflight & check method is POST
  if (req.method === 'OPTIONS') { return new Response("ok", { headers: corsHeaders }); }
  if (req.method !== 'POST') { return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    const userId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(userId!, supabaseClient);
    if (!isAdmin) { return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    console.log(`Admin user ${userId} authorized for get-agents.`);

    // --- Get Body Params ---
    const { page = 1, perPage = 20, searchTerm = null } = await req.json();
    const pageNum = parseInt(page, 10) || 1;
    const perPageNum = parseInt(perPage, 10) || 20;
    const rangeStart = (pageNum - 1) * perPageNum;
    const rangeEnd = rangeStart + perPageNum - 1;
    const search = searchTerm?.trim() || null;

    console.log(`Fetching agents page: ${pageNum}, perPage: ${perPageNum}, search: '${search}'`);

    // --- Fetch Agents ---
    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabaseAdmin
        .from('agents')
        .select(`
            id,
            name,
            description,
            created_at,
            active, 
            user_id, 
            user_profiles!inner( id, email, username, full_name ),
            agent_discord_connections ( id, guild_id, worker_status, is_enabled )
        `, { count: 'exact' }) // Request total count
        .order('created_at', { ascending: false })
        .range(rangeStart, rangeEnd);

    // Apply search filter if searchTerm is provided
    if (search) {
        const lowerSearch = `%${search.toLowerCase()}%`;
        // Match against agent name, description, OR owner's email/username/full_name
        query = query.or(`name.ilike.${lowerSearch},description.ilike.${lowerSearch},user_profiles.email.ilike.${lowerSearch},user_profiles.username.ilike.${lowerSearch},user_profiles.full_name.ilike.${lowerSearch}`);
    }

    const { data: agents, error, count } = await query;

    if (error) {
        console.error("Error fetching agents:", error);
        // Attempt to provide more specific feedback for common issues
        if (error.message.includes('relation "public.user_profiles" does not exist')) {
             throw new Error(`Database error: Check if 'user_profiles' table exists and foreign key 'user_id' on 'agents' table correctly references 'user_profiles(id)'. The join syntax might be incorrect if the FK relationship isn't standard.`);
        } else if (error.message.includes('missing FROM-clause entry for table "user_profiles"')) {
            throw new Error(`Database error: Cannot filter directly on joined 'user_profiles' fields in .or(). Adjust filter logic.`);
        } else if (error.message.includes('relation "public.agent_discord_connections" does not exist')) {
             throw new Error(`Database error: Check if 'agent_discord_connections' table exists.`);
        }
        throw new Error(`Failed to fetch agents: ${error.message}`);
    }

    // Simplify the owner info and connection status
    const processedAgents = agents?.map(agent => {
        // Handle potential null from join (though !inner should prevent it)
        const ownerProfile = agent.user_profiles;
        const connections = agent.agent_discord_connections || [];

        return {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            created_at: agent.created_at,
            active: agent.active, // Agent's own active flag
            owner: ownerProfile ? { 
                id: ownerProfile.id,
                email: ownerProfile.email,
                username: ownerProfile.username,
                full_name: ownerProfile.full_name
             } : null, // Provide null if join failed unexpectedly
            // Aggregate connection status (example: find first 'active' or 'connecting')
            discord_status: connections.find(c => c.worker_status === 'active' || c.worker_status === 'connecting')?.worker_status || 'inactive',
            // Count enabled connections
            enabled_guild_count: connections.filter(c => c.is_enabled).length || 0,
            total_guild_count: connections.length || 0,
        };
    }) || [];


    return new Response(JSON.stringify({ agents: processedAgents, total: count ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
     console.error("Error in admin-get-agents:", error);
     if (error instanceof SyntaxError) { return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
     return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}); 