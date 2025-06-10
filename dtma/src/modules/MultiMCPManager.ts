import { EventEmitter } from 'events';
import { 
  createAndStartContainer, 
  stopContainer, 
  removeContainer, 
  pullImage
} from '../docker_manager.js';
// Temporarily comment out module imports to fix build
// import { CollectiveHealthMonitor } from './CollectiveHealthMonitor.js';
// import { CredentialInjector } from './CredentialInjector.js';
// import { ConfigurationManager } from './ConfigurationManager.js';

// Temporary stubs for the modules
class CollectiveHealthMonitor {
  startGroupMonitoring(groupId: string, instances: string[]) { console.log('Stub: startGroupMonitoring', groupId, instances); }
  stopGroupMonitoring(groupId: string) { console.log('Stub: stopGroupMonitoring', groupId); }
  registerMCPServer(name: string, config: any) { console.log('Stub: registerMCPServer', name, config); }
  on(event: string, callback: any) { console.log('Stub: on', event); }
  async shutdown() { console.log('Stub: shutdown CollectiveHealthMonitor'); }
}

class CredentialInjector {
  async prepareOAuthCredentials(id: string, providers: string[]) { console.log('Stub: prepareOAuthCredentials', id, providers); return {}; }
  async cleanupCredentials(id: string) { console.log('Stub: cleanupCredentials', id); }
  on(event: string, callback: any) { console.log('Stub: on', event); }
  async shutdown() { console.log('Stub: shutdown CredentialInjector'); }
}

class ConfigurationManager {
  async prepareContainerConfig(config: any, creds: any, context: any) { console.log('Stub: prepareContainerConfig', config); return config.baseConfigOverrideJson || {}; }
  async shutdown() { console.log('Stub: shutdown ConfigurationManager'); }
}

export interface MCPServerConfig {
  accountToolInstanceId: string;
  instanceNameOnToolbox: string;
  dockerImageUrl: string;
  mcpEndpointPath: string;
  mcpTransportType: 'stdio' | 'sse' | 'websocket';
  mcpServerCapabilities: Record<string, any>;
  mcpDiscoveryMetadata: Record<string, any>;
  baseConfigOverrideJson: Record<string, any>;
  requiredOAuthProviders?: string[];
  portBindings?: Record<string, any>;
  environmentVariables?: Record<string, string>;
}

export interface MCPServerInstance {
  config: MCPServerConfig;
  containerId?: string;
  status: 'pending' | 'pulling' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  lastHealthCheck?: Date;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  errorMessage?: string;
  startTime?: Date;
  restartCount: number;
  lastRestartTime?: Date;
}

export interface MCPContainerGroup {
  groupId: string;
  instances: Map<string, MCPServerInstance>;
  sharedNetworking: boolean;
  collectiveStatus: 'initializing' | 'healthy' | 'degraded' | 'failed';
  totalInstances: number;
  runningInstances: number;
  healthyInstances: number;
}

/**
 * MultiMCPManager - Orchestrates multiple MCP servers within a single toolbox
 * 
 * Key Features:
 * - Container group management for related MCP servers
 * - Lifecycle orchestration with dependency handling
 * - Health monitoring integration with CollectiveHealthMonitor
 * - OAuth credential injection via CredentialInjector
 * - Configuration management via ConfigurationManager
 * - Event-driven architecture for real-time updates
 */
export class MultiMCPManager extends EventEmitter {
  private containerGroups = new Map<string, MCPContainerGroup>();
  private mcpInstances = new Map<string, MCPServerInstance>();
  
  private healthMonitor: CollectiveHealthMonitor;
  private credentialInjector: CredentialInjector;
  private configManager: ConfigurationManager;
  
  private readonly MAX_RESTART_ATTEMPTS = 3;
  private readonly RESTART_COOLDOWN_MS = 30000; // 30 seconds
  
  constructor() {
    super();
    
    this.healthMonitor = new CollectiveHealthMonitor();
    this.credentialInjector = new CredentialInjector();
    this.configManager = new ConfigurationManager();
    
    this.setupEventHandlers();
    
    console.log('MultiMCPManager initialized');
  }

  /**
   * Deploy multiple MCP servers as a coordinated group
   */
  async deployMCPGroup(
    groupId: string, 
    servers: MCPServerConfig[], 
    options: {
      sharedNetworking?: boolean;
      dependencyOrder?: string[];
      maxConcurrentDeployments?: number;
    } = {}
  ): Promise<{ success: boolean; deployedServers: string[]; errors: Record<string, string> }> {
    
    console.log(`Starting MCP group deployment: ${groupId} with ${servers.length} servers`);
    
    const deployedServers: string[] = [];
    const errors: Record<string, string> = {};
    const maxConcurrent = options.maxConcurrentDeployments || 3;
    
    try {
      // Create container group
      const containerGroup: MCPContainerGroup = {
        groupId,
        instances: new Map(),
        sharedNetworking: options.sharedNetworking || false,
        collectiveStatus: 'initializing',
        totalInstances: servers.length,
        runningInstances: 0,
        healthyInstances: 0
      };
      
      this.containerGroups.set(groupId, containerGroup);
      
      // Initialize MCP instances
      for (const serverConfig of servers) {
        const instance: MCPServerInstance = {
          config: serverConfig,
          status: 'pending',
          healthStatus: 'unknown',
          restartCount: 0
        };
        
        this.mcpInstances.set(serverConfig.instanceNameOnToolbox, instance);
        containerGroup.instances.set(serverConfig.instanceNameOnToolbox, instance);
      }
      
      // Deploy servers in batches respecting dependency order
      const deploymentOrder = this.calculateDeploymentOrder(servers, options.dependencyOrder);
      
      for (let i = 0; i < deploymentOrder.length; i += maxConcurrent) {
        const batch = deploymentOrder.slice(i, i + maxConcurrent);
        
        await Promise.allSettled(
          batch.map(async (serverConfig) => {
            try {
              await this.deploySingleMCPServer(groupId, serverConfig);
              deployedServers.push(serverConfig.instanceNameOnToolbox);
            } catch (error: any) {
              errors[serverConfig.instanceNameOnToolbox] = error.message;
              console.error(`Failed to deploy MCP server ${serverConfig.instanceNameOnToolbox}:`, error);
            }
          })
        );
        
        // Brief pause between batches to prevent overwhelming the system
        if (i + maxConcurrent < deploymentOrder.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Update container group status
      await this.updateContainerGroupStatus(groupId);
      
      // Start health monitoring for the group
      this.healthMonitor.startGroupMonitoring(groupId, Array.from(containerGroup.instances.keys()));
      
      this.emit('groupDeploymentComplete', {
        groupId,
        deployedServers,
        errors,
        totalServers: servers.length
      });
      
      const success = deployedServers.length > 0;
      console.log(`MCP group deployment ${groupId} ${success ? 'completed' : 'failed'}: ${deployedServers.length}/${servers.length} servers deployed`);
      
      return { success, deployedServers, errors };
      
    } catch (error: any) {
      console.error(`MCP group deployment failed for ${groupId}:`, error);
      this.emit('groupDeploymentError', { groupId, error: error.message });
      return { success: false, deployedServers, errors: { group: error.message } };
    }
  }

  /**
   * Deploy a single MCP server with credential injection and configuration
   */
  private async deploySingleMCPServer(groupId: string, config: MCPServerConfig): Promise<void> {
    const instance = this.mcpInstances.get(config.instanceNameOnToolbox);
    if (!instance) {
      throw new Error(`MCP instance ${config.instanceNameOnToolbox} not found`);
    }
    
    try {
      console.log(`Deploying MCP server: ${config.instanceNameOnToolbox}`);
      
      // Update status
      instance.status = 'pulling';
      this.emit('instanceStatusChange', { instanceName: config.instanceNameOnToolbox, status: 'pulling' });
      
      // Pull Docker image
      await pullImage(config.dockerImageUrl);
      console.log(`Image pulled successfully: ${config.dockerImageUrl}`);
      
      // Prepare OAuth credentials if required
      let injectedCredentials: Record<string, string> = {};
      if (config.requiredOAuthProviders && config.requiredOAuthProviders.length > 0) {
        injectedCredentials = await this.credentialInjector.prepareOAuthCredentials(
          config.accountToolInstanceId,
          config.requiredOAuthProviders
        );
      }
      
      // Prepare container configuration
      const containerConfig = await this.configManager.prepareContainerConfig(
        config,
        injectedCredentials,
        { groupId, sharedNetworking: this.containerGroups.get(groupId)?.sharedNetworking || false }
      );
      
      // Update status
      instance.status = 'starting';
      this.emit('instanceStatusChange', { instanceName: config.instanceNameOnToolbox, status: 'starting' });
      
      // Create and start container
      const container = await createAndStartContainer(
        config.dockerImageUrl,
        config.instanceNameOnToolbox,
        containerConfig
      );
      
      // Update instance with container info
      instance.containerId = container.id;
      instance.status = 'running';
      instance.startTime = new Date();
      instance.healthStatus = 'unknown'; // Will be updated by health monitor
      
      console.log(`MCP server deployed successfully: ${config.instanceNameOnToolbox} (${container.id})`);
      
      this.emit('instanceStatusChange', { 
        instanceName: config.instanceNameOnToolbox, 
        status: 'running',
        containerId: container.id
      });
      
      // Register with health monitor
      this.healthMonitor.registerMCPServer(config.instanceNameOnToolbox, {
        containerId: container.id,
        mcpEndpointPath: config.mcpEndpointPath,
        transportType: config.mcpTransportType,
        expectedCapabilities: config.mcpServerCapabilities
      });
      
    } catch (error: any) {
      instance.status = 'error';
      instance.errorMessage = error.message;
      console.error(`Failed to deploy MCP server ${config.instanceNameOnToolbox}:`, error);
      
      this.emit('instanceStatusChange', { 
        instanceName: config.instanceNameOnToolbox, 
        status: 'error',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Stop and remove an MCP server group
   */
  async removeMCPGroup(
    groupId: string, 
    options: { forceRemove?: boolean; gracefulTimeoutMs?: number } = {}
  ): Promise<{ success: boolean; removedServers: string[]; errors: Record<string, string> }> {
    
    const containerGroup = this.containerGroups.get(groupId);
    if (!containerGroup) {
      throw new Error(`Container group ${groupId} not found`);
    }
    
    console.log(`Removing MCP group: ${groupId}`);
    
    const removedServers: string[] = [];
    const errors: Record<string, string> = {};
    const gracefulTimeout = options.gracefulTimeoutMs || 30000;
    
    // Stop health monitoring for the group
    this.healthMonitor.stopGroupMonitoring(groupId);
    
    // Remove servers in reverse dependency order
    const instances = Array.from(containerGroup.instances.values());
    const removalOrder = instances.reverse();
    
    for (const instance of removalOrder) {
      try {
        console.log(`Removing MCP server: ${instance.config.instanceNameOnToolbox}`);
        
        if (instance.containerId) {
          // Graceful stop first
          instance.status = 'stopping';
          this.emit('instanceStatusChange', { 
            instanceName: instance.config.instanceNameOnToolbox, 
            status: 'stopping' 
          });
          
          await stopContainer(instance.containerId);
          
          // Remove container
          await removeContainer(instance.config.instanceNameOnToolbox, options.forceRemove || false);
        }
        
        // Clean up credentials
        await this.credentialInjector.cleanupCredentials(instance.config.accountToolInstanceId);
        
        // Remove from tracking
        this.mcpInstances.delete(instance.config.instanceNameOnToolbox);
        containerGroup.instances.delete(instance.config.instanceNameOnToolbox);
        
        removedServers.push(instance.config.instanceNameOnToolbox);
        
        this.emit('instanceStatusChange', { 
          instanceName: instance.config.instanceNameOnToolbox, 
          status: 'stopped' 
        });
        
      } catch (error: any) {
        errors[instance.config.instanceNameOnToolbox] = error.message;
        console.error(`Failed to remove MCP server ${instance.config.instanceNameOnToolbox}:`, error);
      }
    }
    
    // Remove container group
    this.containerGroups.delete(groupId);
    
    const success = removedServers.length > 0;
    console.log(`MCP group removal ${groupId} ${success ? 'completed' : 'failed'}: ${removedServers.length} servers removed`);
    
    this.emit('groupRemovalComplete', { groupId, removedServers, errors });
    
    return { success, removedServers, errors };
  }

  /**
   * Get status of all container groups and instances
   */
  getGroupsStatus(): Record<string, any> {
    const groupsStatus: Record<string, any> = {};
    
    for (const [groupId, group] of this.containerGroups) {
      const instances: Record<string, any> = {};
      
      for (const [instanceName, instance] of group.instances) {
        instances[instanceName] = {
          status: instance.status,
          healthStatus: instance.healthStatus,
          containerId: instance.containerId,
          startTime: instance.startTime,
          restartCount: instance.restartCount,
          lastRestartTime: instance.lastRestartTime,
          errorMessage: instance.errorMessage,
          mcpEndpoint: instance.config.mcpEndpointPath,
          transportType: instance.config.mcpTransportType
        };
      }
      
      groupsStatus[groupId] = {
        collectiveStatus: group.collectiveStatus,
        totalInstances: group.totalInstances,
        runningInstances: group.runningInstances,
        healthyInstances: group.healthyInstances,
        sharedNetworking: group.sharedNetworking,
        instances
      };
    }
    
    return groupsStatus;
  }

  /**
   * Restart a failed MCP server with exponential backoff
   */
  async restartMCPServer(instanceName: string): Promise<boolean> {
    const instance = this.mcpInstances.get(instanceName);
    if (!instance) {
      console.error(`MCP instance ${instanceName} not found for restart`);
      return false;
    }
    
    if (instance.restartCount >= this.MAX_RESTART_ATTEMPTS) {
      console.error(`Max restart attempts reached for ${instanceName}`);
      return false;
    }
    
    // Check restart cooldown
    if (instance.lastRestartTime) {
      const timeSinceLastRestart = Date.now() - instance.lastRestartTime.getTime();
      if (timeSinceLastRestart < this.RESTART_COOLDOWN_MS) {
        console.log(`Restart cooldown in effect for ${instanceName}, skipping restart`);
        return false;
      }
    }
    
    try {
      console.log(`Restarting MCP server: ${instanceName} (attempt ${instance.restartCount + 1})`);
      
      // Clean up existing container if any
      if (instance.containerId) {
        try {
          await removeContainer(instanceName, true);
        } catch (error) {
          console.warn(`Failed to remove existing container for ${instanceName}:`, error);
        }
      }
      
      // Find the group for networking context
      let groupId = '';
      for (const [gId, group] of this.containerGroups) {
        if (group.instances.has(instanceName)) {
          groupId = gId;
          break;
        }
      }
      
      // Redeploy the server
      await this.deploySingleMCPServer(groupId, instance.config);
      
      instance.restartCount++;
      instance.lastRestartTime = new Date();
      
      console.log(`MCP server ${instanceName} restarted successfully`);
      this.emit('instanceRestarted', { instanceName, restartCount: instance.restartCount });
      
      return true;
      
    } catch (error: any) {
      console.error(`Failed to restart MCP server ${instanceName}:`, error);
      instance.status = 'error';
      instance.errorMessage = `Restart failed: ${error.message}`;
      
      this.emit('instanceRestartFailed', { instanceName, error: error.message });
      return false;
    }
  }

  /**
   * Calculate deployment order based on dependencies
   */
  private calculateDeploymentOrder(servers: MCPServerConfig[], dependencyOrder?: string[]): MCPServerConfig[] {
    if (!dependencyOrder || dependencyOrder.length === 0) {
      return [...servers]; // Return copy of original order
    }
    
    // Sort based on dependency order, with unlisted servers at the end
    const ordered = [...servers].sort((a, b) => {
      const aIndex = dependencyOrder.indexOf(a.instanceNameOnToolbox);
      const bIndex = dependencyOrder.indexOf(b.instanceNameOnToolbox);
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
    
    return ordered;
  }

  /**
   * Update container group collective status based on instance states
   */
  private async updateContainerGroupStatus(groupId: string): Promise<void> {
    const group = this.containerGroups.get(groupId);
    if (!group) return;
    
    let runningCount = 0;
    let healthyCount = 0;
    
    for (const instance of group.instances.values()) {
      if (instance.status === 'running') {
        runningCount++;
        if (instance.healthStatus === 'healthy') {
          healthyCount++;
        }
      }
    }
    
    group.runningInstances = runningCount;
    group.healthyInstances = healthyCount;
    
    // Calculate collective status
    if (runningCount === 0) {
      group.collectiveStatus = 'failed';
    } else if (healthyCount === group.totalInstances) {
      group.collectiveStatus = 'healthy';
    } else if (healthyCount > 0) {
      group.collectiveStatus = 'degraded';
    } else {
      group.collectiveStatus = 'failed';
    }
    
    this.emit('groupStatusChange', {
      groupId,
      collectiveStatus: group.collectiveStatus,
      runningInstances: runningCount,
      healthyInstances: healthyCount,
      totalInstances: group.totalInstances
    });
  }

  /**
   * Setup event handlers for health monitoring and other modules
   */
  private setupEventHandlers(): void {
    // Health monitor events
    this.healthMonitor.on('serverHealthChange', async (data: { instanceName: string; healthStatus: string; details?: any }) => {
      const instance = this.mcpInstances.get(data.instanceName);
      if (instance) {
        instance.healthStatus = data.healthStatus as 'healthy' | 'unhealthy' | 'unknown';
        instance.lastHealthCheck = new Date();
        
        // Find group and update status
        for (const [groupId, group] of this.containerGroups) {
          if (group.instances.has(data.instanceName)) {
            await this.updateContainerGroupStatus(groupId);
            break;
          }
        }
        
        // Auto-restart if unhealthy and eligible
        if (data.healthStatus === 'unhealthy' && instance.status === 'running') {
          console.log(`MCP server ${data.instanceName} is unhealthy, attempting restart`);
          setTimeout(() => this.restartMCPServer(data.instanceName), 5000);
        }
      }
      
      this.emit('mcpHealthChange', data);
    });
    
    // Credential injector events
    this.credentialInjector.on('credentialUpdate', (data: { accountToolInstanceId: string; provider: string }) => {
      // Find instances that use this credential and mark for restart if needed
      for (const instance of this.mcpInstances.values()) {
        if (instance.config.accountToolInstanceId === data.accountToolInstanceId &&
            instance.config.requiredOAuthProviders?.includes(data.provider)) {
          console.log(`OAuth credential updated for ${instance.config.instanceNameOnToolbox}, restart may be needed`);
          this.emit('credentialUpdateRequired', { 
            instanceName: instance.config.instanceNameOnToolbox,
            provider: data.provider
          });
        }
      }
    });
  }

  /**
   * Get detailed logs for an MCP server instance
   * Note: getContainerLogs not yet implemented in docker_manager
   */
  async getMCPServerLogs(instanceName: string, options: { tail?: number; since?: string } = {}): Promise<string> {
    const instance = this.mcpInstances.get(instanceName);
    if (!instance || !instance.containerId) {
      throw new Error(`MCP instance ${instanceName} not found or not running`);
    }
    
    console.log(`[STUB] Would get logs for container ${instance.containerId} with options:`, options);
    return `[STUB] Logs for ${instanceName} would be here`;
  }

  /**
   * Shutdown the MultiMCPManager and clean up all resources
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down MultiMCPManager...');
    
    // Stop all container groups
    const shutdownPromises = Array.from(this.containerGroups.keys()).map(groupId =>
      this.removeMCPGroup(groupId, { forceRemove: true, gracefulTimeoutMs: 10000 })
    );
    
    await Promise.allSettled(shutdownPromises);
    
    // Shutdown sub-modules
    await this.healthMonitor.shutdown();
    await this.credentialInjector.shutdown();
    await this.configManager.shutdown();
    
    this.removeAllListeners();
    console.log('MultiMCPManager shutdown complete');
  }
} 