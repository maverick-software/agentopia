import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-get-users' started.");

// --- Helper Functions ---
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
        return false; // Default to false on error
    }
    return isAdmin ?? false;
}

// --- Main Handler ---
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- Added: Check if body exists for POST --- 
  if (req.method !== 'POST') {
      console.warn(`Received non-POST request: ${req.method}`);
       return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
         status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
  }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    const userId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(userId!, supabaseClient);

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Admin user ${userId} authorized for get-users.`);

    // --- Fetch Users (with Pagination and Search from Body) ---
    const body = await req.json();
    const page = parseInt(body.page || "1", 10);
    const perPage = parseInt(body.perPage || "20", 10);
    const searchTerm = body.searchTerm?.trim() || null; // Get search term

    console.log(`Fetching users page: ${page}, perPage: ${perPage}, search: '${searchTerm}'`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch users from auth.users using admin API
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page: page, 
        perPage: perPage,
        // query: searchTerm // Check if this actually works for filtering by email/name - likely not
    });

    if (usersError) {
        console.error("Error listing users:", usersError);
        throw new Error("Failed to list users.");
    }

    let users = usersData.users || [];
    let totalUserCount = usersData.total ?? 0; // Get total from metadata if available

    // --- Filter users based on searchTerm (if provided) ---
    if (searchTerm && users.length > 0) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        console.log(`Filtering ${users.length} users based on term: '${lowerSearchTerm}'`);
        
        // Fetch profiles for all users on the current page to enable filtering by name/username
        const userIdsOnPage = users.map(u => u.id);
        const { data: profilesForPage, error: profilesError } = await supabaseAdmin
            .from('user_profiles')
            .select(`id, username, full_name`)
            .in('id', userIdsOnPage);

        if (profilesError) {
            console.error("Error fetching profiles for filtering:", profilesError);
            // Decide how to handle this - proceeding without profile filtering for now
        }

        users = users.filter(user => {
            const profile = profilesForPage?.find(p => p.id === user.id);
            const emailMatch = user.email?.toLowerCase().includes(lowerSearchTerm);
            const usernameMatch = profile?.username?.toLowerCase().includes(lowerSearchTerm);
            const fullNameMatch = profile?.full_name?.toLowerCase().includes(lowerSearchTerm);
            return emailMatch || usernameMatch || fullNameMatch;
        });
        console.log(`Filtered down to ${users.length} users.`);
        // TODO: Implement accurate total count when searching.
        // For now, totalUserCount reflects the pre-filtered total for the page requested.
    }


    if (!users || users.length === 0) {
        // Return the potentially inaccurate total count even if the filtered list is empty
        return new Response(JSON.stringify({ users: [], total: totalUserCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });
    }

    // Get IDs from the potentially filtered list
    const userIds = users.map(u => u.id);

    // --- Fetch Roles and Profiles for the *filtered* users ---
    const [rolesResult, profilesResultFiltered] = await Promise.all([
        supabaseAdmin
            .from('user_roles')
            .select(`user_id, roles!inner(id, name)`)
            .in('user_id', userIds),
        supabaseAdmin
            .from('user_profiles') // Using the renamed table
            .select(`id, username, full_name, avatar_url`) // Select all needed fields again
            .in('id', userIds)
    ]);

    if (rolesResult.error) console.error("Error fetching roles for filtered users:", rolesResult.error);
    if (profilesResultFiltered.error) console.error("Error fetching profiles for filtered users:", profilesResultFiltered.error);

    // --- Combine Data for *filtered* users ---
    const combinedUsers = users.map(user => {
        const profile = profilesResultFiltered.data?.find(p => p.id === user.id);
        const userRolesData = rolesResult.data?.filter(r => r.user_id === user.id) || [];
        const roles = userRolesData.map(r => r.roles).filter(role => role !== null);

        return {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            username: profile?.username,
            full_name: profile?.full_name,
            avatar_url: profile?.avatar_url,
            roles: roles, 
        };
    });

    // Return filtered user list, but potentially inaccurate total count
    return new Response(JSON.stringify({ users: combinedUsers, total: totalUserCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in admin-get-users:", error);
    // Check if the error is due to invalid JSON body
    if (error instanceof SyntaxError) {
         return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 