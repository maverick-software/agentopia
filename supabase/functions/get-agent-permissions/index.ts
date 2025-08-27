import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Use service role key to bypass RLS for now
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })
    
    // Get auth header to identify the user
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    let userId: string | null = null
    
    if (authHeader) {
      // Try to decode the JWT to get the user ID
      try {
        const token = authHeader.replace('Bearer ', '')
        // Parse the JWT payload (base64 decode the middle part)
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]))
          userId = payload.sub // sub is the user ID in Supabase JWTs
          console.log('Extracted user ID from JWT:', userId)
        }
      } catch (e) {
        console.error('Failed to parse JWT:', e)
      }
    }
    
    // For testing, if no userId from JWT, just log and continue
    if (!userId) {
      console.log('No user ID found in JWT, proceeding without user validation')
      // return new Response(
      //   JSON.stringify({ error: 'Authentication required' }),
      //   { 
      //     status: 401, 
      //     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      //   }
      // )
    }

    // Parse request body to get agent_id
    const { agent_id } = await req.json()
    
    if (!agent_id) {
      return new Response(
        JSON.stringify({ error: 'agent_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // First, verify the agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, user_id')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      console.error('Agent lookup error:', agentError)
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user owns the agent (if we have userId)
    if (userId && agent.user_id !== userId) {
      console.log('Access denied: agent user_id:', agent.user_id, 'request user_id:', userId)
      // Could also check for team membership here if needed
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    console.log('Agent found and access granted, fetching permissions...')

    // Now fetch the permissions with proper joins
    const { data: permissions, error: permissionsError } = await supabase
      .from('agent_integration_permissions')  // Updated table name
      .select(`
        id,
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        is_active,
        permission_level,
        granted_at,
        granted_by_user_id,
        user_oauth_connections!inner (
          id,
          connection_name,
          external_username,
          connection_status,
          user_id,
          oauth_provider_id,
          oauth_providers!inner (
            name,
            display_name
          )
        )
      `)
      .eq('agent_id', agent_id)
      .eq('is_active', true)
      .eq('user_oauth_connections.connection_status', 'active')
      .order('granted_at', { ascending: false })

    if (permissionsError) {
      console.error('Error fetching permissions:', permissionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch permissions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Raw permissions data:', permissions)
    
    // Format the response to match expected structure
    const formattedPermissions = (permissions || []).map((item: any) => ({
      permission_id: item.id,
      agent_id: item.agent_id,
      connection_id: item.user_oauth_connections.id,
      connection_name: item.user_oauth_connections.connection_name || 
                      `${item.user_oauth_connections.oauth_providers.display_name} Connection`,
      external_username: item.user_oauth_connections.external_username,
      provider_name: item.user_oauth_connections.oauth_providers.name,
      provider_display_name: item.user_oauth_connections.oauth_providers.display_name,
      integration_name: item.user_oauth_connections.oauth_providers.display_name,
      allowed_scopes: item.allowed_scopes || [],
      is_active: item.is_active,
      permission_level: item.permission_level || 'custom',
      granted_at: item.granted_at,
      granted_by_user_id: item.granted_by_user_id
    }))

    console.log('Returning formatted permissions, count:', formattedPermissions.length)
    
    return new Response(
      JSON.stringify({ data: formattedPermissions }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
