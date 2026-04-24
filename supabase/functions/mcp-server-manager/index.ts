// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, PUT, OPTIONS',
};

const logPrefix = '[mcp-server-manager]';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// DTMA Configuration
const DTMA_ENDPOINT = Deno.env.get('DTMA_ENDPOINT') || 'http://localhost:30000';
const DTMA_AUTH_TOKEN = Deno.env.get('DTMA_AUTH_TOKEN');

interface MCPServerDeploymentRequest {
  agentId: string;
  serverConfig: {
    dockerImageUrl: string;
    instanceNameOnToolbox: string;
    mcpServerType: string;
    mcpEndpointPath: string;
    mcpTransportType: 'stdio' | 'sse' | 'websocket';
    portBindings?: Record<string, string>;
    environmentVariables?: Record<string, string>;
    resourceLimits?: {
      memory?: string;
      cpu?: number;
    };
  };
  grantAccess?: boolean;
  permissionScope?: string;
}

interface MCPServerManagerResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Authenticate user and get user context
 */
async function authenticateUser(authHeader: string | null): Promise<{ userId: string; userRole: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error(`${logPrefix} Authentication failed:`, error);
      return null;
    }

    // Get user role from profiles or metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return {
      userId: user.id,
      userRole: profile?.role || 'user'
    };

  } catch (error) {
    console.error(`${logPrefix} Auth error:`, error);
    return null;
  }
}

/**
 * Deploy MCP server via DTMA
 */
async function deployMCPServer(deployment: MCPServerDeploymentRequest): Promise<MCPServerManagerResponse> {
  try {
    console.log(`${logPrefix} Deploying MCP server for agent ${deployment.agentId}`);

    // Create account_tool_instance record
    const { data: toolInstance, error: dbError } = await supabase
      .from('account_tool_instances')
      .insert({
        docker_image_url: deployment.serverConfig.dockerImageUrl,
        instance_name_on_toolbox: deployment.serverConfig.instanceNameOnToolbox,
        mcp_server_type: deployment.serverConfig.mcpServerType,
        mcp_endpoint_path: deployment.serverConfig.mcpEndpointPath,
        mcp_transport_type: deployment.serverConfig.mcpTransportType,
        mcp_server_capabilities: {},
        mcp_discovery_metadata: {},
        is_active: true,
        deployment_status: 'deploying'
      })
      .select()
      .single();

    if (dbError || !toolInstance) {
      console.error(`${logPrefix} Database error creating tool instance:`, dbError);
      return {
        success: false,
        message: 'Failed to create MCP server record',
        error: dbError?.message
      };
    }

    // Deploy to DTMA
    const dtmaResponse = await fetch(`${DTMA_ENDPOINT}/mcp/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DTMA_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        groupId: `agent-${deployment.agentId}-mcp`,
        servers: [{
          accountToolInstanceId: toolInstance.id,
          dockerImageUrl: deployment.serverConfig.dockerImageUrl,
          instanceNameOnToolbox: deployment.serverConfig.instanceNameOnToolbox,
          mcpEndpointPath: deployment.serverConfig.mcpEndpointPath,
          mcpTransportType: deployment.serverConfig.mcpTransportType,
          portBindings: deployment.serverConfig.portBindings,
          environmentVariables: deployment.serverConfig.environmentVariables,
          resourceLimits: deployment.serverConfig.resourceLimits
        }],
        options: {
          sharedNetworking: false,
          maxConcurrentDeployments: 1
        }
      })
    });

    if (!dtmaResponse.ok) {
      const errorText = await dtmaResponse.text();
      console.error(`${logPrefix} DTMA deployment failed:`, errorText);
      
      // Update database status
      await supabase
        .from('account_tool_instances')
        .update({ deployment_status: 'failed' })
        .eq('id', toolInstance.id);

      return {
        success: false,
        message: 'DTMA deployment failed',
        error: errorText
      };
    }

    const dtmaResult = await dtmaResponse.json();

    // Update database status
    await supabase
      .from('account_tool_instances')
      .update({ deployment_status: 'deployed' })
      .eq('id', toolInstance.id);

    // Grant agent access if requested
    if (deployment.grantAccess) {
      const { error: accessError } = await supabase.rpc('grant_agent_mcp_access', {
        p_agent_id: deployment.agentId,
        p_server_instance_id: toolInstance.id,
        p_permission_scope: deployment.permissionScope || 'full_access'
      });

      if (accessError) {
        console.warn(`${logPrefix} Failed to grant agent access:`, accessError);
      }
    }

    console.log(`${logPrefix} Successfully deployed MCP server ${toolInstance.id}`);
    return {
      success: true,
      message: 'MCP server deployed successfully',
      data: {
        instanceId: toolInstance.id,
        instanceName: deployment.serverConfig.instanceNameOnToolbox,
        dtmaResult: dtmaResult
      }
    };

  } catch (error) {
    console.error(`${logPrefix} Deployment error:`, error);
    return {
      success: false,
      message: 'Deployment failed',
      error: error.message
    };
  }
}

/**
 * Remove MCP server
 */
async function removeMCPServer(instanceId: string, agentId: string): Promise<MCPServerManagerResponse> {
  try {
    console.log(`${logPrefix} Removing MCP server ${instanceId} for agent ${agentId}`);

    // Get server details
    const { data: server, error: fetchError } = await supabase
      .from('account_tool_instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (fetchError || !server) {
      return {
        success: false,
        message: 'MCP server not found',
        error: fetchError?.message
      };
    }

    // Remove from DTMA
    const dtmaResponse = await fetch(`${DTMA_ENDPOINT}/mcp/groups/agent-${agentId}-mcp`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${DTMA_AUTH_TOKEN}`
      }
    });

    if (!dtmaResponse.ok) {
      const errorText = await dtmaResponse.text();
      console.error(`${logPrefix} DTMA removal failed:`, errorText);
    }

    // Remove agent access
    const { error: accessError } = await supabase.rpc('revoke_agent_mcp_access', {
      p_agent_id: agentId,
      p_server_instance_id: instanceId
    });

    if (accessError) {
      console.warn(`${logPrefix} Failed to revoke agent access:`, accessError);
    }

    // Update database status
    const { error: updateError } = await supabase
      .from('account_tool_instances')
      .update({ 
        is_active: false,
        deployment_status: 'removed'
      })
      .eq('id', instanceId);

    if (updateError) {
      console.error(`${logPrefix} Database update error:`, updateError);
    }

    console.log(`${logPrefix} Successfully removed MCP server ${instanceId}`);
    return {
      success: true,
      message: 'MCP server removed successfully'
    };

  } catch (error) {
    console.error(`${logPrefix} Removal error:`, error);
    return {
      success: false,
      message: 'Removal failed',
      error: error.message
    };
  }
}

/**
 * Get MCP server status
 */
async function getMCPServerStatus(agentId?: string): Promise<MCPServerManagerResponse> {
  try {
    console.log(`${logPrefix} Getting MCP server status${agentId ? ` for agent ${agentId}` : ''}`);

    let query = supabase
      .from('account_tool_instances')
      .select(`
        id,
        instance_name_on_toolbox,
        docker_image_url,
        mcp_server_type,
        mcp_transport_type,
        is_active,
        deployment_status,
        created_at,
        agent_mcp_server_access!inner(
          agent_id,
          granted_at,
          permission_scope
        )
      `)
      .not('mcp_server_type', 'is', null);

    if (agentId) {
      query = query.eq('agent_mcp_server_access.agent_id', agentId);
    }

    const { data: servers, error } = await query;

    if (error) {
      console.error(`${logPrefix} Error fetching server status:`, error);
      return {
        success: false,
        message: 'Failed to fetch server status',
        error: error.message
      };
    }

    // Get DTMA status for active servers
    const activeServers = servers?.filter(s => s.is_active) || [];
    let dtmaStatus = null;

    if (activeServers.length > 0) {
      try {
        const dtmaResponse = await fetch(`${DTMA_ENDPOINT}/mcp/status`, {
          headers: {
            'Authorization': `Bearer ${DTMA_AUTH_TOKEN}`
          }
        });

        if (dtmaResponse.ok) {
          dtmaStatus = await dtmaResponse.json();
        }
      } catch (error) {
        console.warn(`${logPrefix} Failed to get DTMA status:`, error);
      }
    }

    return {
      success: true,
      message: 'Server status retrieved successfully',
      data: {
        servers: servers || [],
        dtmaStatus: dtmaStatus
      }
    };

  } catch (error) {
    console.error(`${logPrefix} Status retrieval error:`, error);
    return {
      success: false,
      message: 'Status retrieval failed',
      error: error.message
    };
  }
}

/**
 * Manage agent MCP permissions
 */
async function manageAgentPermissions(
  action: 'grant' | 'revoke',
  agentId: string,
  serverInstanceId: string,
  permissionScope?: string
): Promise<MCPServerManagerResponse> {
  try {
    console.log(`${logPrefix} ${action === 'grant' ? 'Granting' : 'Revoking'} MCP access for agent ${agentId} to server ${serverInstanceId}`);

    if (action === 'grant') {
      const { error } = await supabase.rpc('grant_agent_mcp_access', {
        p_agent_id: agentId,
        p_server_instance_id: serverInstanceId,
        p_permission_scope: permissionScope || 'full_access'
      });

      if (error) {
        return {
          success: false,
          message: 'Failed to grant access',
          error: error.message
        };
      }

      return {
        success: true,
        message: 'Access granted successfully'
      };

    } else {
      const { error } = await supabase.rpc('revoke_agent_mcp_access', {
        p_agent_id: agentId,
        p_server_instance_id: serverInstanceId
      });

      if (error) {
        return {
          success: false,
          message: 'Failed to revoke access',
          error: error.message
        };
      }

      return {
        success: true,
        message: 'Access revoked successfully'
      };
    }

  } catch (error) {
    console.error(`${logPrefix} Permission management error:`, error);
    return {
      success: false,
      message: 'Permission management failed',
      error: error.message
    };
  }
}

serve(async (req) => {
  const requestUrl = new URL(req.url);
  console.log(`${logPrefix} Received request: ${req.method} ${requestUrl.pathname}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const userContext = await authenticateUser(req.headers.get('authorization'));
    if (!userContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    let result: MCPServerManagerResponse;

    // Route based on method and path
    if (req.method === 'POST' && requestUrl.pathname.endsWith('/deploy')) {
      const deployment: MCPServerDeploymentRequest = await req.json();
      result = await deployMCPServer(deployment);

    } else if (req.method === 'DELETE' && requestUrl.pathname.includes('/remove/')) {
      const pathParts = requestUrl.pathname.split('/');
      const instanceId = pathParts[pathParts.length - 1];
      const agentId = requestUrl.searchParams.get('agentId') || '';
      result = await removeMCPServer(instanceId, agentId);

    } else if (req.method === 'GET' && requestUrl.pathname.endsWith('/status')) {
      const agentId = requestUrl.searchParams.get('agentId') || undefined;
      result = await getMCPServerStatus(agentId);

    } else if (req.method === 'POST' && requestUrl.pathname.includes('/permissions/')) {
      const body = await req.json();
      const action = requestUrl.pathname.includes('/grant') ? 'grant' : 'revoke';
      result = await manageAgentPermissions(
        action,
        body.agentId,
        body.serverInstanceId,
        body.permissionScope
      );

    } else {
      result = {
        success: false,
        message: 'Endpoint not found',
        error: `Unknown endpoint: ${req.method} ${requestUrl.pathname}`
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    });

  } catch (error) {
    console.error(`${logPrefix} Request processing error:`, error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/* Usage Examples:

1. Deploy MCP Server:
POST /functions/v1/mcp-server-manager/deploy
{
  "agentId": "agent-123",
  "serverConfig": {
    "dockerImageUrl": "mcp/github-server:latest",
    "instanceNameOnToolbox": "github-mcp-1",
    "mcpServerType": "github",
    "mcpEndpointPath": "/mcp",
    "mcpTransportType": "sse",
    "portBindings": {"3000": "3000"}
  },
  "grantAccess": true,
  "permissionScope": "full_access"
}

2. Get Status:
GET /functions/v1/mcp-server-manager/status?agentId=agent-123

3. Remove Server:
DELETE /functions/v1/mcp-server-manager/remove/instance-456?agentId=agent-123

4. Grant Permissions:
POST /functions/v1/mcp-server-manager/permissions/grant
{
  "agentId": "agent-123",
  "serverInstanceId": "instance-456",
  "permissionScope": "read_only"
}

*/ 