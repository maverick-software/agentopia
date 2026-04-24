import { ResourceRequirements, IntelligentDropletSelector } from '../intelligentDropletSelector';
import { EnhancedMCPServer } from '../mcpService';
import {
  AdminOperationLog,
  MCPServerDeployment,
  MCPServerDeploymentConfig,
  ToolboxEnvironment,
} from './types';

interface AdminDeploymentContext {
  supabase: any;
  intelligentDropletSelector: IntelligentDropletSelector;
  validateAdminAccess(): Promise<void>;
  getAdminToolboxEnvironment(): Promise<{ id: any; public_ip_address: any; status: any }>;
  getAllMCPServers(): Promise<EnhancedMCPServer[]>;
  logAdminOperation(operation: AdminOperationLog): Promise<void>;
}

export async function deployMCPServer(
  ctx: AdminDeploymentContext,
  config: MCPServerDeploymentConfig
): Promise<MCPServerDeployment> {
  await ctx.validateAdminAccess();

  const deploymentId = crypto.randomUUID();
  const validatedConfig = await validateServerConfig(ctx, config);

  try {
    const adminEnvironment = config.environmentId
      ? await getToolboxEnvironmentById(ctx, config.environmentId)
      : await ctx.getAdminToolboxEnvironment();

    const environmentForDeployment = config.environmentId
      ? {
          id: adminEnvironment.id,
          public_ip_address:
            (adminEnvironment as ToolboxEnvironment).publicIP || adminEnvironment.public_ip_address,
          status: adminEnvironment.status,
        }
      : adminEnvironment;

    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const toolCatalogId = '00000000-0000-0000-0000-000000000001';

    const toolboxToolsUrl = `toolbox-tools/${environmentForDeployment.id}/tools`;
    const { data: deployment, error: deploymentError } = await ctx.supabase.functions.invoke(
      toolboxToolsUrl,
      {
        method: 'POST',
        body: {
          toolCatalogId,
          instanceNameOnToolbox: validatedConfig.serverName,
          baseConfigOverrideJson: {
            dockerImage: validatedConfig.dockerImage,
            environmentVariables: validatedConfig.environmentVariables || {},
            portMappings: validatedConfig.portMappings || [
              { containerPort: 8080, hostPort: 30000 },
            ],
          },
        },
      }
    );

    if (deploymentError || !deployment) {
      throw new Error(`Deployment via Edge Function failed: ${deploymentError?.message || 'Unknown error'}`);
    }

    const { error: updateError } = await ctx.supabase
      .from('account_tool_instances')
      .update({
        mcp_server_type: validatedConfig.serverType,
        mcp_transport_type: validatedConfig.transport,
        mcp_endpoint_path: validatedConfig.endpointPath || '/mcp',
        mcp_server_capabilities: validatedConfig.capabilities || [],
        mcp_discovery_metadata: {
          deployedAt: new Date().toISOString(),
          deploymentConfig: validatedConfig,
          deploymentId,
          adminDeployed: true,
        },
      })
      .eq('id', deployment.id);

    if (updateError) {
      throw new Error(`Failed to update MCP server fields: ${updateError.message}`);
    }

    await ctx.logAdminOperation({
      id: crypto.randomUUID(),
      adminUserId: user.id,
      operation: 'deploy',
      serverId: deployment.id,
      serverName: validatedConfig.serverName,
      timestamp: new Date(),
      success: true,
      metadata: { deploymentConfig: validatedConfig },
    });

    return {
      id: deployment.id,
      status: 'deploying',
      serverName: validatedConfig.serverName,
      deployedAt: new Date(),
      estimatedReadyTime: new Date(Date.now() + 5 * 60 * 1000),
    };
  } catch (error) {
    await ctx.logAdminOperation({
      id: crypto.randomUUID(),
      adminUserId: (await ctx.supabase.auth.getUser()).data.user!.id,
      operation: 'deploy',
      serverId: 'unknown',
      serverName: validatedConfig.serverName,
      timestamp: new Date(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function oneClickDeploy(ctx: AdminDeploymentContext, templateId: string): Promise<MCPServerDeployment> {
  await ctx.validateAdminAccess();

  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const template = await getTemplateWithDefaults(ctx, templateId);
    const requirements = templateToResourceRequirements(template);
    const dropletResult = await ctx.intelligentDropletSelector.selectOptimalDroplet(user.id, requirements);

    const dropletId = dropletResult.autoProvisionRecommendation
      ? await autoProvisionDroplet(dropletResult.autoProvisionRecommendation, user.id)
      : dropletResult.selectedDropletId;

    if (!dropletId) {
      throw new Error('No suitable droplet found and auto-provisioning failed');
    }

    const deploymentConfig: MCPServerDeploymentConfig = {
      serverName: `${template.tool_name}-${Date.now()}`,
      serverType: 'mcp_server',
      dockerImage: template.docker_image,
      transport: 'http',
      endpointPath: '/mcp',
      environmentVariables: template.mcp_server_metadata?.environmentVariables || {},
      capabilities: ['tools', 'resources'],
      resourceLimits: getResourceLimitsFromHint(template.mcp_server_metadata?.resourceHint),
      environmentId: dropletId,
    };

    return await deployMCPServer(ctx, deploymentConfig);
  } catch (error) {
    console.error('One-click deployment failed:', error);
    throw new Error(`One-click deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getTemplateWithDefaults(ctx: AdminDeploymentContext, templateId: string) {
  const { data: template, error } = await ctx.supabase
    .from('tool_catalog')
    .select('*')
    .eq('id', templateId)
    .eq('is_mcp_server', true)
    .single();

  if (error || !template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return template;
}

function templateToResourceRequirements(template: any): ResourceRequirements {
  const resourceHint = template.mcp_server_metadata?.resourceHint || 'medium';

  return {
    cpu: resourceHint as 'light' | 'medium' | 'heavy',
    memory: resourceHint as 'light' | 'medium' | 'heavy',
    network: 'medium',
    storage: 'standard',
    expectedLoad: 'production',
  };
}

async function autoProvisionDroplet(_recommendation: any, _userId: string): Promise<string> {
  throw new Error('Auto-provisioning not yet implemented - please select an existing droplet');
}

function getResourceLimitsFromHint(resourceHint?: string) {
  switch (resourceHint) {
    case 'light':
      return { memory: '512m', cpu: '0.5' };
    case 'heavy':
      return { memory: '2g', cpu: '2' };
    default:
      return { memory: '1g', cpu: '1' };
  }
}

async function validateServerConfig(
  ctx: AdminDeploymentContext,
  config: MCPServerDeploymentConfig
): Promise<MCPServerDeploymentConfig> {
  if (!config.serverName || config.serverName.trim().length === 0) {
    throw new Error('Server name is required');
  }
  if (!config.serverType || config.serverType.trim().length === 0) {
    throw new Error('Server type is required');
  }
  if (!config.dockerImage || config.dockerImage.trim().length === 0) {
    throw new Error('Docker image is required');
  }
  if (!['http', 'stdio', 'websocket'].includes(config.transport)) {
    throw new Error('Invalid transport type. Must be http, stdio, or websocket');
  }

  const existingServers = await ctx.getAllMCPServers();
  const nameExists = existingServers.some(
    (server) => server.name.toLowerCase() === config.serverName.toLowerCase()
  );
  if (nameExists) {
    throw new Error(`Server name '${config.serverName}' already exists`);
  }

  return {
    ...config,
    serverName: config.serverName.trim(),
    serverType: config.serverType.trim(),
    dockerImage: config.dockerImage.trim(),
    endpointPath: config.endpointPath || '/mcp',
    capabilities: config.capabilities || ['tools'],
    portMappings: config.portMappings || [{ containerPort: 8080, hostPort: 30000 }],
  };
}

async function getToolboxEnvironmentById(
  ctx: AdminDeploymentContext,
  environmentId: string
): Promise<ToolboxEnvironment> {
  const { data, error } = await ctx.supabase
    .from('account_tool_environments')
    .select('id, name, public_ip_address, status, region_slug, size_slug')
    .eq('id', environmentId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    throw new Error(`Droplet with ID ${environmentId} not found or not active`);
  }

  return {
    id: data.id,
    name: data.name,
    publicIP: data.public_ip_address,
    status: data.status,
    region: data.region_slug,
    size: data.size_slug,
  };
}

export async function ensureToolCatalogEntry(
  ctx: AdminDeploymentContext,
  templateId: string,
  dockerImage: string
): Promise<string> {
  const { data: existing } = await ctx.supabase
    .from('tool_catalog')
    .select('id')
    .eq('id', templateId)
    .single();

  if (existing) {
    return templateId;
  }

  const { data: newEntry, error } = await ctx.supabase
    .from('tool_catalog')
    .insert({
      id: templateId,
      tool_name: `MCP Server: ${templateId}`,
      name: `MCP Server: ${templateId}`,
      description: 'MCP Server deployed from template',
      package_identifier: dockerImage,
      docker_image_url: dockerImage,
      category: 'mcp-server',
      version: '1.0.0',
      is_public: true,
      status: 'available',
      packaging_type: 'docker_image',
      created_by: (await ctx.supabase.auth.getUser()).data.user!.id,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Could not create tool catalog entry, using generic one:', error);
    return '00000000-0000-0000-0000-000000000001';
  }

  return newEntry.id;
}
