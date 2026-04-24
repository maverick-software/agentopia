import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MCPDeploymentConfig,
  MCPDeploymentStatus,
  MCPServer,
  MCPServerTemplate
} from '../mcp/ui-types';
import { supabase } from '../supabase';
import { ToolInstanceService } from '../../integrations/_shared/services/ToolInstanceService';
import {
  buildServerEndpoint,
  mapStatusToMCPStatus,
  testMCPCapabilities,
  transformToEnhancedMCPServer
} from './mcpService.helpers';
import {
  deleteServerOperation,
  deployServerOperation,
  getDeploymentStatusOperation,
  refreshServerStatusOperation,
  testServerConnectionOperation,
  updateServerOperation
} from './mcpService.deploymentOperations';
import {
  getServerByIdOperation,
  getServersOperation,
  stripEnhancedServerToMCPServer
} from './mcpService.serverOperations';
import {
  createTemplateOperation,
  deleteTemplateOperation,
  getMarketplaceTemplatesOperation,
  updateTemplateVerificationOperation
} from './mcpService.templateOperations';
import type { ConnectionTest, EnhancedMCPServer, MCPServerStatus } from './mcpService.types';

export type { ConnectionTest, EnhancedMCPServer, MCPServerStatus } from './mcpService.types';

export class MCPService {
  protected supabase: SupabaseClient;
  protected toolInstanceService: ToolInstanceService;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || supabase;
    this.toolInstanceService = new ToolInstanceService(this.supabase);
  }

  protected async getAdminToolboxEnvironment() {
    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, public_ip_address, status')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('No active admin toolbox environment found for MCP server deployment');
    }

    return data;
  }

  protected buildServerEndpoint(publicIP: string, endpointPath: string = ''): string {
    return buildServerEndpoint(publicIP, endpointPath);
  }

  protected mapStatusToMCPStatus(dtmaStatus: string, lastHeartbeat: string | null): MCPServerStatus {
    return mapStatusToMCPStatus(dtmaStatus, lastHeartbeat);
  }

  protected transformToEnhancedMCPServer(record: any): EnhancedMCPServer {
    return transformToEnhancedMCPServer(record);
  }

  protected async testMCPCapabilities(endpoint: string): Promise<string[]> {
    return testMCPCapabilities(endpoint);
  }

  async getServers(): Promise<EnhancedMCPServer[]> {
    return getServersOperation(this.supabase);
  }

  async getServerById(serverId: string): Promise<EnhancedMCPServer | null> {
    return getServerByIdOperation(this.supabase, serverId);
  }

  async getServer(id: string): Promise<MCPServer> {
    const enhancedServer = await this.getServerById(id);
    if (!enhancedServer) {
      throw new Error(`MCP server with ID ${id} not found`);
    }
    return stripEnhancedServerToMCPServer(enhancedServer);
  }

  async testServerConnection(serverId: string): Promise<ConnectionTest> {
    return testServerConnectionOperation(this.getServerById.bind(this), serverId);
  }

  async refreshServerStatus(serverId: string): Promise<EnhancedMCPServer> {
    return refreshServerStatusOperation(this.toolInstanceService, this.getServerById.bind(this), serverId);
  }

  async deployServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
    return deployServerOperation(
      this.supabase,
      this.toolInstanceService,
      this.getAdminToolboxEnvironment.bind(this),
      config
    );
  }

  async updateServer(id: string, updates: Partial<MCPServer>): Promise<MCPServer> {
    return updateServerOperation(this.supabase, this.getServer.bind(this), id, updates);
  }

  async deleteServer(id: string): Promise<void> {
    return deleteServerOperation(this.supabase, id);
  }

  async getMarketplaceTemplates(): Promise<MCPServerTemplate[]> {
    return getMarketplaceTemplatesOperation(this.supabase);
  }

  async createTemplate(templateData: Partial<MCPServerTemplate>): Promise<MCPServerTemplate> {
    return createTemplateOperation(this.supabase, templateData);
  }

  async updateTemplateVerification(templateId: string, isVerified: boolean): Promise<void> {
    return updateTemplateVerificationOperation(this.supabase, templateId, isVerified);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return deleteTemplateOperation(this.supabase, templateId);
  }

  async getDeploymentStatus(deploymentId: string): Promise<MCPDeploymentStatus> {
    return getDeploymentStatusOperation(this.getServer.bind(this), deploymentId);
  }
}

export const mcpService = new MCPService();