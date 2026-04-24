import { SupabaseClient } from '@supabase/supabase-js';
import { ConnectionTest, EnhancedMCPServer, MCPService } from '../mcpService';
import {
  connectAgentToMCPServer,
  disconnectAgentFromMCPServer,
  getAgentMCPConnections,
  getAgentToolbelt,
  getAvailableMCPServers,
  getConnectionLogs,
  getConnectionStatus,
  getMCPServerCapabilities,
  getMCPServerDetails,
  getUserMCPDashboard,
  testMCPConnection,
  updateAgentMCPConnection,
} from './operations';
import {
  Agent,
  AgentMCPConnection,
  AgentToolbelt,
  ConnectionConfig,
  ConnectionStatus,
  UserMCPDashboard,
} from './types';

export type {
  AgentMCPConnection,
  ConnectionConfig,
  ConnectionUsageStats,
  ConnectionStatus,
  UserMCPDashboard,
  AgentToolbelt,
  Agent,
} from './types';

export class UserMCPService extends MCPService {
  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
  }

  async validateUserAccess(agentId: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    await this.validateAgentOwnership(agentId);
  }

  async validateAgentOwnership(agentId: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: agent, error } = await this.supabase.from('agents').select('user_id').eq('id', agentId).single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Agent not found');
      }
      throw new Error(`Failed to validate agent ownership: ${error.message}`);
    }

    if (agent.user_id !== user.id) {
      throw new Error('Agent access denied - not owned by user');
    }
  }

  async getUserAgents(): Promise<Agent[]> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await this.supabase
      .from('agents')
      .select('id, name, description, created_at')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch user agents: ${error.message}`);
    }

    return data || [];
  }

  async getAvailableMCPServers(): Promise<EnhancedMCPServer[]> {
    return getAvailableMCPServers(this);
  }

  async getMCPServerDetails(serverId: string): Promise<EnhancedMCPServer> {
    return getMCPServerDetails(this, serverId);
  }

  async getMCPServerCapabilities(serverId: string): Promise<string[]> {
    return getMCPServerCapabilities(this, serverId);
  }

  async connectAgentToMCPServer(
    agentId: string,
    mcpServerId: string,
    config?: ConnectionConfig
  ): Promise<AgentMCPConnection> {
    return connectAgentToMCPServer(this, agentId, mcpServerId, config);
  }

  async disconnectAgentFromMCPServer(agentId: string, mcpServerId: string): Promise<void> {
    return disconnectAgentFromMCPServer(this, agentId, mcpServerId);
  }

  async getAgentMCPConnections(agentId: string): Promise<AgentMCPConnection[]> {
    return getAgentMCPConnections(this, agentId);
  }

  async updateAgentMCPConnection(
    connectionId: string,
    updates: Partial<AgentMCPConnection>
  ): Promise<AgentMCPConnection> {
    return updateAgentMCPConnection(this, connectionId, updates);
  }

  async getConnectionStatus(connectionId: string): Promise<ConnectionStatus> {
    return getConnectionStatus(this, connectionId);
  }

  async testMCPConnection(agentId: string, mcpServerId: string): Promise<ConnectionTest> {
    return testMCPConnection(this, agentId, mcpServerId);
  }

  async getConnectionLogs(connectionId: string, lines: number = 100): Promise<string[]> {
    return getConnectionLogs(this, connectionId, lines);
  }

  async getUserMCPDashboard(): Promise<UserMCPDashboard> {
    return getUserMCPDashboard(this);
  }

  async getAgentToolbelt(agentId: string): Promise<AgentToolbelt> {
    return getAgentToolbelt(this, agentId);
  }
}
