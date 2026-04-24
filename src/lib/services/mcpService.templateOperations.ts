import type { SupabaseClient } from '@supabase/supabase-js';
import { MCPServerTemplate } from '../mcp/ui-types';

export async function getMarketplaceTemplatesOperation(
  supabase: SupabaseClient
): Promise<MCPServerTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('mcp_server_catalog')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((record) => ({
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
      supportedTransports: ['stdio'],
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
    return getFallbackTemplates();
  }
}

export async function createTemplateOperation(
  supabase: SupabaseClient,
  templateData: Partial<MCPServerTemplate>
): Promise<MCPServerTemplate> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let provider = 'community';
  if (templateData.author) {
    const authorLower = templateData.author.toLowerCase();
    if (authorLower.includes('official') || authorLower.includes('agentopia')) {
      provider = 'official';
    } else if (authorLower.includes('custom') || authorLower.includes('private')) {
      provider = 'custom';
    }
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
}

export async function updateTemplateVerificationOperation(
  supabase: SupabaseClient,
  templateId: string,
  isVerified: boolean
): Promise<void> {
  const { error } = await supabase
    .from('mcp_server_catalog')
    .update({ is_verified: isVerified })
    .eq('id', templateId);
  if (error) throw error;
}

export async function deleteTemplateOperation(
  supabase: SupabaseClient,
  templateId: string
): Promise<void> {
  const { error } = await supabase
    .from('mcp_server_catalog')
    .delete()
    .eq('id', templateId);
  if (error) throw error;
}

function getFallbackTemplates(): MCPServerTemplate[] {
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
