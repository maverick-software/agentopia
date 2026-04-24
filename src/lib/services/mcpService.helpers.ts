import { EnhancedMCPServer, MCPServerStatus } from './mcpService.types';

export const MCP_SERVER_SELECT = `
  id,
  instance_name_on_toolbox,
  status_on_toolbox,
  last_heartbeat_from_dtma,
  created_at,
  updated_at,
  mcp_server_type,
  mcp_transport_type,
  mcp_endpoint_path,
  mcp_server_capabilities,
  mcp_discovery_metadata,
  account_tool_environment:account_tool_environments!inner(
    id,
    name,
    public_ip_address,
    region_slug,
    size_slug,
    user_id
  )
`;

export function buildServerEndpoint(publicIP: string, endpointPath: string = ''): string {
  if (!publicIP) {
    return 'http://pending-provisioning:30000';
  }

  const baseUrl = `http://${publicIP}:30000`;
  return endpointPath ? `${baseUrl}${endpointPath}` : baseUrl;
}

export function mapStatusToMCPStatus(dtmaStatus: string, lastHeartbeat: string | null): MCPServerStatus {
  const now = new Date();
  const heartbeatAge = lastHeartbeat
    ? (now.getTime() - new Date(lastHeartbeat).getTime()) / (1000 * 60)
    : null;

  let state: MCPServerStatus['state'];
  let health: MCPServerStatus['health'] = 'unknown';

  switch (dtmaStatus) {
    case 'running':
      state = 'running';
      health =
        heartbeatAge && heartbeatAge < 5
          ? 'healthy'
          : heartbeatAge && heartbeatAge < 15
            ? 'degraded'
            : 'unhealthy';
      break;
    case 'stopped':
    case 'exited':
      state = 'stopped';
      health = 'unknown';
      break;
    case 'starting_on_toolbox':
      state = 'starting';
      health = 'unknown';
      break;
    case 'stopping_on_toolbox':
      state = 'stopping';
      health = 'unknown';
      break;
    case 'error_starting':
    case 'error_stopping':
      state = 'error';
      health = 'unhealthy';
      break;
    default:
      state = 'unknown';
      health = 'unknown';
  }

  return {
    state,
    health,
    uptime:
      state === 'running' && lastHeartbeat
        ? Math.floor((now.getTime() - new Date(lastHeartbeat).getTime()) / 1000)
        : undefined,
    lastStarted: lastHeartbeat ? new Date(lastHeartbeat) : undefined,
    lastError: state === 'error' ? 'Container error - check DTMA logs' : undefined
  };
}

export function transformToEnhancedMCPServer(record: any): EnhancedMCPServer {
  const environment = record.account_tool_environment;
  const status = mapStatusToMCPStatus(record.status_on_toolbox, record.last_heartbeat_from_dtma);

  return {
    id: record.id,
    config_id: 0,
    name: record.instance_name_on_toolbox || `MCP Server ${record.id}`,
    endpoint_url: buildServerEndpoint(environment.public_ip_address, record.mcp_endpoint_path),
    vault_api_key_id: null,
    timeout_ms: 30000,
    max_retries: 3,
    retry_backoff_ms: 1000,
    priority: 1,
    is_active: status.state === 'running',
    capabilities: record.mcp_server_capabilities || null,
    status: {
      state: status.state === 'running' ? 'running' : 'stopped',
      uptime: status.uptime || 0,
      lastStarted: status.lastStarted || new Date(record.created_at)
    },
    health: {
      overall: status.health === 'healthy' ? 'healthy' : 'unhealthy',
      checks: {
        connectivity: status.state === 'running',
        responseTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      lastChecked: new Date()
    },
    serverType: record.mcp_server_type || 'generic',
    transport: record.mcp_transport_type || 'http',
    discoveryMetadata: record.mcp_discovery_metadata || {},
    environment: {
      id: environment.id,
      name: environment.name,
      publicIP: environment.public_ip_address,
      privateIP: '',
      region: environment.region_slug,
      size: environment.size_slug
    },
    endpoint: buildServerEndpoint(environment.public_ip_address, record.mcp_endpoint_path),
    lastHeartbeat: record.last_heartbeat_from_dtma ? new Date(record.last_heartbeat_from_dtma) : null
  };
}

export async function testMCPCapabilities(endpoint: string): Promise<string[]> {
  try {
    const response = await fetch(`${endpoint}/mcp/capabilities`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const data = await response.json();
      return data.capabilities || [];
    }
  } catch (error) {
    console.warn(
      'Could not fetch MCP capabilities:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  return [];
}
