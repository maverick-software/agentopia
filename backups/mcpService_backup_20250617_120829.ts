// src/lib/services/mcpService.ts
// Real MCP Server management service connected to Supabase with DTMA integration

import { supabase } from '../supabase';
import { MCPServer, MCPServerTemplate, MCPDeploymentConfig, MCPDeploymentStatus } from '../mcp/ui-types';
import { ToolInstanceService } from '../../services/tool_instance_service/manager';
import type { SupabaseClient } from '@supabase/supabase-js';

export class MCPService {
  protected toolInstanceService: ToolInstanceService;

  constructor(supabaseClient?: SupabaseClient) {
    this.toolInstanceService = new ToolInstanceService(supabaseClient || supabase);
  }

  /**
   * Get admin toolbox environment for MCP server deployment
   */
  protected async getAdminToolboxEnvironment() {
    // For now, get the first available admin environment
    // In production, this should be a dedicated admin environment
    const { data, error } = await supabase
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

  /**
   * Get all MCP server instances for the current user
   */
  async getServers(): Promise<MCPServer[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Query account_tool_instances with MCP server details
      const { data, error } = await supabase
        .from('account_tool_instances')
        .select(`
          id,
          account_tool_environment_id,
          tool_catalog_id,
          status_on_toolbox,
          instance_name_on_toolbox,
          created_at,
          updated_at,
          mcp_server_type,
          mcp_endpoint_path,
          mcp_transport_type,
          mcp_server_capabilities,
          mcp_discovery_metadata,
          account_tool_environment:account_tool_environments!inner(
            id,
            user_id,
            name
          )
        `)
        .eq('account_tool_environment.user_id', user.id)
        .not('mcp_server_type', 'is', null) // Only get instances that are MCP servers
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to MCPServer format
      const servers: MCPServer[] = (data || []).map(instance => ({
        // MCPServerConfig fields
        id: parseInt(instance.id) || 0,
        config_id: 0, // No config table yet
        name: instance.instance_name_on_toolbox || `MCP Server ${instance.id}`,
        endpoint_url: instance.mcp_endpoint_path || '',
        vault_api_key_id: null,
        timeout_ms: 30000,
        max_retries: 3,
        retry_backoff_ms: 1000,
        priority: 1,
        is_active: instance.status_on_toolbox === 'active',
        capabilities: instance.mcp_server_capabilities || null,
        
        // MCPServer additional fields
        status: {
          state: instance.status_on_toolbox === 'active' ? 'running' : 'stopped',
          uptime: instance.status_on_toolbox === 'active' ? Math.floor((Date.now() - new Date(instance.created_at).getTime()) / 1000) : 0,
          lastStarted: new Date(instance.created_at)
        },
        health: {
          overall: instance.status_on_toolbox === 'active' ? 'healthy' : 'unhealthy',
          checks: {
            connectivity: instance.status_on_toolbox === 'active',
            responseTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            cpuUsage: 0
          },
          lastChecked: new Date()
        }
      }));

      return servers;
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      throw error;
    }
  }

  /**
   * Get a specific MCP server by ID
   */
  async getServer(id: string): Promise<MCPServer> {
    try {
      const servers = await this.getServers();
      const server = servers.find(s => s.id.toString() === id);
      
      if (!server) {
        throw new Error(`MCP server with ID ${id} not found`);
      }

      return server;
    } catch (error) {
      console.error(`Error fetching MCP server ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create/Deploy a new MCP server
   * Now integrates with DTMA infrastructure for actual deployment
   */
  async deployServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get admin toolbox environment for MCP server deployment
      const adminToolbox = await this.getAdminToolboxEnvironment();

             // Deploy via ToolInstanceService (routes to DTMA)
       const deployment = await this.toolInstanceService.deployToolToToolbox({
         userId: user.id, // Current user (admin in this case)
         accountToolEnvironmentId: adminToolbox.id,
         toolCatalogId: '00000000-0000-0000-0000-000000000001', // Generic MCP Server
         instanceNameOnToolbox: config.name,
         baseConfigOverrideJson: {
           dockerImage: 'default-mcp-server:latest', // Will be configurable later
           mcpTransport: 'stdio', // Default transport
           mcpCapabilities: ['tools'], // Default capabilities
           mcpEndpoint: '/mcp', // Default endpoint
           mcpPort: 8080, // Default port
           templateId: config.templateId,
           environment: config.environment,
           resourceLimits: config.resourceLimits,
           configuration: config.configuration
         }
       });

      // Update MCP-specific fields
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
                 endpoints: [{
           type: 'http' as const,
           url: `http://${adminToolbox.public_ip_address}:8080/mcp`,
           status: 'active' as const
         }]
      };
    } catch (error) {
      console.error('Error deploying MCP server:', error);
      throw error;
    }
  }

  /**
   * Update an MCP server
   */
  async updateServer(id: string, updates: Partial<MCPServer>): Promise<MCPServer> {
    try {
      const { data, error } = await supabase
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

      return await this.getServer(id);
    } catch (error) {
      console.error(`Error updating MCP server ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an MCP server
   */
  async deleteServer(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('account_tool_instances')
        .delete()
        .eq('id', parseInt(id));

      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting MCP server ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get available MCP server templates from registry
   */
  async getMarketplaceTemplates(): Promise<MCPServerTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('mcp_server_catalog')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to MCPServerTemplate format
      return (data || []).map(record => ({
        id: record.id,
        name: record.display_name || record.name,
        description: record.description || '',
        version: record.version,
        author: record.provider || 'Unknown',
        category: record.category || 'other',
        tags: Array.isArray(record.tags) ? record.tags : [],
        dockerImage: record.docker_image,
        documentation: record.documentation_url || '',
        sourceCode: record.repository_url || '',
        rating: {
          average: parseFloat(record.rating_average) || 0,
          count: record.rating_count || 0
        },
        downloads: record.download_count || 0,
        verified: record.is_verified || false,
        configSchema: record.configuration_schema || {
          type: 'object',
          properties: {},
          required: []
        },
        requiredCapabilities: Array.isArray(record.capabilities) ? record.capabilities : ['tools'],
        supportedTransports: ['stdio'], // Default, could be enhanced
        resourceRequirements: {
          memory: '256Mi',
          cpu: '0.25'
        },
        environment: {},
        lastUpdated: new Date(record.updated_at),
        isActive: true
      }));
    } catch (error) {
      console.error('Error fetching marketplace templates:', error);
      // Fallback to hardcoded templates if database fails
      return this.getFallbackTemplates();
    }
  }

  /**
   * Create a new MCP server template
   */
  async createTemplate(templateData: Partial<MCPServerTemplate>): Promise<MCPServerTemplate> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Map author to valid provider values
      let provider = 'community'; // default
      if (templateData.author) {
        const authorLower = templateData.author.toLowerCase();
        if (authorLower.includes('official') || authorLower.includes('agentopia')) {
          provider = 'official';
        } else if (authorLower.includes('custom') || authorLower.includes('private')) {
          provider = 'custom';
        }
        // Everything else remains 'community'
      }

      const { data, error } = await supabase
        .from('mcp_server_catalog')
        .insert({
          name: templateData.name,
          display_name: templateData.name,
          description: templateData.description,
          version: templateData.version || '1.0.0',
          docker_image: templateData.dockerImage,
          category: templateData.category,
          provider: provider,
          capabilities: templateData.requiredCapabilities || ['tools'],
          configuration_schema: templateData.configSchema || {
            type: 'object',
            properties: {},
            required: []
          },
          documentation_url: templateData.documentation,
          repository_url: templateData.sourceCode,
          tags: templateData.tags || [],
          is_verified: false,
          is_published: true,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Transform back to MCPServerTemplate format
      return {
        id: data.id,
        name: data.display_name || data.name,
        description: data.description || '',
        version: data.version,
        author: data.provider || 'Unknown',
        category: data.category || 'other',
        tags: Array.isArray(data.tags) ? data.tags : [],
        dockerImage: data.docker_image,
        documentation: data.documentation_url || '',
        sourceCode: data.repository_url || '',
        rating: {
          average: 0,
          count: 0
        },
        downloads: 0,
        verified: data.is_verified || false,
        configSchema: data.configuration_schema || {
          type: 'object',
          properties: {},
          required: []
        },
        requiredCapabilities: Array.isArray(data.capabilities) ? data.capabilities : ['tools'],
        supportedTransports: ['stdio'],
        resourceRequirements: {
          memory: '256Mi',
          cpu: '0.25'
        },
        environment: {},
        lastUpdated: new Date(data.created_at),
        isActive: true
      };
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update template verification status (admin only)
   */
  async updateTemplateVerification(templateId: string, isVerified: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('mcp_server_catalog')
        .update({ is_verified: isVerified })
        .eq('id', templateId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating template verification:', error);
      throw error;
    }
  }

  /**
   * Delete a template (admin only)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('mcp_server_catalog')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Fallback templates when database is unavailable
   */
  private getFallbackTemplates(): MCPServerTemplate[] {
    return [
      {
        id: 'aws-tools',
        name: 'AWS Tools',
        description: 'MCP server providing AWS cloud service tools',
        version: '1.0.0',
        author: 'AWS',
        category: 'integrations',
        tags: ['aws', 'cloud', 'infrastructure'],
        dockerImage: 'mcp-servers/aws-tools:latest',
        documentation: 'https://docs.mcp-servers.com/aws-tools',
        sourceCode: 'https://github.com/mcp-servers/aws-tools',
        rating: {
          average: 4.8,
          count: 127
        },
        downloads: 1250,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              title: 'AWS Region',
              description: 'AWS region to operate in',
              default: 'us-east-1'
            }
          },
          required: ['region']
        },
        requiredCapabilities: ['list_resources', 'call_tool'],
        supportedTransports: ['stdio', 'sse'],
        resourceRequirements: {
          memory: '512Mi',
          cpu: '0.5',
          storage: '1Gi'
        },
        environment: {
          AWS_REGION: 'us-east-1'
        },
        previewImages: ['https://docs.mcp-servers.com/aws-tools/preview1.png'],
        lastUpdated: new Date('2024-01-15'),
        isActive: true
      },
      {
        id: 'github-tools',
        name: 'GitHub Tools',
        description: 'MCP server for GitHub API interactions',
        version: '1.2.0',
        author: 'GitHub',
        category: 'development',
        tags: ['github', 'git', 'development'],
        dockerImage: 'mcp-servers/github-tools:latest',
        documentation: 'https://docs.mcp-servers.com/github-tools',
        sourceCode: 'https://github.com/mcp-servers/github-tools',
        rating: {
          average: 4.6,
          count: 89
        },
        downloads: 890,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              title: 'GitHub Token',
              description: 'GitHub personal access token'
            }
          },
          required: ['token']
        },
        requiredCapabilities: ['list_resources', 'call_tool'],
        supportedTransports: ['stdio', 'websocket'],
        resourceRequirements: {
          memory: '256Mi',
          cpu: '0.25'
        },
        environment: {},
        lastUpdated: new Date('2024-01-10'),
        isActive: true
      },
      {
        id: 'slack-tools',
        name: 'Slack Tools',
        description: 'MCP server for Slack workspace management',
        version: '1.1.0',
        author: 'Slack',
        category: 'productivity',
        tags: ['slack', 'communication', 'team'],
        dockerImage: 'mcp-servers/slack-tools:latest',
        documentation: 'https://docs.mcp-servers.com/slack-tools',
        rating: {
          average: 4.2,
          count: 65
        },
        downloads: 650,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            webhook_url: {
              type: 'string',
              title: 'Webhook URL',
              description: 'Slack webhook URL for sending messages'
            }
          },
          required: ['webhook_url']
        },
        requiredCapabilities: ['call_tool'],
        supportedTransports: ['sse', 'websocket'],
        resourceRequirements: {
          memory: '128Mi',
          cpu: '0.1'
        },
        environment: {},
        lastUpdated: new Date('2024-01-05'),
        isActive: true
      }
    ];
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<MCPDeploymentStatus> {
    try {
      const server = await this.getServer(deploymentId);
      
      return {
        id: deploymentId,
        status: server.status.state === 'running' ? 'running' : 'failed',
        progress: server.status.state === 'running' ? 100 : 0,
        message: server.status.state === 'running' ? 'Deployment completed successfully' : 'Deployment failed',
        startedAt: server.status.lastStarted || new Date(),
        completedAt: server.status.state === 'running' ? new Date() : undefined,
        logs: [],
        endpoints: [{
          type: 'http',
          url: server.endpoint_url,
          status: server.status.state === 'running' ? 'active' : 'inactive'
        }]
      };
    } catch (error) {
      console.error(`Error getting deployment status for ${deploymentId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService(); 