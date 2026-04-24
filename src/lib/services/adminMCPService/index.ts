import { SupabaseClient } from '@supabase/supabase-js';
import { IntelligentDropletSelector } from '../intelligentDropletSelector';
import { EnhancedMCPServer, MCPService } from '../mcpService';
import { deployMCPServer, ensureToolCatalogEntry, oneClickDeploy } from './deployment';
import {
  AdminDashboardStats,
  AdminOperationLog,
  LogFilters,
  MCPServerDeployment,
  MCPServerDeploymentConfig,
  ServerMetrics,
  ToolboxEnvironment,
} from './types';

export type {
  MCPServerDeploymentConfig,
  MCPServerDeployment,
  AdminOperationLog,
  ServerMetrics,
  AdminDashboardStats,
  LogFilters,
  ToolboxEnvironment,
};

export class AdminMCPService extends MCPService {
  protected intelligentDropletSelector: IntelligentDropletSelector;

  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
    this.intelligentDropletSelector = new IntelligentDropletSelector();
  }

  async validateAdminAccess(): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const isAdmin = await this.isUserAdmin(user.id);
    if (!isAdmin) {
      throw new Error('Admin access required');
    }
  }

  async isUserAdmin(userId?: string): Promise<boolean> {
    const targetUserId = userId || (await this.supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) {
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select(
          `
          roles!inner (
            name
          )
        `
        )
        .eq('user_id', targetUserId)
        .eq('roles.name', 'admin')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in isUserAdmin:', error);
      return false;
    }
  }

  async deployMCPServer(config: MCPServerDeploymentConfig): Promise<MCPServerDeployment> {
    return deployMCPServer(this, config);
  }

  async oneClickDeploy(templateId: string): Promise<MCPServerDeployment> {
    return oneClickDeploy(this, templateId);
  }

  async startMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();

    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const startUrl = `toolbox-tools/${server.environment.id}/tools/${serverId}/start`;
      const { error: startError } = await this.supabase.functions.invoke(startUrl, {
        method: 'POST',
      });

      if (startError) {
        throw new Error(`Failed to start server via Edge Function: ${startError.message}`);
      }

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user.id,
        operation: 'start',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user?.id || 'unknown',
        operation: 'start',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();

    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const stopUrl = `toolbox-tools/${server.environment.id}/tools/${serverId}/stop`;
      const { error: stopError } = await this.supabase.functions.invoke(stopUrl, {
        method: 'POST',
      });

      if (stopError) {
        throw new Error(`Failed to stop server via Edge Function: ${stopError.message}`);
      }

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user.id,
        operation: 'stop',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user?.id || 'unknown',
        operation: 'stop',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async restartMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();

    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      await this.stopMCPServer(serverId);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.startMCPServer(serverId);

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'restart',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'restart',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to restart server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();

    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      if (server.status.state === 'running') {
        await this.stopMCPServer(serverId);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const deleteUrl = `toolbox-tools/${server.environment.id}/tools/${serverId}`;
      const { error: deleteError } = await this.supabase.functions.invoke(deleteUrl, {
        method: 'DELETE',
      });

      if (deleteError) {
        throw new Error(`Failed to delete server via Edge Function: ${deleteError.message}`);
      }

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'delete',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true,
      });
    } catch (error) {
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'delete',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to delete server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllMCPServers(): Promise<EnhancedMCPServer[]> {
    await this.validateAdminAccess();

    try {
      const { data, error } = await this.supabase
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
          account_tool_environment:account_tool_environments(
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
        .order('instance_name_on_toolbox');

      if (error) {
        throw new Error(`Failed to fetch MCP servers: ${error.message}`);
      }

      return (data || []).map(this.transformToEnhancedMCPServer.bind(this));
    } catch (error) {
      console.error('Error in getAllMCPServers:', error);
      throw error instanceof Error ? error : new Error('Unknown error in getAllMCPServers');
    }
  }

  async getMCPServerLogs(serverId: string, lines: number = 100): Promise<string[]> {
    await this.validateAdminAccess();

    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      const response = await fetch(`http://${server.environment.publicIP}:3000/api/logs/${serverId}?lines=${lines}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const logs = await response.text();
      return logs.split('\n').filter((line: string) => line.trim());
    } catch (error) {
      throw new Error(`Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    await this.validateAdminAccess();

    try {
      let totalServers = 0;
      let runningServers = 0;
      let stoppedServers = 0;
      let errorServers = 0;

      try {
        const servers = await this.getAllMCPServers();
        totalServers = servers.length;
        runningServers = servers.filter((s) => s.status.state === 'running').length;
        stoppedServers = servers.filter((s) => s.status.state === 'stopped').length;
        errorServers = servers.filter((s) => s.status.state === 'error').length;
      } catch (serverError) {
        console.warn(
          'Could not fetch deployed servers for stats (likely due to missing IP addresses):',
          serverError
        );

        const { data: instances, error: instanceError } = await this.supabase
          .from('account_tool_instances')
          .select('id, status_on_toolbox')
          .not('mcp_server_type', 'is', null);

        if (!instanceError && instances) {
          totalServers = instances.length;
          runningServers = instances.filter((i) => i.status_on_toolbox === 'running').length;
          stoppedServers = instances.filter((i) => ['stopped', 'exited'].includes(i.status_on_toolbox)).length;
          errorServers = instances.filter((i) =>
            ['error_starting', 'error_stopping'].includes(i.status_on_toolbox)
          ).length;
        }
      }

      const { data: connections } = await this.supabase
        .from('agent_mcp_connections')
        .select('id, is_active')
        .eq('is_active', true);

      const activeConnections = connections?.length || 0;

      return {
        totalServers,
        runningServers,
        stoppedServers,
        errorServers,
        totalConnections: activeConnections,
        activeConnections,
        totalRequests: 0,
        averageResponseTime: 0,
        lastUpdated: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async logAdminOperation(operation: AdminOperationLog): Promise<void> {
    try {
      const { error } = await this.supabase.from('admin_operation_logs').insert({
        id: operation.id,
        admin_user_id: operation.adminUserId,
        operation: operation.operation,
        server_id: operation.serverId,
        server_name: operation.serverName,
        timestamp: operation.timestamp.toISOString(),
        success: operation.success,
        error: operation.error,
        metadata: operation.metadata,
      });

      if (error) {
        console.error('Failed to log admin operation:', error);
      }
    } catch (error) {
      console.error('Error in logAdminOperation:', error);
    }
  }

  async getAdminOperationLogs(filters?: LogFilters): Promise<AdminOperationLog[]> {
    await this.validateAdminAccess();

    try {
      let query = this.supabase.from('admin_operation_logs').select('*').order('timestamp', { ascending: false });

      if (filters) {
        if (filters.operation) query = query.eq('operation', filters.operation);
        if (filters.serverId) query = query.eq('server_id', filters.serverId);
        if (filters.adminUserId) query = query.eq('admin_user_id', filters.adminUserId);
        if (filters.success !== undefined) query = query.eq('success', filters.success);
        if (filters.startDate) query = query.gte('timestamp', filters.startDate.toISOString());
        if (filters.endDate) query = query.lte('timestamp', filters.endDate.toISOString());
        if (filters.limit) query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch operation logs: ${error.message}`);
      }

      return (data || []).map((log) => ({
        id: log.id,
        adminUserId: log.admin_user_id,
        operation: log.operation,
        serverId: log.server_id,
        serverName: log.server_name,
        timestamp: new Date(log.timestamp),
        success: log.success,
        error: log.error,
        metadata: log.metadata,
      }));
    } catch (error) {
      throw new Error(`Failed to get operation logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async getAdminToolboxEnvironment(): Promise<{ id: any; public_ip_address: any; status: any }> {
    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, name, public_ip_address, status')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('No active admin toolbox environment found for MCP server deployment');
    }

    return {
      id: data.id,
      public_ip_address: data.public_ip_address,
      status: data.status,
    };
  }

  async getAvailableDroplets(): Promise<ToolboxEnvironment[]> {
    await this.validateAdminAccess();

    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, name, public_ip_address, status, region_slug, size_slug, user_id')
      .eq('status', 'active')
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch available droplets: ${error.message}`);
    }

    return (data || []).map((env) => ({
      id: env.id,
      name: env.name,
      publicIP: env.public_ip_address,
      status: env.status,
      region: env.region_slug,
      size: env.size_slug,
      userId: env.user_id,
    }));
  }

  private async ensureToolCatalogEntry(templateId: string, dockerImage: string): Promise<string> {
    return ensureToolCatalogEntry(this, templateId, dockerImage);
  }
}
