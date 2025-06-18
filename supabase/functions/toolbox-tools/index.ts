import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdminClient } from '../_shared/supabaseAdminClient.ts';

console.log('=== toolbox-tools function initializing ===');

// Helper function to make DTMA API calls
async function callDTMA(method: string, endpoint: string, toolboxPublicIP: string, body?: any) {
  const dtmaPort = Deno.env.get('DTMA_PORT') || '30000';
  const dtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
  
  if (!dtmaApiKey) {
    throw new Error('DTMA API key not configured');
  }

  const url = `http://${toolboxPublicIP}:${dtmaPort}${endpoint}`;
  console.log(`Making DTMA ${method} request to: ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dtmaApiKey}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DTMA API call failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// Helper function to update tool instance status in database
async function updateToolInstanceStatus(instanceId: string, status: string) {
  console.log(`Updating tool instance ${instanceId} status to: ${status}`);
  
  const { error } = await supabaseAdminClient
    .from('account_tool_instances')
    .update({ 
      status_on_toolbox: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', instanceId);

  if (error) {
    console.error('Error updating tool instance status:', error);
    throw new Error(`Failed to update instance status: ${error.message}`);
  }
}

serve(async (req: Request) => {
  console.log(`=== ${req.method} ${req.url} ===`);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create auth client for user authentication
    console.log('Creating auth client...');
    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    console.log('Authenticating user...');
    const { data: { user }, error: userError } = await supabaseClientAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log('Authenticated user:', userId);

    // Parse URL path
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    console.log('Path segments:', pathSegments);
    
    // Expected path: /toolbox-tools/{toolboxId}/tools/...
    const basePathIndex = pathSegments.indexOf('toolbox-tools');
    const relevantPathSegments = basePathIndex !== -1 ? pathSegments.slice(basePathIndex + 1) : [];
    console.log('Relevant segments:', relevantPathSegments);

    if (relevantPathSegments.length < 2 || relevantPathSegments[1] !== 'tools') {
        console.error('Invalid path structure. Expected /toolbox-tools/{toolboxId}/tools/...');
        return new Response(JSON.stringify({ 
          error: 'Invalid path structure. Expected /toolbox-tools/{toolboxId}/tools/...',
          received: relevantPathSegments 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        });
    }
    
    const toolboxId = relevantPathSegments[0];
    console.log('Toolbox ID:', toolboxId);

    // Verify user owns the toolbox (simplified check)
    const { data: toolboxData, error: toolboxError } = await supabaseAdminClient
      .from('account_tool_environments')
      .select('user_id, public_ip_address')
      .eq('id', toolboxId)
      .single();

    if (toolboxError || !toolboxData || toolboxData.user_id !== userId) {
      console.error('Toolbox access denied:', { toolboxError, toolboxData, userId });
      return new Response(JSON.stringify({ error: `Toolbox access denied` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 403 
      });
    }
    console.log(`User ${userId} authorized for toolbox ${toolboxId}`);

    const toolPathSegments = relevantPathSegments.slice(2); // Segments after /toolbox-tools/{toolboxId}/tools

    // --- ROUTING LOGIC ---
    if (req.method === 'POST' && toolPathSegments.length === 2) {
      const toolInstanceId = toolPathSegments[0];
      const action = toolPathSegments[1];

      console.log(`Handling ${action} action for tool instance: ${toolInstanceId}`);

      // Get tool instance details
      const { data: instance, error: instanceError } = await supabaseAdminClient
        .from('account_tool_instances')
        .select('*')
        .eq('id', toolInstanceId)
        .eq('account_tool_environment_id', toolboxId)
        .single();

      if (instanceError || !instance) {
        console.error('Tool instance not found:', { instanceError, toolInstanceId, toolboxId });
        return new Response(JSON.stringify({ 
          error: `Tool instance ${toolInstanceId} not found on toolbox ${toolboxId}` 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 404 
        });
      }

      console.log('Found tool instance:', instance.instance_name_on_toolbox);

      let result;
      if (action === 'start') {
        console.log('Starting tool instance via DTMA...');
        
        // First check if DTMA service is running at all
        try {
          const healthResponse = await fetch(`http://${toolboxData.public_ip_address}:30000/status`);
          console.log('DTMA health check:', healthResponse.status, await healthResponse.text());
        } catch (healthError) {
          console.error('DTMA health check failed:', healthError);
        }
        
        // Update status to starting
        await updateToolInstanceStatus(toolInstanceId, 'starting');
        
        // Make DTMA API call to start the container (URL encode the container name)
        const encodedContainerName = encodeURIComponent(instance.instance_name_on_toolbox);
        
        try {
          result = await callDTMA('POST', `/tools/${encodedContainerName}/start`, toolboxData.public_ip_address);
          console.log('DTMA start result:', result);
          
          // Update status to running
          await updateToolInstanceStatus(toolInstanceId, 'running');
          
        } catch (dtmaError: any) {
          console.error('DTMA start failed:', dtmaError);
          
          // If the container doesn't exist (404), try to re-deploy it
          if (dtmaError?.message?.includes('404')) {
            console.log('Container not found in DTMA, attempting re-deployment...');
            
            try {
              // Re-deploy the container to DTMA
              const redeployResult = await callDTMA('POST', '/tools', toolboxData.public_ip_address, {
                dockerImageUrl: instance.docker_image_url,
                instanceNameOnToolbox: instance.instance_name_on_toolbox,
                accountToolInstanceId: instance.id,
                baseConfigOverrideJson: {
                  Env: [],
                  HostConfig: {
                    PortBindings: {
                      "8080/tcp": [{ "HostPort": "30000" }]
                    }
                  }
                }
              });
              
              console.log('Re-deployment result:', redeployResult);
              
              // Now try to start the container again
              const startResult = await callDTMA('POST', `/tools/${encodedContainerName}/start`, toolboxData.public_ip_address);
              console.log('Start after re-deployment result:', startResult);
              
              await updateToolInstanceStatus(toolInstanceId, 'running');
              result = startResult;
              
            } catch (redeployError: any) {
              console.error('Re-deployment failed:', redeployError);
              await updateToolInstanceStatus(toolInstanceId, 'error');
              throw new Error(`Container not found in DTMA and re-deployment failed: ${redeployError?.message || 'Unknown error'}`);
            }
          } else {
            await updateToolInstanceStatus(toolInstanceId, 'error');
            throw dtmaError;
          }
        }
        
      } else if (action === 'stop') {
        console.log('Stopping tool instance via DTMA...');
        
        // Update status to stopping
        await updateToolInstanceStatus(toolInstanceId, 'stopping');
        
        try {
          // Make DTMA API call to stop the container (URL encode the container name)
          const encodedContainerName = encodeURIComponent(instance.instance_name_on_toolbox);
          result = await callDTMA('POST', `/tools/${encodedContainerName}/stop`, toolboxData.public_ip_address);
          console.log('DTMA stop result:', result);
          
          // Update status to stopped
          await updateToolInstanceStatus(toolInstanceId, 'stopped');
          
        } catch (dtmaError) {
          console.error('DTMA stop failed:', dtmaError);
          await updateToolInstanceStatus(toolInstanceId, 'error');
          throw dtmaError;
        }
        
      } else {
        return new Response(JSON.stringify({ 
          error: `Invalid action '${action}'. Must be 'start' or 'stop'.` 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        action, 
        instanceId: toolInstanceId,
        result 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Handle DELETE requests to remove a tool instance
    if (req.method === 'DELETE' && toolPathSegments.length === 1) {
      const toolInstanceId = toolPathSegments[0];

      console.log(`Handling DELETE action for tool instance: ${toolInstanceId}`);

      // Get tool instance details
      const { data: instance, error: instanceError } = await supabaseAdminClient
        .from('account_tool_instances')
        .select('*')
        .eq('id', toolInstanceId)
        .eq('account_tool_environment_id', toolboxId)
        .single();

      if (instanceError || !instance) {
        console.error('Tool instance not found:', { instanceError, toolInstanceId, toolboxId });
        return new Response(JSON.stringify({ 
          error: `Tool instance ${toolInstanceId} not found on toolbox ${toolboxId}` 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 404 
        });
      }

      console.log('Found tool instance for deletion:', instance.instance_name_on_toolbox);

      try {
        // Update status to pending_delete
        await updateToolInstanceStatus(toolInstanceId, 'pending_delete');
        
        // Try to remove from DTMA (URL encode the container name)
        const encodedContainerName = encodeURIComponent(instance.instance_name_on_toolbox);
        
        try {
          const deleteResult = await callDTMA('DELETE', `/tools/${encodedContainerName}`, toolboxData.public_ip_address);
          console.log('DTMA delete result:', deleteResult);
        } catch (dtmaError: any) {
          console.warn('DTMA delete failed (container may not exist):', dtmaError);
          // Continue with database cleanup even if DTMA delete fails
        }
        
        // Remove from database
        const { error: deleteError } = await supabaseAdminClient
          .from('account_tool_instances')
          .delete()
          .eq('id', toolInstanceId);

        if (deleteError) {
          throw new Error(`Failed to delete from database: ${deleteError.message}`);
        }

        console.log(`Tool instance ${toolInstanceId} deleted successfully`);

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Tool instance ${instance.instance_name_on_toolbox} deleted successfully`,
          instanceId: toolInstanceId
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

      } catch (error: any) {
        console.error('Delete operation failed:', error);
        await updateToolInstanceStatus(toolInstanceId, 'error');
        throw error;
      }
    }

    // Handle POST requests to deploy a new tool instance
    if (req.method === 'POST' && toolPathSegments.length === 0) {
      console.log('Handling tool deployment request...');
      
      const requestBody = await req.json() as any;
      const {
        toolCatalogId,
        instanceNameOnToolbox,
        baseConfigOverrideJson
      } = requestBody;

      if (!toolCatalogId || !instanceNameOnToolbox) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: toolCatalogId, instanceNameOnToolbox'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      try {
        console.log(`Deploying tool: ${instanceNameOnToolbox} to toolbox ${toolboxId}`);

        // Get tool catalog information
        const { data: toolCatalog, error: catalogError } = await supabaseAdminClient
          .from('tool_catalog')
          .select('*')
          .eq('id', toolCatalogId)
          .single();

        if (catalogError || !toolCatalog) {
          throw new Error(`Tool catalog ${toolCatalogId} not found: ${catalogError?.message}`);
        }

        // Use Docker image from baseConfig or fall back to tool catalog default
        const dockerImage = baseConfigOverrideJson?.dockerImage || 
                           toolCatalog.docker_image_url || 
                           'contextprotocol/context7-mcp-server:latest'; // Default for MCP servers

        // Create database record first
        const { data: toolInstance, error: createError } = await supabaseAdminClient
          .from('account_tool_instances')
          .insert({
            account_tool_environment_id: toolboxId,
            tool_catalog_id: toolCatalogId,
            instance_name_on_toolbox: instanceNameOnToolbox,
            docker_image_url: dockerImage,
            status_on_toolbox: 'deploying',
            mcp_server_type: 'mcp_server',
            mcp_transport_type: 'http',
            mcp_endpoint_path: '/mcp',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError || !toolInstance) {
          throw new Error(`Failed to create tool instance record: ${createError?.message}`);
        }

        console.log(`Created tool instance record: ${toolInstance.id}`);

        // Deploy to DTMA
        try {
          const deployResult = await callDTMA('POST', '/tools', toolboxData.public_ip_address, {
            dockerImageUrl: dockerImage,
            instanceNameOnToolbox: instanceNameOnToolbox,
            accountToolInstanceId: toolInstance.id,
            baseConfigOverrideJson: {
              Env: baseConfigOverrideJson?.environmentVariables ? 
                Object.entries(baseConfigOverrideJson.environmentVariables).map(([k, v]) => `${k}=${v}`) : [],
              HostConfig: {
                PortBindings: {
                  "8080/tcp": [{ "HostPort": "30000" }]
                }
              }
            }
          });

          console.log('DTMA deployment result:', deployResult);

          // Update status to active
          await updateToolInstanceStatus(toolInstance.id, 'active');

          return new Response(JSON.stringify({
            success: true,
            id: toolInstance.id,
            status: 'deploying',
            serverName: instanceNameOnToolbox,
            message: 'Tool deployment initiated successfully',
            data: deployResult
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (dtmaError: any) {
          console.error('DTMA deployment failed:', dtmaError);
          
          // Update database status to error
          await updateToolInstanceStatus(toolInstance.id, 'error');
          
          throw new Error(`DTMA deployment failed: ${dtmaError?.message || 'Unknown error'}`);
        }

      } catch (error: any) {
        console.error('Deployment failed:', error);
        return new Response(JSON.stringify({
          error: `Deployment failed: ${error?.message || 'Unknown error'}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Endpoint not implemented' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });

  } catch (e: unknown) {
    console.error('=== ERROR in toolbox-tools function ===');
    console.error('Error type:', typeof e);
    console.error('Error:', e);
    
    let errorMessage = 'Internal server error';
    if (e instanceof Error) {
      errorMessage = e.message;
      console.error('Error message:', e.message);
      console.error('Error stack:', e.stack);
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : String(e)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

console.log('=== toolbox-tools function script processed ==='); 