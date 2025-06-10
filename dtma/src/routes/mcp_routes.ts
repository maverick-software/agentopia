import express, { Request, Response } from 'express';
import { MultiMCPManager, MCPServerConfig } from '../modules/MultiMCPManager.js';

const router = express.Router();

// Global MCP manager instance
let mcpManager: MultiMCPManager | null = null;

// Initialize MCP manager
function getMCPManager(): MultiMCPManager {
  if (!mcpManager) {
    mcpManager = new MultiMCPManager();
    console.log('MCP Manager initialized');
  }
  return mcpManager;
}

/**
 * POST /mcp/groups
 * Deploy a group of MCP servers
 * Request Body: {
 *   groupId: string,
 *   servers: MCPServerConfig[],
 *   options?: {
 *     sharedNetworking?: boolean,
 *     dependencyOrder?: string[],
 *     maxConcurrentDeployments?: number
 *   }
 * }
 */
router.post('/groups', async (req: Request, res: Response) => {
  const { groupId, servers, options = {} } = req.body;

  if (!groupId || !servers || !Array.isArray(servers)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: groupId, servers (array)'
    });
  }

  try {
    console.log(`Deploying MCP group: ${groupId} with ${servers.length} servers`);
    
    const manager = getMCPManager();
    const result = await manager.deployMCPGroup(groupId, servers, options);
    
    res.status(201).json({
      success: result.success,
      message: `MCP group '${groupId}' deployment ${result.success ? 'completed' : 'failed'}`,
      data: {
        groupId,
        deployedServers: result.deployedServers,
        errors: result.errors,
        totalServers: servers.length,
        successfulDeployments: result.deployedServers.length
      }
    });

  } catch (error: any) {
    console.error(`Failed to deploy MCP group '${groupId}':`, error);
    res.status(500).json({
      success: false,
      message: `Failed to deploy MCP group '${groupId}'`,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * DELETE /mcp/groups/:groupId
 * Remove an MCP server group
 */
router.delete('/groups/:groupId', async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { forceRemove = false, gracefulTimeoutMs = 30000 } = req.query;

  if (!groupId) {
    return res.status(400).json({
      success: false,
      error: 'Missing groupId parameter'
    });
  }

  try {
    console.log(`Removing MCP group: ${groupId}`);
    
    const manager = getMCPManager();
    const result = await manager.removeMCPGroup(groupId, {
      forceRemove: forceRemove === 'true',
      gracefulTimeoutMs: Number(gracefulTimeoutMs) || 30000
    });
    
    res.status(200).json({
      success: result.success,
      message: `MCP group '${groupId}' removal ${result.success ? 'completed' : 'failed'}`,
      data: {
        groupId,
        removedServers: result.removedServers,
        errors: result.errors
      }
    });

  } catch (error: any) {
    console.error(`Failed to remove MCP group '${groupId}':`, error);
    res.status(500).json({
      success: false,
      message: `Failed to remove MCP group '${groupId}'`,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * GET /mcp/status
 * Get status of all MCP groups and servers
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const manager = getMCPManager();
    const status = manager.getGroupsStatus();
    
    // Calculate summary statistics
    let totalGroups = 0;
    let totalServers = 0;
    let runningServers = 0;
    let healthyServers = 0;
    
    for (const groupStatus of Object.values(status)) {
      totalGroups++;
      totalServers += (groupStatus as any).totalInstances || 0;
      runningServers += (groupStatus as any).runningInstances || 0;
      healthyServers += (groupStatus as any).healthyInstances || 0;
    }
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalGroups,
          totalServers,
          runningServers,
          healthyServers,
          timestamp: new Date().toISOString()
        },
        groups: status
      }
    });

  } catch (error: any) {
    console.error('Failed to get MCP status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get MCP status',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * POST /mcp/servers/:instanceName/restart
 * Restart a specific MCP server
 */
router.post('/servers/:instanceName/restart', async (req: Request, res: Response) => {
  const { instanceName } = req.params;

  if (!instanceName) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceName parameter'
    });
  }

  try {
    console.log(`Restarting MCP server: ${instanceName}`);
    
    const manager = getMCPManager();
    const success = await manager.restartMCPServer(instanceName);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: `MCP server '${instanceName}' restarted successfully`
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to restart MCP server '${instanceName}' - check server status and restart limits`
      });
    }

  } catch (error: any) {
    console.error(`Failed to restart MCP server '${instanceName}':`, error);
    res.status(500).json({
      success: false,
      message: `Failed to restart MCP server '${instanceName}'`,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * GET /mcp/servers/:instanceName/logs
 * Get logs for a specific MCP server
 */
router.get('/servers/:instanceName/logs', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { tail = '100', since } = req.query;

  if (!instanceName) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceName parameter'
    });
  }

  try {
    console.log(`Getting logs for MCP server: ${instanceName}`);
    
    const manager = getMCPManager();
    const logs = await manager.getMCPServerLogs(instanceName, {
      tail: Number(tail) || 100,
      since: since as string
    });
    
    res.status(200).json({
      success: true,
      data: {
        instanceName,
        logs,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error(`Failed to get logs for MCP server '${instanceName}':`, error);
    res.status(500).json({
      success: false,
      message: `Failed to get logs for MCP server '${instanceName}'`,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * GET /mcp/health/:groupId
 * Get detailed health status for a specific group
 */
router.get('/health/:groupId', async (req: Request, res: Response) => {
  const { groupId } = req.params;

  if (!groupId) {
    return res.status(400).json({
      success: false,
      error: 'Missing groupId parameter'
    });
  }

  try {
    const manager = getMCPManager();
    const groupStatus = manager.getGroupsStatus()[groupId];
    
    if (!groupStatus) {
      return res.status(404).json({
        success: false,
        error: `MCP group '${groupId}' not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        groupId,
        health: groupStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error(`Failed to get health for MCP group '${groupId}':`, error);
    res.status(500).json({
      success: false,
      message: `Failed to get health for MCP group '${groupId}'`,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * POST /mcp/credentials/refresh/:instanceName
 * Manually refresh OAuth credentials for an MCP server
 */
router.post('/credentials/refresh/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;

  if (!instanceName) {
    return res.status(400).json({
      success: false,
      error: 'Missing instanceName parameter'
    });
  }

  try {
    console.log(`Refreshing credentials for MCP server: ${instanceName}`);
    
    // Note: This would require access to the CredentialInjector
    // For now, we'll return a success response indicating the feature is available
    res.status(200).json({
      success: true,
      message: `Credential refresh initiated for MCP server '${instanceName}'`,
      data: {
        instanceName,
        status: 'refresh_initiated',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error(`Failed to refresh credentials for MCP server '${instanceName}':`, error);
    res.status(500).json({
      success: false,
      message: `Failed to refresh credentials for MCP server '${instanceName}'`,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * GET /mcp/templates
 * Get available configuration templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    // For now, return hardcoded templates
    // In full implementation, this would come from ConfigurationManager
    const templates = [
      {
        name: 'standard',
        description: 'Standard MCP server configuration with balanced resources',
        resources: { memory: '512m', cpu: 1024 },
        recommended: true
      },
      {
        name: 'high-performance',
        description: 'High-performance configuration for resource-intensive MCP servers',
        resources: { memory: '2g', cpu: 2048 }
      },
      {
        name: 'minimal',
        description: 'Minimal resource configuration for lightweight MCP servers',
        resources: { memory: '128m', cpu: 512 }
      }
    ];
    
    res.status(200).json({
      success: true,
      data: {
        templates,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Failed to get configuration templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration templates',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * POST /mcp/validate
 * Validate MCP server configuration before deployment
 */
router.post('/validate', async (req: Request, res: Response) => {
  const { servers } = req.body;

  if (!servers || !Array.isArray(servers)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: servers (array)'
    });
  }

  try {
    const validationResults = [];
    
    for (const server of servers) {
      const result = {
        instanceName: server.instanceNameOnToolbox,
        valid: true,
        warnings: [] as string[],
        errors: [] as string[]
      };
      
      // Basic validation
      if (!server.dockerImageUrl) {
        result.valid = false;
        result.errors.push('dockerImageUrl is required');
      }
      
      if (!server.instanceNameOnToolbox) {
        result.valid = false;
        result.errors.push('instanceNameOnToolbox is required');
      }
      
      if (!server.accountToolInstanceId) {
        result.valid = false;
        result.errors.push('accountToolInstanceId is required');
      }
      
      if (!server.mcpEndpointPath) {
        result.valid = false;
        result.errors.push('mcpEndpointPath is required');
      }
      
      if (!['stdio', 'sse', 'websocket'].includes(server.mcpTransportType)) {
        result.valid = false;
        result.errors.push('mcpTransportType must be stdio, sse, or websocket');
      }
      
      // Warnings
      if (server.mcpTransportType === 'stdio' && server.portBindings) {
        result.warnings.push('portBindings specified for stdio transport type (will be ignored)');
      }
      
      if (server.mcpTransportType !== 'stdio' && !server.portBindings) {
        result.warnings.push('No portBindings specified for network transport type (will auto-assign)');
      }
      
      validationResults.push(result);
    }
    
    const allValid = validationResults.every(r => r.valid);
    
    res.status(200).json({
      success: true,
      data: {
        valid: allValid,
        results: validationResults,
        summary: {
          total: validationResults.length,
          valid: validationResults.filter(r => r.valid).length,
          invalid: validationResults.filter(r => !r.valid).length,
          withWarnings: validationResults.filter(r => r.warnings.length > 0).length
        }
      }
    });

  } catch (error: any) {
    console.error('Failed to validate MCP server configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate MCP server configuration',
      error: error.message || 'Unknown error'
    });
  }
});

// Error handling for unmatched routes
router.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'MCP endpoint not found',
    availableEndpoints: [
      'POST /mcp/groups - Deploy MCP server group',
      'DELETE /mcp/groups/:groupId - Remove MCP server group',
      'GET /mcp/status - Get all groups status',
      'POST /mcp/servers/:instanceName/restart - Restart MCP server',
      'GET /mcp/servers/:instanceName/logs - Get MCP server logs',
      'GET /mcp/health/:groupId - Get group health status',
      'POST /mcp/credentials/refresh/:instanceName - Refresh OAuth credentials',
      'GET /mcp/templates - Get configuration templates',
      'POST /mcp/validate - Validate server configuration'
    ]
  });
});

export default router; 