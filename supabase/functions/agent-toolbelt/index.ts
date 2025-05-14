import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdminClient } from '../_shared/supabaseAdminClient.ts';
import { ToolbeltService } from '../../../src/services/toolbelt_service/manager.ts'; // Adjust path as needed
import type { Database, Json } from '../../../src/types/database.types.ts'; // Adjust path as needed

// Define types for request bodies based on ToolbeltService method options, omitting IDs passed in URL
type AddToolToToolbeltBody = Omit<Parameters<ToolbeltService['addToolToAgentToolbelt']>[0], 'agent_id'>;
// Manually define Body types based on linter feedback for actual service option requirements
type ConnectAgentToolCredentialBody = {
    credential_type: string;
    credential_value: string; // Plaintext value, service will handle vaulting
    status?: Database['public']['Enums']['agent_tool_credential_status_enum']; 
    metadata?: Json; 
};
type SetAgentToolCapabilityPermissionBody = {
    capability_name: string;
    is_permitted: boolean; // Changed from is_allowed based on linter
};
type AddAgentToolboxAccessBody = { account_tool_environment_id: string };


console.log('Initializing agent-toolbelt function');

const toolbeltService = new ToolbeltService(supabaseAdminClient);
// const accountEnvService = new AccountEnvironmentService(supabaseAdminClient); // For toolbox ownership checks

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let userId: string;
  let agentId: string;
  let toolbeltItemId: string | undefined;
  let credentialId: string | undefined;
  let toolboxAccessId: string | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: userError?.message || 'Authentication failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    userId = user.id;
    console.log('Authenticated user for agent-toolbelt:', userId);

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Expected path: /agent-toolbelt/agents/{agentId}/toolbelt/...
    const basePathIndex = pathSegments.indexOf('agent-toolbelt');
    const relevantPathSegments = basePathIndex !== -1 ? pathSegments.slice(basePathIndex + 1) : [];

    console.log('Request for agent-toolbelt:', req.method, url.pathname, 'Relevant segments:', relevantPathSegments);

    if (relevantPathSegments.length < 2 || relevantPathSegments[0] !== 'agents') {
      return new Response(JSON.stringify({ error: 'Invalid path structure. Expected /agent-toolbelt/agents/{agentId}/...' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    agentId = relevantPathSegments[1];

    // --- Authorization Check: Ensure user owns the agent ---
    const { data: agentData, error: agentError } = await supabaseAdminClient
      .from('agents')
      .select('user_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agentData) {
      console.error(`Error fetching agent ${agentId}:`, agentError);
      return new Response(JSON.stringify({ error: `Agent ${agentId} not found.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }
    if (agentData.user_id !== userId) {
      return new Response(JSON.stringify({ error: `User ${userId} does not own agent ${agentId}.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    console.log(`User ${userId} authorized for agent ${agentId}.`);

    const toolbeltPathSegments = relevantPathSegments.slice(3); // Segments after /agents/{agentId}/toolbelt

    // --- ROUTING LOGIC START ---
    // Route: /agents/{agentId}/toolbelt/toolbox-access
    if (relevantPathSegments[2] === 'toolbelt' && toolbeltPathSegments.length >= 1 && toolbeltPathSegments[0] === 'toolbox-access') {
      const toolboxAccessSubSegments = toolbeltPathSegments.slice(1); // Segments after /toolbox-access

      if (req.method === 'POST' && toolboxAccessSubSegments.length === 0) {
        const body = await req.json() as AddAgentToolboxAccessBody;
        if (!body.account_tool_environment_id) {
            return new Response(JSON.stringify({ error: 'Missing required field: account_tool_environment_id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }
        // Authorization: Check if user owns the toolbox
        const { data: toolboxData, error: toolboxError } = await supabaseAdminClient
            .from('account_tool_environments')
            .select('user_id')
            .eq('id', body.account_tool_environment_id)
            .single();
        if (toolboxError || !toolboxData) {
            return new Response(JSON.stringify({ error: `Toolbox ${body.account_tool_environment_id} not found.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
        }
        if (toolboxData.user_id !== userId) {
             return new Response(JSON.stringify({ error: `User does not own toolbox ${body.account_tool_environment_id}.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
        }

        const { data, error } = await supabaseAdminClient
            .from('agent_toolbox_access')
            .insert({ agent_id: agentId, account_tool_environment_id: body.account_tool_environment_id })
            .select()
            .single();
        if (error) { throw error; }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      } else if (req.method === 'GET' && toolboxAccessSubSegments.length === 0) {
        const { data, error } = await supabaseAdminClient
            .from('agent_toolbox_access')
            .select('*, account_tool_environments(id, name, status)')
            .eq('agent_id', agentId);
        if (error) { throw error; }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else if (req.method === 'DELETE' && toolboxAccessSubSegments.length === 1) {
        toolboxAccessId = toolboxAccessSubSegments[0];
        const { data, error } = await supabaseAdminClient
            .from('agent_toolbox_access')
            .delete()
            .eq('id', toolboxAccessId)
            .eq('agent_id', agentId) // Ensure agent ownership via RLS or direct check if needed
            .select()
            .single(); // Or .is(null) and return 204
        if (error) { throw error; }
        if (!data) return new Response(JSON.stringify({error: "Toolbox access record not found or not owned by agent"}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    // Route: /agents/{agentId}/toolbelt/items
    else if (relevantPathSegments[2] === 'toolbelt' && toolbeltPathSegments.length >=1 && toolbeltPathSegments[0] === 'items') {
        const itemsSubSegments = toolbeltPathSegments.slice(1); // Segments after /items

        if (req.method === 'POST' && itemsSubSegments.length === 0) {
            // POST /agents/{agentId}/toolbelt/items -> addToolToAgentToolbelt
            const body = await req.json() as AddToolToToolbeltBody;
            if (!body.account_tool_instance_id) {
                 return new Response(JSON.stringify({ error: 'Missing required field: account_tool_instance_id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
            }
            // Further auth: Ensure the agent has access to the toolbox where account_tool_instance_id resides
            const { data: instanceData, error: instanceError } = await supabaseAdminClient
              .from('account_tool_instances')
              .select('account_tool_environment_id')
              .eq('id', body.account_tool_instance_id)
              .single();

            if (instanceError || !instanceData) {
              return new Response(JSON.stringify({ error: `Tool instance ${body.account_tool_instance_id} not found.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
            }

            const { data: accessCheck, error: accessError } = await supabaseAdminClient
              .from('agent_toolbox_access')
              .select('id')
              .eq('agent_id', agentId)
              .eq('account_tool_environment_id', instanceData.account_tool_environment_id)
              .maybeSingle();
            
            if (accessError) throw accessError;
            if (!accessCheck) {
              return new Response(JSON.stringify({ error: `Agent ${agentId} does not have access to toolbox for instance ${body.account_tool_instance_id}.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
            }

            const result = await toolbeltService.addToolToAgentToolbelt({ agent_id: agentId, ...body });
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
        } else if (req.method === 'GET' && itemsSubSegments.length === 0) {
            // GET /agents/{agentId}/toolbelt/items -> getAgentToolbeltItems
            const items = await toolbeltService.getAgentToolbeltItems(agentId);
            return new Response(JSON.stringify(items), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else if (itemsSubSegments.length >= 1) {
            toolbeltItemId = itemsSubSegments[0];
            const toolbeltItemActionSegments = itemsSubSegments.slice(1); // Segments after /{toolbeltItemId}

            if (req.method === 'DELETE' && toolbeltItemActionSegments.length === 0) {
                // DELETE /agents/{agentId}/toolbelt/items/{toolbeltItemId} -> removeToolFromAgentToolbelt
                // ToolbeltService.removeToolFromAgentToolbelt already checks if item exists
                const result = await toolbeltService.removeToolFromAgentToolbelt(toolbeltItemId);
                return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            // Routes for /agents/{agentId}/toolbelt/items/{toolbeltItemId}/credentials
            else if (toolbeltItemActionSegments.length >= 1 && toolbeltItemActionSegments[0] === 'credentials') {
                const credentialsSubSegments = toolbeltItemActionSegments.slice(1); // Segments after /credentials

                if (req.method === 'POST' && credentialsSubSegments.length === 0) {
                    // POST .../{toolbeltItemId}/credentials
                    const body = await req.json() as ConnectAgentToolCredentialBody;
                     if (!body.credential_type || !body.credential_value) { // Basic validation, checking for credential_value
                        return new Response(JSON.stringify({ error: 'Missing required fields: credential_type, credential_value' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
                    }
                    const result = await toolbeltService.connectAgentToolCredential({ agent_toolbelt_item_id: toolbeltItemId, ...body });
                    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
                } else if (req.method === 'GET' && credentialsSubSegments.length === 0) {
                    // GET .../{toolbeltItemId}/credentials
                    const credentials = await toolbeltService.getAgentToolCredentialsForToolbeltItem(toolbeltItemId);
                    return new Response(JSON.stringify(credentials), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                } else if (req.method === 'DELETE' && credentialsSubSegments.length === 1) {
                    // DELETE .../{toolbeltItemId}/credentials/{credentialId}
                    credentialId = credentialsSubSegments[0];
                    const result = await toolbeltService.removeAgentToolCredential(credentialId);
                    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }
            // Routes for /agents/{agentId}/toolbelt/items/{toolbeltItemId}/permissions
            else if (toolbeltItemActionSegments.length >= 1 && toolbeltItemActionSegments[0] === 'permissions') {
                const permissionsSubSegments = toolbeltItemActionSegments.slice(1); // Segments after /permissions
                if (req.method === 'POST' && permissionsSubSegments.length === 0) {
                    // POST .../{toolbeltItemId}/permissions
                    const body = await req.json() as SetAgentToolCapabilityPermissionBody;
                    if (!body.capability_name || typeof body.is_permitted !== 'boolean') { // Basic validation, checking for is_permitted
                        return new Response(JSON.stringify({ error: 'Missing required fields: capability_name, is_permitted (must be boolean)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
                    }
                    const result = await toolbeltService.setAgentToolCapabilityPermission({ agent_toolbelt_item_id: toolbeltItemId, ...body });
                    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }); // Or 200 if upsert
                } else if (req.method === 'GET' && permissionsSubSegments.length === 0) {
                    // GET .../{toolbeltItemId}/permissions
                    const permissions = await toolbeltService.getAgentToolCapabilityPermissions(toolbeltItemId);
                    return new Response(JSON.stringify(permissions), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }
        }
    }

    // --- ROUTING LOGIC END ---

    return new Response(JSON.stringify({ error: 'Not found or method not supported for the path' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  } catch (e: unknown) {
    console.error('Error in agent-toolbelt function:', e);
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    if (e instanceof Error) {
      errorMessage = e.message;
        // Handle Supabase RLS or other specific errors more gracefully if needed
        if (e.message.includes('permission denied') || e.message.includes('constraint violation')) {
            statusCode = 403; // Or 400 for constraint violations
        } else if (e.message.includes('not found')) { // Custom error messages from service
            statusCode = 404;
        }
    }
    // Ensure we don't leak too much info from DB errors
    if (statusCode === 500 && errorMessage.toLowerCase().includes('database error')) {
        errorMessage = 'A database error occurred.';
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});

console.log('agent-toolbelt function script processed'); 