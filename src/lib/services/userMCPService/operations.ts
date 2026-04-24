import { ConnectionTest, EnhancedMCPServer } from '../mcpService';
import { AgentMCPConnection, AgentToolbelt, ConnectionConfig, ConnectionStatus, UserMCPDashboard } from './types';
interface UserMCPContext {
  supabase: any;
  validateUserAccess(agentId: string): Promise<void>;
  getMCPServerDetails(serverId: string): Promise<EnhancedMCPServer>;
  getAvailableMCPServers(): Promise<EnhancedMCPServer[]>;
  getAgentMCPConnections(agentId: string): Promise<AgentMCPConnection[]>;
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>;
  transformToEnhancedMCPServer(record: any): EnhancedMCPServer;
  mapStatusToMCPStatus(dtmaStatus: string, lastHeartbeat: string | null): any;
  testMCPCapabilities(endpoint: string): Promise<string[]>;
}

export async function getAvailableMCPServers(ctx: UserMCPContext): Promise<EnhancedMCPServer[]> {
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const { data, error } = await ctx.supabase
      .from('account_tool_instances')
      .select(
        `
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
        `
      )
      .not('mcp_server_type', 'is', null)
      .eq('status_on_toolbox', 'running')
      .order('instance_name_on_toolbox');

    if (error) {
      throw new Error(`Failed to fetch available MCP servers: ${error.message}`);
    }

    return (data || []).map(ctx.transformToEnhancedMCPServer.bind(ctx));
  } catch (error) {
    console.error('Error in getAvailableMCPServers:', error);
    throw error instanceof Error ? error : new Error('Unknown error in getAvailableMCPServers');
  }
}

export async function getMCPServerDetails(ctx: UserMCPContext, serverId: string): Promise<EnhancedMCPServer> {
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await ctx.supabase
    .from('account_tool_instances')
    .select(
      `
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
      `
    )
    .eq('id', serverId)
    .not('mcp_server_type', 'is', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('MCP server not found');
    }
    throw new Error(`Failed to fetch MCP server details: ${error.message}`);
  }

  return ctx.transformToEnhancedMCPServer(data);
}

export async function getMCPServerCapabilities(ctx: UserMCPContext, serverId: string): Promise<string[]> {
  const server = await getMCPServerDetails(ctx, serverId);
  if (server.status.state === 'running') {
    try {
      const capabilities = await ctx.testMCPCapabilities(server.endpoint);
      return capabilities.length > 0 ? capabilities : server.capabilities;
    } catch (error) {
      console.warn('Could not fetch live capabilities, using stored ones:', error);
    }
  }

  return server.capabilities;
}
export async function connectAgentToMCPServer(
  ctx: UserMCPContext,
  agentId: string,
  mcpServerId: string,
  config?: ConnectionConfig
): Promise<AgentMCPConnection> {
  await ctx.validateUserAccess(agentId);

  const mcpServer = await getMCPServerDetails(ctx, mcpServerId);
  if (!mcpServer || mcpServer.status.state !== 'running') {
    throw new Error('MCP server not available for connections');
  }

  const connectionConfig = buildConnectionConfig(mcpServer, config);
  const testResult = await testMCPConnection(ctx, agentId, mcpServerId);
  if (!testResult.success) {
    throw new Error(`Connection test failed: ${testResult.error}`);
  }

  const { data, error } = await ctx.supabase
    .from('agent_mcp_connections')
    .insert({
      agent_id: agentId,
      mcp_server_instance_id: mcpServerId,
      connection_config: connectionConfig,
      is_active: true,
      connection_test_result: testResult,
    })
    .select(
      `
        *,
        agent:agents(id, name),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          mcp_server_capabilities,
          account_tool_environment:account_tool_environments(
            public_ip_address,
            name
          )
        )
      `
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Agent is already connected to this MCP server');
    }
    throw new Error(`Failed to create connection: ${error.message}`);
  }

  await logConnectionEvent(ctx, data.id, 'connected', 'User initiated connection');
  return transformToAgentMCPConnection(data);
}

export async function disconnectAgentFromMCPServer(
  ctx: UserMCPContext,
  agentId: string,
  mcpServerId: string
): Promise<void> {
  await ctx.validateUserAccess(agentId);

  const { data: connection, error: findError } = await ctx.supabase
    .from('agent_mcp_connections')
    .select('id, agent:agents(name), mcp_server:account_tool_instances(instance_name_on_toolbox)')
    .eq('agent_id', agentId)
    .eq('mcp_server_instance_id', mcpServerId)
    .eq('is_active', true)
    .single();

  if (findError) {
    if (findError.code === 'PGRST116') {
      throw new Error('Connection not found');
    }
    throw new Error(`Failed to find connection: ${findError.message}`);
  }

  const { error: updateError } = await ctx.supabase
    .from('agent_mcp_connections')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  if (updateError) {
    throw new Error(`Failed to disconnect: ${updateError.message}`);
  }

  await logConnectionEvent(ctx, connection.id, 'disconnected', 'User initiated disconnection');
}
export async function getAgentMCPConnections(
  ctx: UserMCPContext,
  agentId: string
): Promise<AgentMCPConnection[]> {
  await ctx.validateUserAccess(agentId);

  const { data, error } = await ctx.supabase
    .from('agent_mcp_connections')
    .select(
      `
        *,
        agent:agents(id, name),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          mcp_server_capabilities,
          account_tool_environment:account_tool_environments(
            public_ip_address,
            name
          )
        )
      `
    )
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch agent connections: ${error.message}`);
  }

  return (data || []).map(transformToAgentMCPConnection);
}

export async function updateAgentMCPConnection(
  ctx: UserMCPContext,
  connectionId: string,
  updates: Partial<AgentMCPConnection>
): Promise<AgentMCPConnection> {
  const { data: connection, error: findError } = await ctx.supabase
    .from('agent_mcp_connections')
    .select('agent_id')
    .eq('id', connectionId)
    .single();

  if (findError) {
    throw new Error('Connection not found');
  }

  await ctx.validateUserAccess(connection.agent_id);

  const { data, error } = await ctx.supabase
    .from('agent_mcp_connections')
    .update({
      connection_config: updates.connectionConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
    .select(
      `
        *,
        agent:agents(id, name),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          mcp_server_capabilities
        )
      `
    )
    .single();

  if (error) {
    throw new Error(`Failed to update connection: ${error.message}`);
  }

  return transformToAgentMCPConnection(data);
}
export async function getConnectionStatus(ctx: UserMCPContext, connectionId: string): Promise<ConnectionStatus> {
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: connection, error } = await ctx.supabase
    .from('agent_mcp_connections')
    .select(
      `
        *,
        agent:agents!inner(id, name, user_id),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          account_tool_environment:account_tool_environments(
            public_ip_address
          )
        )
      `
    )
    .eq('id', connectionId)
    .eq('agent.user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Connection not found');
    }
    throw new Error(`Failed to fetch connection status: ${error.message}`);
  }

  const mcpServer = connection.mcp_server;
  const serverStatus = ctx.mapStatusToMCPStatus(mcpServer.status_on_toolbox, mcpServer.last_heartbeat_from_dtma);

  return {
    connectionId,
    status: connection.is_active && serverStatus.state === 'running' ? 'connected' : 'disconnected',
    serverStatus: serverStatus.state,
    health: serverStatus.health,
    lastChecked: new Date(),
    uptime: serverStatus.uptime,
    error: serverStatus.lastError,
  };
}
export async function testMCPConnection(
  ctx: UserMCPContext,
  agentId: string,
  mcpServerId: string
): Promise<ConnectionTest> {
  await ctx.validateUserAccess(agentId);
  const mcpServer = await getMCPServerDetails(ctx, mcpServerId);

  try {
    const connectionUrl = mcpServer.endpoint;
    const response = await fetch(`${connectionUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date(),
      };
    }

    const capabilities = await ctx.testMCPCapabilities(connectionUrl);
    return { success: true, capabilities, timestamp: new Date() };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
  }
}
export async function getConnectionLogs(
  ctx: UserMCPContext,
  connectionId: string,
  lines: number = 100
): Promise<string[]> {
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: connection, error } = await ctx.supabase
    .from('agent_mcp_connections')
    .select(
      `
        *,
        agent:agents!inner(user_id),
        mcp_server:account_tool_instances(
          account_tool_environment:account_tool_environments(
            name,
            public_ip_address
          )
        )
      `
    )
    .eq('id', connectionId)
    .eq('agent.user_id', user.id)
    .single();

  if (error) {
    throw new Error('Connection not found or access denied');
  }

  try {
    const environment = connection.mcp_server.account_tool_environment;
    const logs = await (ctx as any).getMCPServerLogs(environment.name, lines);
    return logs;
  } catch (error) {
    console.error('Error fetching connection logs:', error);
    return [`Error fetching logs: ${error instanceof Error ? error.message : 'Unknown error'}`];
  }
}
export async function getUserMCPDashboard(ctx: UserMCPContext): Promise<UserMCPDashboard> {
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const { data: agentConnections, error } = await ctx.supabase
      .from('agent_mcp_connections')
      .select(
        `
          *,
          agent:agents!inner(
            id,
            name,
            user_id
          ),
          mcp_server:account_tool_instances(
            id,
            instance_name_on_toolbox,
            status_on_toolbox,
            mcp_server_capabilities
          )
        `
      )
      .eq('agent.user_id', user.id)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to fetch connections: ${error.message}`);

    const availableServers = await getAvailableMCPServers(ctx);
    const connections = (agentConnections || []).map(transformToAgentMCPConnection);
    const connectedAgents = new Set(connections.map((c) => c.agentId)).size;
    const activeConnections = connections.filter((c) => c.mcpServer?.status === 'running').length;

    return {
      connectedAgents,
      availableServers: availableServers.length,
      activeConnections,
      totalRequests: 0,
      connections,
      availableServers,
      lastUpdated: new Date(),
    };
  } catch (error) {
    throw new Error(`Failed to get user dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getAgentToolbelt(ctx: UserMCPContext, agentId: string): Promise<AgentToolbelt> {
  await ctx.validateUserAccess(agentId);

  const { data: agent, error: agentError } = await ctx.supabase
    .from('agents')
    .select('id, name')
    .eq('id', agentId)
    .single();

  if (agentError) {
    throw new Error(`Failed to fetch agent: ${agentError.message}`);
  }

  const connections = await getAgentMCPConnections(ctx, agentId);
  const availableCapabilities = Array.from(new Set(connections.flatMap((conn) => conn.mcpServer?.capabilities || [])));

  const connectionHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
  for (const connection of connections) {
    try {
      const status = await getConnectionStatus(ctx, connection.id);
      connectionHealth[connection.id] = status.health;
    } catch (_error) {
      connectionHealth[connection.id] = 'unhealthy';
    }
  }

  return {
    agentId,
    agentName: agent.name,
    mcpConnections: connections,
    availableCapabilities,
    connectionHealth,
    lastUpdated: new Date(),
  };
}

function buildConnectionConfig(mcpServer: EnhancedMCPServer, customConfig?: ConnectionConfig): ConnectionConfig {
  return {
    timeout: customConfig?.timeout || 30000,
    retryAttempts: customConfig?.retryAttempts || 3,
    customHeaders: customConfig?.customHeaders || {},
    enableLogging: customConfig?.enableLogging || false,
    maxConcurrentRequests: customConfig?.maxConcurrentRequests || 10,
  };
}

async function logConnectionEvent(
  ctx: UserMCPContext,
  connectionId: string,
  event: string,
  details?: string
): Promise<void> {
  try {
    await ctx.supabase.from('agent_mcp_connection_logs').insert({
      connection_id: connectionId,
      event_type: event,
      event_details: details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log connection event:', error);
  }
}

function transformToAgentMCPConnection(data: any): AgentMCPConnection {
  return {
    id: data.id,
    agentId: data.agent_id,
    mcpServerInstanceId: data.mcp_server_instance_id,
    connectionConfig: data.connection_config || {},
    isActive: data.is_active,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    lastUsed: data.last_used ? new Date(data.last_used) : undefined,
    usageStats: data.usage_stats,
    agent: data.agent
      ? {
          id: data.agent.id,
          name: data.agent.name,
        }
      : undefined,
    mcpServer: data.mcp_server
      ? {
          id: data.mcp_server.id,
          name: data.mcp_server.instance_name_on_toolbox,
          capabilities: data.mcp_server.mcp_server_capabilities || [],
          status: data.mcp_server.status_on_toolbox,
        }
      : undefined,
  };
}
