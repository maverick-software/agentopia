import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MCPDeploymentConfig,
  MCPDeploymentStatus,
  MCPServer
} from '../mcp/ui-types';
import { ToolInstanceService } from '../../integrations/_shared/services/ToolInstanceService';
import { ConnectionTest, EnhancedMCPServer } from './mcpService.types';
import { mapStatusToMCPStatus, testMCPCapabilities } from './mcpService.helpers';

interface AdminToolboxEnvironment {
  id: string;
  public_ip_address: string;
  status: string;
}

export async function testServerConnectionOperation(
  getServerById: (serverId: string) => Promise<EnhancedMCPServer | null>,
  serverId: string
): Promise<ConnectionTest> {
  const server = await getServerById(serverId);
  if (!server) {
    return {
      success: false,
      error: 'Server not found',
      timestamp: new Date()
    };
  }

  const status = mapStatusToMCPStatus(server.status.state, server.lastHeartbeat?.toISOString() || null);
  if (status.state !== 'running') {
    return {
      success: false,
      error: `Server is not running (status: ${status.state})`,
      timestamp: new Date()
    };
  }

  try {
    const startTime = Date.now();

    const response = await fetch(`${server.endpoint}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        latency,
        timestamp: new Date()
      };
    }

    const capabilities = await testMCPCapabilities(server.endpoint);

    return {
      success: true,
      latency,
      capabilities,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date()
    };
  }
}

export async function refreshServerStatusOperation(
  toolInstanceService: ToolInstanceService,
  getServerById: (serverId: string) => Promise<EnhancedMCPServer | null>,
  serverId: string
): Promise<EnhancedMCPServer> {
  const server = await getServerById(serverId);
  if (!server) {
    throw new Error('Server not found');
  }

  try {
    await toolInstanceService.refreshInstanceStatusFromDtma({
      userId: 'system',
      accountToolInstanceId: serverId,
      accountToolEnvironmentId: server.environment.id
    });

    const updatedServer = await getServerById(serverId);
    if (!updatedServer) {
      throw new Error('Server not found after refresh');
    }

    return updatedServer;
  } catch (error) {
    console.error(`Failed to refresh server status for ${serverId}:`, error);
    throw new Error(`Status refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deployServerOperation(
  supabase: SupabaseClient,
  toolInstanceService: ToolInstanceService,
  getAdminToolboxEnvironment: () => Promise<AdminToolboxEnvironment>,
  config: MCPDeploymentConfig
): Promise<MCPDeploymentStatus> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const adminToolbox = await getAdminToolboxEnvironment();

  const deployment = await toolInstanceService.deployToolToToolbox({
    userId: user.id,
    accountToolEnvironmentId: adminToolbox.id,
    toolCatalogId: '00000000-0000-0000-0000-000000000001',
    instanceNameOnToolbox: config.name,
    baseConfigOverrideJson: {
      dockerImage: 'default-mcp-server:latest',
      mcpTransport: 'stdio',
      mcpCapabilities: ['tools'],
      mcpEndpoint: '/mcp',
      mcpPort: 8080,
      templateId: config.templateId,
      environment: config.environment,
      resourceLimits: config.resourceLimits,
      configuration: config.configuration
    }
  });

  await supabase
    .from('account_tool_instances')
    .update({
      mcp_server_type: 'mcp_server',
      mcp_endpoint_path: config.configuration?.endpoint || '/mcp',
      mcp_transport_type: config.configuration?.transport || 'stdio',
      mcp_server_capabilities: config.configuration?.capabilities || [],
      mcp_discovery_metadata: {
        deployedAt: new Date().toISOString(),
        deploymentConfig: config,
        templateId: config.templateId,
        dtmaDeployment: true
      }
    })
    .eq('id', deployment.id);

  return {
    id: deployment.id.toString(),
    status: 'deploying',
    progress: 0,
    message: 'MCP server deployment initiated via DTMA',
    startedAt: new Date(),
    logs: [],
    endpoints: [
      {
        type: 'http',
        url: `http://${adminToolbox.public_ip_address}:8080/mcp`,
        status: 'active'
      }
    ]
  };
}

export async function updateServerOperation(
  supabase: SupabaseClient,
  getServer: (id: string) => Promise<MCPServer>,
  id: string,
  updates: Partial<MCPServer>
): Promise<MCPServer> {
  const { error } = await supabase
    .from('account_tool_instances')
    .update({
      instance_name_on_toolbox: updates.name,
      status_on_toolbox: updates.status?.state === 'running' ? 'active' : 'pending_install',
      mcp_endpoint_path: updates.endpoint_url,
      mcp_server_capabilities: updates.capabilities,
      updated_at: new Date().toISOString()
    })
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) throw error;
  return getServer(id);
}

export async function deleteServerOperation(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('account_tool_instances')
    .delete()
    .eq('id', parseInt(id));

  if (error) throw error;
}

export async function getDeploymentStatusOperation(
  getServer: (id: string) => Promise<MCPServer>,
  deploymentId: string
): Promise<MCPDeploymentStatus> {
  const server = await getServer(deploymentId);

  return {
    id: deploymentId,
    status: server.status.state === 'running' ? 'running' : 'failed',
    progress: server.status.state === 'running' ? 100 : 0,
    message: server.status.state === 'running' ? 'Deployment completed successfully' : 'Deployment failed',
    startedAt: server.status.lastStarted || new Date(),
    completedAt: server.status.state === 'running' ? new Date() : undefined,
    logs: [],
    endpoints: [
      {
        type: 'http',
        url: server.endpoint_url,
        status: server.status.state === 'running' ? 'active' : 'inactive'
      }
    ]
  };
}
