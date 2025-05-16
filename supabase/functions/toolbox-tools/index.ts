import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdminClient } from '../_shared/supabaseAdminClient.ts';
import { ToolInstanceService, DeployToolOptions, ManageToolInstanceOptions } from '../../../src/services/tool_instance_service/manager.ts'; // Adjust path
import { AccountEnvironmentService } from '../../../src/services/account_environment_service/manager.ts'; // Adjust path
import type { Database } from '../../../src/types/database.types.ts'; // Adjust path

console.log('Initializing toolbox-tools function');

const toolInstanceService = new ToolInstanceService(supabaseAdminClient);
const accountEnvService = new AccountEnvironmentService(supabaseAdminClient); // For auth checks

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let userId: string;
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
    console.log('Authenticated user for toolbox-tools:', userId);

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Expected path: /toolbox-tools/{toolboxId}/tools  OR /toolbox-tools/{toolboxId}/tools/{toolInstanceId} OR /toolbox-tools/{toolboxId}/tools/{toolInstanceId}/action
    const basePathIndex = pathSegments.indexOf('toolbox-tools');
    const relevantPathSegments = basePathIndex !== -1 ? pathSegments.slice(basePathIndex + 1) : [];
    console.log('Request for toolbox-tools:', req.method, url.pathname, 'Relevant segments:', relevantPathSegments);

    if (relevantPathSegments.length < 2 || relevantPathSegments[1] !== 'tools') {
        return new Response(JSON.stringify({ error: 'Invalid path structure. Expected /toolbox-tools/{toolboxId}/tools/...' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    const toolboxId = relevantPathSegments[0];

    // --- Authorization Check: Ensure user owns the toolboxId --- 
    const toolbox = await accountEnvService.getToolboxEnvironmentByIdForUser(userId, toolboxId);
    if (!toolbox) {
      return new Response(JSON.stringify({ error: `Toolbox with ID ${toolboxId} not found or access denied for user ${userId}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }); // Or 403 for access denied
    }
    console.log(`User ${userId} authorized for toolbox ${toolboxId}`);

    const toolPathSegments = relevantPathSegments.slice(2); // Segments after /toolbox-tools/{toolboxId}/tools

    // --- ROUTING LOGIC START ---
    if (req.method === 'POST' && toolPathSegments.length === 0) {
      // POST /toolbox-tools/{toolboxId}/tools -> deployToolToToolbox
      const body = await req.json() as Omit<DeployToolOptions, 'userId' | 'accountToolEnvironmentId'>;
      // Basic validation for required fields from DeployToolOptions (excluding those we add)
      if (!body.toolCatalogId || !body.instanceNameOnToolbox) {
        return new Response(JSON.stringify({ error: 'Missing required fields: toolCatalogId, instanceNameOnToolbox' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const result = await toolInstanceService.deployToolToToolbox({ 
        ...body, 
        userId, // Added from authenticated user
        accountToolEnvironmentId: toolboxId // Added from path
      });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
    } else if (req.method === 'GET' && toolPathSegments.length === 0) {
      // GET /toolbox-tools/{toolboxId}/tools -> getToolInstancesForToolbox
      const instances = await toolInstanceService.getToolInstancesForToolbox(toolboxId);
      return new Response(JSON.stringify(instances), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (req.method === 'GET' && toolPathSegments.length === 1) {
      // GET /toolbox-tools/{toolboxId}/tools/{toolInstanceId} -> getToolInstanceById
      const toolInstanceId = toolPathSegments[0];
      const instance = await toolInstanceService.getToolInstanceById(toolInstanceId);
      // Verify instance exists and belongs to the authorized toolbox
      if (!instance || instance.account_tool_environment_id !== toolboxId) { 
        return new Response(JSON.stringify({ error: `Tool instance ${toolInstanceId} not found on toolbox ${toolboxId}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }
      return new Response(JSON.stringify(instance), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (req.method === 'DELETE' && toolPathSegments.length === 1) {
      // DELETE /toolbox-tools/{toolboxId}/tools/{toolInstanceId} -> removeToolFromToolbox
      const toolInstanceId = toolPathSegments[0];
      // Ensure the instance exists and belongs to the toolbox before attempting to delete
      const existingInstance = await toolInstanceService.getToolInstanceById(toolInstanceId);
      if (!existingInstance || existingInstance.account_tool_environment_id !== toolboxId) {
        return new Response(JSON.stringify({ error: `Tool instance ${toolInstanceId} not found on toolbox ${toolboxId} for deletion.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }

      const result = await toolInstanceService.removeToolFromToolbox({ 
        userId, 
        accountToolInstanceId: toolInstanceId, 
        accountToolEnvironmentId: toolboxId 
      });
      // removeToolFromToolbox in the service returns the updated (or marked for deletion) record.
      // A 200 OK with the record, or 204 No Content if we don't want to return the record, are both valid.
      // Let's return the record as it might contain the updated status.
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (req.method === 'POST' && toolPathSegments.length === 2) {
      const toolInstanceId = toolPathSegments[0];
      const action = toolPathSegments[1];

      const existingInstance = await toolInstanceService.getToolInstanceById(toolInstanceId);
      if (!existingInstance || existingInstance.account_tool_environment_id !== toolboxId) {
        return new Response(JSON.stringify({ error: `Tool instance ${toolInstanceId} not found on toolbox ${toolboxId} for action '${action}'.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }

      let result;
      const manageOptions: ManageToolInstanceOptions = { 
        userId, 
        accountToolInstanceId: toolInstanceId, 
        accountToolEnvironmentId: toolboxId 
      };

      if (action === 'start') {
        result = await toolInstanceService.startToolOnToolbox(manageOptions);
      } else if (action === 'stop') {
        result = await toolInstanceService.stopToolOnToolbox(manageOptions);
      } else {
        return new Response(JSON.stringify({ error: `Invalid action '${action}'. Must be 'start' or 'stop'.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- ROUTING LOGIC END ---

    return new Response(JSON.stringify({ error: 'Not found or method not supported for the path' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  } catch (e: unknown) {
    console.error('Error in toolbox-tools function:', e);
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});

console.log('toolbox-tools function script processed'); 