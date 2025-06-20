import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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

interface ToolInstanceRecord {
  id: string;
  instance_name_on_toolbox: string;
  status_on_toolbox: string;
  container_id?: string;
  image?: string;
  version?: string;
  created_at: string;
  updated_at: string;
}

interface DTMAToolInstance {
  account_tool_instance_id: string | null;
  instance_name_on_toolbox: string;
  container_id: string;
  status: string;
  image: string;
  ports: Array<{
    ip?: string;
    private_port: number;
    public_port?: number;
    type: string;
  }>;
  created: number;
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
    if (req.method === 'GET') {
      return await handleListToolInstances(toolboxData);
    } else if (req.method === 'POST') {
      const body = await req.json();
      const { action, instanceId } = body;

      switch (action) {
        case 'start':
          return await handleStartToolInstance(toolboxData, instanceId);
        case 'stop':
          return await handleStopToolInstance(toolboxData, instanceId);
        case 'restart':
          return await handleRestartToolInstance(toolboxData, instanceId);
        case 'logs':
          return await handleGetToolInstanceLogs(toolboxData, instanceId);
        case 'delete':
          return await handleDeleteToolInstance(toolboxData, instanceId);
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
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

async function handleListToolInstances(toolbox: any) {
  try {
    if (!toolbox.public_ip_address) {
      return new Response(
        JSON.stringify({ 
          success: true,
          tool_instances: [],
          message: 'Toolbox not ready - no IP address assigned'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Try to get tool instances from DTMA service
    const dtmaUrl = `http://${toolbox.public_ip_address}:30000/status`;
    
    try {
      const dtmaResponse = await fetch(dtmaUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (dtmaResponse.ok) {
        const dtmaData = await dtmaResponse.json();
        const toolInstances = dtmaData.tool_instances || [];

        // Convert DTMA tool instances to our expected format
        const formattedInstances: ToolInstanceRecord[] = toolInstances.map((instance: DTMAToolInstance) => ({
          id: instance.container_id,
          instance_name_on_toolbox: instance.instance_name_on_toolbox,
          status_on_toolbox: instance.status,
          container_id: instance.container_id,
          image: instance.image,
          version: 'unknown',
          created_at: new Date(instance.created * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }));

        return new Response(
          JSON.stringify({ 
            success: true,
            tool_instances: formattedInstances,
            dtma_connected: true,
            last_checked: new Date().toISOString()
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } else {
        throw new Error(`DTMA responded with ${dtmaResponse.status}`);
      }
    } catch (dtmaError) {
      // DTMA not available, return empty list with connection status
      console.warn('DTMA not available:', dtmaError.message);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          tool_instances: [],
          dtma_connected: false,
          connection_error: dtmaError.message,
          last_checked: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error listing tool instances:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        tool_instances: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleStartToolInstance(toolbox: any, instanceId: string) {
  return await handleToolInstanceAction(toolbox, instanceId, 'start');
}

async function handleStopToolInstance(toolbox: any, instanceId: string) {
  return await handleToolInstanceAction(toolbox, instanceId, 'stop');
}

async function handleRestartToolInstance(toolbox: any, instanceId: string) {
  return await handleToolInstanceAction(toolbox, instanceId, 'restart');
}

async function handleDeleteToolInstance(toolbox: any, instanceId: string) {
  return await handleToolInstanceAction(toolbox, instanceId, 'delete');
}

async function handleToolInstanceAction(toolbox: any, instanceId: string, action: string) {
  try {
    if (!toolbox.public_ip_address) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Toolbox not ready - no IP address assigned'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, return a placeholder response indicating the action would be performed
    // In Phase 2, this will be replaced with actual SSH/DTMA communication
    console.log(`Tool instance action: ${action} on ${instanceId} for toolbox ${toolbox.id}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Tool instance ${action} action acknowledged`,
        instanceId,
        action,
        timestamp: new Date().toISOString(),
        note: 'Action queued - SSH implementation pending in Phase 2'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error(`Error performing ${action} on tool instance:`, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        instanceId,
        action
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleGetToolInstanceLogs(toolbox: any, instanceId: string) {
  try {
    if (!toolbox.public_ip_address) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Toolbox not ready - no IP address assigned'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, return placeholder logs
    // In Phase 2, this will fetch actual container logs via SSH/DTMA
    const placeholderLogs = [
      `${new Date().toISOString()} - Container ${instanceId} started`,
      `${new Date().toISOString()} - Application initialized`,
      `${new Date().toISOString()} - Ready to accept connections`,
    ];

    return new Response(
      JSON.stringify({ 
        success: true,
        logs: placeholderLogs,
        instanceId,
        timestamp: new Date().toISOString(),
        note: 'Placeholder logs - Real log fetching pending SSH implementation'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error getting tool instance logs:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        instanceId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

console.log('=== toolbox-tools function script processed ==='); 