import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Database } from '../_shared/database.types.ts' // Assuming types are in _shared

console.log('Heartbeat function starting...');

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Restrict in production!
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to create Supabase admin client (move to _shared if used by multiple functions)
function getSupabaseAdminClient(req: Request): SupabaseClient {
  // Deno imports from esm.sh may not have process.env directly
  // Supabase Edge Functions have access to environment variables set in the dashboard
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or Service Role Key not defined for admin client in Edge Function.');
    // In a real scenario, you might throw or handle this more gracefully
    // For now, to allow compilation, returning a dummy client or throwing
    throw new Error('Supabase credentials not configured for Edge Function.');
  }

  // Note: In Deno, ensure you have appropriate headers for the admin client
  // if your RLS policies depend on them, though service_role bypasses RLS.
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
    auth: {
      persistSession: false, // No session persistence for backend operations
      autoRefreshToken: false, // No need to auto-refresh token
      detectSessionInUrl: false // Not relevant for server-to-server
    }
  });
}

serve(async (req) => {
  console.log('Heartbeat request received:', req.method, req.url);

  // Handle OPTIONS pre-flight request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }

  // 1. Extract Bearer token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Heartbeat: Missing or invalid Authorization header.');
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }
  const dtmaAuthToken = authHeader.substring(7); // Remove "Bearer "

  let requestPayload;
  try {
    requestPayload = await req.json();
    console.log('Heartbeat payload:', requestPayload);
  } catch (e) {
    console.error('Heartbeat: Invalid JSON payload:', e.message);
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }

  // Extract expected fields from payload (add validation as needed)
  const { dtma_version, system_status, tool_statuses } = requestPayload;

  try {
    const supabaseAdmin = getSupabaseAdminClient(req);

    // 2. Find agent_droplets record by dtma_auth_token
    const { data: dropletData, error: fetchError } = await supabaseAdmin
      .from('agent_droplets')
      .select('id, status')
      .eq('dtma_auth_token', dtmaAuthToken)
      .single();

    if (fetchError || !dropletData) {
      console.error('Heartbeat: Error fetching droplet or token not found:', fetchError?.message);
      // If PGRST116, it means no rows found -> token invalid
      const status = fetchError?.code === 'PGRST116' ? 401 : 500;
      const message = fetchError?.code === 'PGRST116' ? 'Unauthorized: Invalid token' : 'Internal server error: Could not verify token';
      return new Response(JSON.stringify({ error: message }), {
        status: status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
      });
    }

    // 3. Update the agent_droplets record
    const updates: Partial<Database['public']['Tables']['agent_droplets']['Update']> = {
      last_heartbeat_at: new Date().toISOString(),
      dtma_last_known_version: dtma_version,      // Optional: store from payload
      dtma_last_reported_status: { system_status, tool_statuses } as any, // Optional: store from payload. Cast to any if complex type.
    };

    if (dropletData.status === 'creating' || dropletData.status === 'pending_creation') {
      updates.status = 'active';
    }

    const { error: updateError } = await supabaseAdmin
      .from('agent_droplets')
      .update(updates)
      .eq('id', dropletData.id);

    if (updateError) {
      console.error('Heartbeat: Error updating droplet record:', updateError.message);
      return new Response(JSON.stringify({ error: 'Internal server error: Failed to update droplet status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
      });
    }

    console.log(`Heartbeat successful for droplet ID: ${dropletData.id}`);
    return new Response(null, { status: 204, headers: corsHeaders }); // 204 No Content for success and added CORS

  } catch (error) {
    console.error('Heartbeat: Unhandled exception:', error.message, error.stack);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }
}); 