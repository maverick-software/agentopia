// src/lib/services/mcpService.ts
// Real MCP Server management service connected to Supabase

import { supabase } from '../supabase';
import { MCPServer, MCPServerTemplate, MCPDeploymentConfig, MCPDeploymentStatus } from '../mcp/ui-types';

export class MCPService {
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
          config_id,
          tool_id,
          environment_id,
          instance_name,
          is_active,
          created_at,
          updated_at,
          mcp_server_type,
          mcp_endpoint_path,
          mcp_transport_type,
          mcp_server_capabilities,
          mcp_discovery_metadata,
          toolbox:toolboxes!inner(
            id,
            name,
            user_id
          )
        `)
        .eq('toolbox.user_id', user.id)
        .not('mcp_server_type', 'is', null) // Only get instances that are MCP servers
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to MCPServer format
      const servers: MCPServer[] = (data || []).map(instance => ({
        id: instance.id,
        name: instance.instance_name || `MCP Server ${instance.id}`,
        type: instance.mcp_server_type as any,
        endpoint: instance.mcp_endpoint_path || '',
        port: 8080, // Default port - we can make this configurable
        config: {
          environment: {},
          authentication: {},
          resources: {},
          tools: []
        },
        capabilities: instance.mcp_server_capabilities || [],
        status: {
          state: instance.is_active ? 'running' : 'stopped',
          startTime: new Date(instance.created_at),
          uptime: instance.is_active ? Math.floor((Date.now() - new Date(instance.created_at).getTime()) / 1000) : 0,
          lastHealthCheck: new Date()
        },
        health: {
          overall: instance.is_active ? 'healthy' : 'stopped',
          checks: []
        },
        metadata: {
          createdAt: new Date(instance.created_at),
          updatedAt: new Date(instance.updated_at),
          version: '1.0.0'
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
   */
  async deployServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's first toolbox (or create one)
      let { data: toolboxes, error: toolboxError } = await supabase
        .from('toolboxes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (toolboxError) throw toolboxError;

      let toolboxId: number;
      if (!toolboxes || toolboxes.length === 0) {
        // Create a default toolbox for MCP servers
        const { data: newToolbox, error: createError } = await supabase
          .from('toolboxes')
          .insert({
            name: 'MCP Servers',
            description: 'Default toolbox for MCP server instances',
            user_id: user.id
          })
          .select('id')
          .single();

        if (createError) throw createError;
        toolboxId = newToolbox.id;
      } else {
        toolboxId = toolboxes[0].id;
      }

      // Create the MCP server instance
      const { data: instance, error: instanceError } = await supabase
        .from('account_tool_instances')
        .insert({
          toolbox_id: toolboxId,
          tool_id: 1, // We'll need to create a generic MCP tool entry
          instance_name: config.name,
          is_active: true,
          mcp_server_type: config.serverType,
          mcp_endpoint_path: config.endpoint || '/mcp',
          mcp_transport_type: config.transport || 'stdio',
          mcp_server_capabilities: config.capabilities || [],
          mcp_discovery_metadata: {
            deployedAt: new Date().toISOString(),
            deploymentConfig: config
          }
        })
        .select()
        .single();

      if (instanceError) throw instanceError;

      return {
        deploymentId: instance.id.toString(),
        status: 'deploying',
        progress: 0,
        message: 'MCP server deployment initiated',
        startTime: new Date(),
        serverConfig: {
          name: config.name,
          type: config.serverType,
          endpoint: config.endpoint || '/mcp'
        }
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
          instance_name: updates.name,
          is_active: updates.status?.state === 'running',
          mcp_endpoint_path: updates.endpoint,
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
    // For now, return a basic set of templates
    // In the future, this could connect to a real MCP registry
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
        deploymentId,
        status: server.status.state === 'running' ? 'completed' : 'failed',
        progress: server.status.state === 'running' ? 100 : 0,
        message: server.status.state === 'running' ? 'Deployment completed successfully' : 'Deployment failed',
        startTime: server.metadata.createdAt,
        serverConfig: {
          name: server.name,
          type: server.type,
          endpoint: server.endpoint
        }
      };
    } catch (error) {
      console.error(`Error getting deployment status for ${deploymentId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService(); 