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

    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Step 1: Fetch Agents (without automatic join for user_profiles) ---
    let agentQuery = supabaseAdmin
        .from('agents')
        .select(`
            id,
            name,
            description,
            created_at,
            active,
            user_id 
        `, { count: 'exact' }) 
        .order('created_at', { ascending: false })
        .range(rangeStart, rangeEnd);

    // Apply search filter (only on agent fields now)
    if (search) {
        const lowerSearch = `%${search.toLowerCase()}%`;
        // Only search agent name/description directly
        // Searching owner fields requires fetching profiles first or a more complex query
        agentQuery = agentQuery.or(`name.ilike.${lowerSearch},description.ilike.${lowerSearch}`);
        // TODO: Enhance search later if needed to include owner after fetching profiles
    }

    const { data: agentsData, error: agentError, count } = await agentQuery;

    if (agentError) {
        console.error("Error fetching agents data:", agentError);
        throw new Error(`Failed to fetch agents: ${agentError.message}`);
    }
    
    if (!agentsData || agentsData.length === 0) {
         return new Response(JSON.stringify({ agents: [], total: count ?? 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });
    }

    // --- Step 2: Get IDs for subsequent queries ---
    const agentIds = agentsData.map(a => a.id);
    const userIds = agentsData.map(a => a.user_id).filter(id => id); // Filter out potential null/undefined user_ids

    // --- Step 3 & 4: Fetch Profiles and Connections in parallel ---
    const [profilesResult, connectionsResult] = await Promise.all([
        // Fetch profiles based on userIds from agents
        userIds.length > 0 ? supabaseAdmin
            .from('user_profiles')
            .select(`id, email, username, full_name`)
            .in('id', userIds) : Promise.resolve({ data: [], error: null }), // Avoid query if no userIds
        
        // Fetch connections based on agentIds
        supabaseAdmin
            .from('agent_discord_connections')
            .select(`id, agent_id, guild_id, worker_status, is_enabled`)
            .in('agent_id', agentIds)
    ]);

    if (profilesResult.error) {
        console.error("Error fetching user profiles:", profilesResult.error);
        // Continue but owner info might be missing
    }
     if (connectionsResult.error) {
        console.error("Error fetching agent connections:", connectionsResult.error);
        // Continue but connection info might be missing
    }

    // --- Add Explicit Type to Map --- 
    // Define Profile type inline or import from shared types if available
    type UserProfile = { id: string; email: string | null; username: string | null; full_name: string | null; };
    const userProfilesMap = new Map<string, UserProfile>(profilesResult.data?.map(p => [p.id, p as UserProfile]) || []);
    // -----

    const agentConnectionsMap = new Map<string, any[]>();
    connectionsResult.data?.forEach(c => {
        if (!agentConnectionsMap.has(c.agent_id)) {
            agentConnectionsMap.set(c.agent_id, []);
        }
        agentConnectionsMap.get(c.agent_id)?.push(c);
    });

    // --- Step 5: Combine data manually ---
    const processedAgents = agentsData.map(agent => {
        // Now TS knows the type of ownerProfile from the typed map
        const ownerProfile = agent.user_id ? userProfilesMap.get(agent.user_id) : null;
        const connections = agentConnectionsMap.get(agent.id) || [];

        // Determine representative discord status (same logic as before)
        const discord_status = connections.find(c => c.worker_status === 'active' || c.worker_status === 'connecting')?.worker_status || 'inactive';
        const enabled_guild_count = connections.filter(c => c.is_enabled).length || 0;
        const total_guild_count = connections.length || 0;

        return {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            created_at: agent.created_at,
            active: agent.active,
            owner: ownerProfile ? { 
                id: ownerProfile.id,
                email: ownerProfile.email,
                username: ownerProfile.username,
                full_name: ownerProfile.full_name
             } : null,
            discord_status: discord_status,
            enabled_guild_count: enabled_guild_count,
            total_guild_count: total_guild_count,
        };
    });

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