import { EventEmitter } from 'events';
import { MCPServerConfig } from './MultiMCPManager.js';

export interface ContainerNetworkConfig {
  groupId: string;
  sharedNetworking: boolean;
  networkName?: string;
  portBindings?: Record<string, any>;
  exposedPorts?: Record<string, any>;
}

export interface ContainerResourceConfig {
  cpuLimit?: string;
  memoryLimit?: string;
  memoryReservation?: string;
  pidsLimit?: number;
  ulimits?: Array<{ name: string; soft: number; hard: number }>;
}

export interface ContainerSecurityConfig {
  runAsUser?: string;
  runAsGroup?: string;
  readOnlyRootFilesystem?: boolean;
  noNewPrivileges?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
  seccompProfile?: string;
  apparmorProfile?: string;
}

export interface ContainerConfig {
  Image: string;
  name: string;
  Env: string[];
  Cmd?: string[];
  WorkingDir?: string;
  ExposedPorts?: Record<string, any>;
  HostConfig: {
    RestartPolicy: { Name: string; MaximumRetryCount?: number };
    PortBindings?: Record<string, any>;
    NetworkMode?: string;
    Memory?: number;
    CpuShares?: number;
    SecurityOpt?: string[];
    ReadonlyRootfs?: boolean;
    Tmpfs?: Record<string, string>;
    LogConfig?: {
      Type: string;
      Config: Record<string, string>;
    };
  };
  NetworkingConfig?: {
    EndpointsConfig?: Record<string, any>;
  };
  Labels?: Record<string, string>;
}

/**
 * ConfigurationManager - Manages dynamic configuration generation for MCP servers
 * 
 * Features:
 * - Dynamic container configuration based on MCP requirements
 * - Networking configuration for multi-container groups
 * - Security hardening and resource management
 * - Environment variable injection and management
 * - Configuration templates and customization
 * - Compliance with container security best practices
 */
export class ConfigurationManager extends EventEmitter {
  private configTemplates = new Map<string, any>();
  private networkConfigs = new Map<string, ContainerNetworkConfig>();
  private defaultResourceLimits!: ContainerResourceConfig;
  private defaultSecurityConfig!: ContainerSecurityConfig;
  
  private readonly NETWORK_PREFIX = 'agentopia-mcp';
  private readonly DEFAULT_MCP_PORTS = [8080, 3000, 5000, 8000];
  
  constructor() {
    super();
    
    this.initializeDefaults();
    this.loadConfigTemplates();
    
    console.log('ConfigurationManager initialized');
  }

  /**
   * Prepare complete container configuration for an MCP server
   */
  async prepareContainerConfig(
    mcpConfig: MCPServerConfig,
    injectedCredentials: Record<string, string>,
    networkContext: { groupId: string; sharedNetworking: boolean }
  ): Promise<ContainerConfig> {
    
    console.log(`Preparing container configuration for MCP server: ${mcpConfig.instanceNameOnToolbox}`);
    
    try {
      // Build base configuration
      const containerConfig: ContainerConfig = {
        Image: mcpConfig.dockerImageUrl,
        name: mcpConfig.instanceNameOnToolbox,
        Env: [],
        HostConfig: {
          RestartPolicy: { Name: 'unless-stopped', MaximumRetryCount: 3 },
        },
        Labels: this.generateLabels(mcpConfig, networkContext.groupId)
      };
      
      // Configure environment variables
      containerConfig.Env = this.buildEnvironmentVariables(mcpConfig, injectedCredentials);
      
      // Configure networking
      await this.configureNetworking(containerConfig, mcpConfig, networkContext);
      
      // Configure resources
      this.configureResources(containerConfig, mcpConfig);
      
      // Configure security
      this.configureSecurity(containerConfig, mcpConfig);
      
      // Configure logging
      this.configureLogging(containerConfig, mcpConfig);
      
      // Apply any custom overrides
      this.applyCustomOverrides(containerConfig, mcpConfig.baseConfigOverrideJson);
      
      // Validate configuration
      this.validateConfiguration(containerConfig, mcpConfig);
      
      this.emit('configurationPrepared', {
        instanceName: mcpConfig.instanceNameOnToolbox,
        config: containerConfig
      });
      
      return containerConfig;
      
    } catch (error: any) {
      console.error(`Failed to prepare container configuration for ${mcpConfig.instanceNameOnToolbox}:`, error);
      
      this.emit('configurationError', {
        instanceName: mcpConfig.instanceNameOnToolbox,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Build environment variables for the container
   */
  private buildEnvironmentVariables(
    mcpConfig: MCPServerConfig,
    injectedCredentials: Record<string, string>
  ): string[] {
    
    const envVars: string[] = [];
    
    // Standard MCP environment variables
    envVars.push(`MCP_ENDPOINT_PATH=${mcpConfig.mcpEndpointPath}`);
    envVars.push(`MCP_TRANSPORT_TYPE=${mcpConfig.mcpTransportType}`);
    envVars.push(`MCP_SERVER_NAME=${mcpConfig.instanceNameOnToolbox}`);
    envVars.push(`MCP_ACCOUNT_TOOL_INSTANCE_ID=${mcpConfig.accountToolInstanceId}`);
    
    // MCP capabilities as JSON
    if (mcpConfig.mcpServerCapabilities) {
      envVars.push(`MCP_CAPABILITIES=${JSON.stringify(mcpConfig.mcpServerCapabilities)}`);
    }
    
    // Discovery metadata
    if (mcpConfig.mcpDiscoveryMetadata) {
      envVars.push(`MCP_DISCOVERY_METADATA=${JSON.stringify(mcpConfig.mcpDiscoveryMetadata)}`);
    }
    
    // Injected OAuth credentials
    for (const [key, value] of Object.entries(injectedCredentials)) {
      envVars.push(`${key}=${value}`);
    }
    
    // Custom environment variables from config
    if (mcpConfig.environmentVariables) {
      for (const [key, value] of Object.entries(mcpConfig.environmentVariables)) {
        envVars.push(`${key}=${value}`);
      }
    }
    
    // Common environment variables for containerized applications
    envVars.push(`CONTAINER_NAME=${mcpConfig.instanceNameOnToolbox}`);
    envVars.push(`DEPLOYMENT_TIMESTAMP=${new Date().toISOString()}`);
    envVars.push(`NODE_ENV=production`);
    
    return envVars;
  }

  /**
   * Configure networking for the container
   */
  private async configureNetworking(
    containerConfig: ContainerConfig,
    mcpConfig: MCPServerConfig,
    networkContext: { groupId: string; sharedNetworking: boolean }
  ): Promise<void> {
    
    // Configure port bindings
    const portBindings = this.generatePortBindings(mcpConfig);
    containerConfig.HostConfig.PortBindings = portBindings;
    
    // Configure exposed ports
    containerConfig.ExposedPorts = this.generateExposedPorts(portBindings);
    
    // Configure network mode and networking
    if (networkContext.sharedNetworking) {
      const networkName = `${this.NETWORK_PREFIX}-${networkContext.groupId}`;
      
      // Store network configuration
      this.networkConfigs.set(networkContext.groupId, {
        groupId: networkContext.groupId,
        sharedNetworking: true,
        networkName,
        portBindings
      });
      
      // Configure container to use custom network
      containerConfig.HostConfig.NetworkMode = networkName;
      
      // Add network endpoint configuration
      containerConfig.NetworkingConfig = {
        EndpointsConfig: {
          [networkName]: {
            Aliases: [mcpConfig.instanceNameOnToolbox]
          }
        }
      };
    } else {
      // Use default bridge network
      containerConfig.HostConfig.NetworkMode = 'bridge';
    }
  }

  /**
   * Generate port bindings for the MCP server
   */
  private generatePortBindings(mcpConfig: MCPServerConfig): Record<string, any> {
    const portBindings: Record<string, any> = {};
    
    // Use custom port bindings if provided
    if (mcpConfig.portBindings) {
      return mcpConfig.portBindings;
    }
    
    // Auto-assign ports based on transport type
    let containerPort: number;
    
    switch (mcpConfig.mcpTransportType) {
      case 'sse':
        containerPort = 8080; // Common for SSE endpoints
        break;
      case 'websocket':
        containerPort = 3000; // Common for WebSocket servers
        break;
      case 'stdio':
        // No network port needed for stdio
        return {};
      default:
        containerPort = 8080;
    }
    
    // Find available host port (simple implementation)
    const hostPort = this.findAvailablePort();
    
    portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort.toString() }];
    
    return portBindings;
  }

  /**
   * Generate exposed ports configuration
   */
  private generateExposedPorts(portBindings: Record<string, any>): Record<string, any> {
    const exposedPorts: Record<string, any> = {};
    
    for (const containerPort of Object.keys(portBindings)) {
      exposedPorts[containerPort] = {};
    }
    
    return exposedPorts;
  }

  /**
   * Find an available host port (simplified implementation)
   */
  private findAvailablePort(): number {
    // In a real implementation, this would check for actual port availability
    // For now, use a simple random port in the dynamic range
    return Math.floor(Math.random() * (65535 - 32768)) + 32768;
  }

  /**
   * Configure resource limits for the container
   */
  private configureResources(containerConfig: ContainerConfig, mcpConfig: MCPServerConfig): void {
    // Apply default resource limits
    containerConfig.HostConfig.Memory = this.parseMemoryLimit(this.defaultResourceLimits.memoryLimit || '512m');
    containerConfig.HostConfig.CpuShares = 1024; // Default CPU shares
    
    // Override with custom limits if provided in baseConfigOverrideJson
    const customResources = mcpConfig.baseConfigOverrideJson?.resources;
    if (customResources) {
      if (customResources.memory) {
        containerConfig.HostConfig.Memory = this.parseMemoryLimit(customResources.memory);
      }
      if (customResources.cpu) {
        containerConfig.HostConfig.CpuShares = customResources.cpu;
      }
    }
  }

  /**
   * Configure security settings for the container
   */
  private configureSecurity(containerConfig: ContainerConfig, mcpConfig: MCPServerConfig): void {
    const securityOpt: string[] = [];
    
    // Apply default security configuration
    if (this.defaultSecurityConfig.noNewPrivileges) {
      securityOpt.push('no-new-privileges:true');
    }
    
    if (this.defaultSecurityConfig.readOnlyRootFilesystem) {
      containerConfig.HostConfig.ReadonlyRootfs = true;
      
      // Add tmpfs for areas that need to be writable
      containerConfig.HostConfig.Tmpfs = {
        '/tmp': 'rw,noexec,nosuid,size=100m',
        '/var/run': 'rw,noexec,nosuid,size=10m'
      };
    }
    
    // Add seccomp profile if specified
    if (this.defaultSecurityConfig.seccompProfile) {
      securityOpt.push(`seccomp=${this.defaultSecurityConfig.seccompProfile}`);
    }
    
    // Add AppArmor profile if specified
    if (this.defaultSecurityConfig.apparmorProfile) {
      securityOpt.push(`apparmor=${this.defaultSecurityConfig.apparmorProfile}`);
    }
    
    if (securityOpt.length > 0) {
      containerConfig.HostConfig.SecurityOpt = securityOpt;
    }
    
    // Override with custom security settings if provided
    const customSecurity = mcpConfig.baseConfigOverrideJson?.security;
    if (customSecurity) {
      if (customSecurity.readOnlyRootFilesystem !== undefined) {
        containerConfig.HostConfig.ReadonlyRootfs = customSecurity.readOnlyRootFilesystem;
      }
    }
  }

  /**
   * Configure logging for the container
   */
  private configureLogging(containerConfig: ContainerConfig, mcpConfig: MCPServerConfig): void {
    containerConfig.HostConfig.LogConfig = {
      Type: 'json-file',
      Config: {
        'max-size': '10m',
        'max-file': '3',
        'labels': `mcp_server,instance_name=${mcpConfig.instanceNameOnToolbox}`
      }
    };
  }

  /**
   * Apply custom configuration overrides
   */
  private applyCustomOverrides(containerConfig: ContainerConfig, overrides: Record<string, any>): void {
    if (!overrides || typeof overrides !== 'object') {
      return;
    }
    
    // Apply environment variable overrides
    if (overrides.Env && Array.isArray(overrides.Env)) {
      containerConfig.Env = [...containerConfig.Env, ...overrides.Env];
    }
    
    // Apply command overrides
    if (overrides.Cmd && Array.isArray(overrides.Cmd)) {
      containerConfig.Cmd = overrides.Cmd;
    }
    
    // Apply working directory override
    if (overrides.WorkingDir && typeof overrides.WorkingDir === 'string') {
      containerConfig.WorkingDir = overrides.WorkingDir;
    }
    
    // Apply HostConfig overrides
    if (overrides.HostConfig && typeof overrides.HostConfig === 'object') {
      containerConfig.HostConfig = {
        ...containerConfig.HostConfig,
        ...overrides.HostConfig
      };
    }
    
    // Apply label overrides
    if (overrides.Labels && typeof overrides.Labels === 'object') {
      containerConfig.Labels = {
        ...containerConfig.Labels,
        ...overrides.Labels
      };
    }
  }

  /**
   * Generate container labels for organization and management
   */
  private generateLabels(mcpConfig: MCPServerConfig, groupId: string): Record<string, string> {
    return {
      'agentopia.mcp.server': 'true',
      'agentopia.mcp.instance_name': mcpConfig.instanceNameOnToolbox,
      'agentopia.mcp.account_tool_instance_id': mcpConfig.accountToolInstanceId,
      'agentopia.mcp.transport_type': mcpConfig.mcpTransportType,
      'agentopia.mcp.endpoint_path': mcpConfig.mcpEndpointPath,
      'agentopia.mcp.group_id': groupId,
      'agentopia.deployment.timestamp': new Date().toISOString(),
      'agentopia.managed_by': 'dtma'
    };
  }

  /**
   * Validate container configuration
   */
  private validateConfiguration(containerConfig: ContainerConfig, mcpConfig: MCPServerConfig): void {
    // Basic validation
    if (!containerConfig.Image) {
      throw new Error('Container image is required');
    }
    
    if (!containerConfig.name) {
      throw new Error('Container name is required');
    }
    
    // Validate port bindings for non-stdio transport types
    if (mcpConfig.mcpTransportType !== 'stdio') {
      if (!containerConfig.HostConfig.PortBindings || 
          Object.keys(containerConfig.HostConfig.PortBindings).length === 0) {
        throw new Error(`Port bindings required for transport type: ${mcpConfig.mcpTransportType}`);
      }
    }
    
    // Validate resource limits
    if (containerConfig.HostConfig.Memory && containerConfig.HostConfig.Memory < 64 * 1024 * 1024) {
      console.warn(`Memory limit very low for ${mcpConfig.instanceNameOnToolbox}: ${containerConfig.HostConfig.Memory} bytes`);
    }
    
    // Validate environment variables don't contain secrets in plain text
    for (const envVar of containerConfig.Env) {
      if (envVar.toLowerCase().includes('password') && !envVar.includes('_ID') && !envVar.includes('_REF')) {
        console.warn(`Potential plain text password in environment variables for ${mcpConfig.instanceNameOnToolbox}`);
      }
    }
  }

  /**
   * Parse memory limit string to bytes
   */
  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmgtKMGT]?)([bB]?)$/);
    if (!match) {
      throw new Error(`Invalid memory limit format: ${limit}`);
    }
    
    const value = parseInt(match[1] || '0');
    const unit = (match[2] || '').toLowerCase();
    
    const multipliers: Record<string, number> = {
      '': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024,
      't': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaults(): void {
    this.defaultResourceLimits = {
      memoryLimit: '512m',
      cpuLimit: '1',
      pidsLimit: 512
    };
    
    this.defaultSecurityConfig = {
      runAsUser: '1000',
      runAsGroup: '1000',
      readOnlyRootFilesystem: false, // Some MCP servers need write access
      noNewPrivileges: true,
      capabilities: {
        drop: ['ALL'],
        add: ['NET_BIND_SERVICE'] // Only if needed for low ports
      }
    };
  }

  /**
   * Load configuration templates
   */
  private loadConfigTemplates(): void {
    // Standard MCP server template
    this.configTemplates.set('standard', {
      memory: '512m',
      cpu: 1024,
      healthcheck: {
        test: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'],
        interval: '30s',
        timeout: '10s',
        retries: 3
      }
    });
    
    // High-performance template
    this.configTemplates.set('high-performance', {
      memory: '2g',
      cpu: 2048,
      ulimits: [
        { name: 'nofile', soft: 65536, hard: 65536 }
      ]
    });
    
    // Minimal resource template
    this.configTemplates.set('minimal', {
      memory: '128m',
      cpu: 512
    });
  }

  /**
   * Get available configuration templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.configTemplates.keys());
  }

  /**
   * Apply a configuration template
   */
  applyTemplate(mcpConfig: MCPServerConfig, templateName: string): MCPServerConfig {
    const template = this.configTemplates.get(templateName);
    if (!template) {
      throw new Error(`Configuration template not found: ${templateName}`);
    }
    
    return {
      ...mcpConfig,
      baseConfigOverrideJson: {
        ...mcpConfig.baseConfigOverrideJson,
        resources: {
          ...template,
          ...(mcpConfig.baseConfigOverrideJson?.resources || {})
        }
      }
    };
  }

  /**
   * Get network configuration for a group
   */
  getNetworkConfiguration(groupId: string): ContainerNetworkConfig | undefined {
    return this.networkConfigs.get(groupId);
  }

  /**
   * Update default resource limits
   */
  updateDefaultResourceLimits(limits: Partial<ContainerResourceConfig>): void {
    this.defaultResourceLimits = {
      ...this.defaultResourceLimits,
      ...limits
    };
    
    this.emit('defaultsUpdated', { resourceLimits: this.defaultResourceLimits });
  }

  /**
   * Update default security configuration
   */
  updateDefaultSecurityConfig(security: Partial<ContainerSecurityConfig>): void {
    this.defaultSecurityConfig = {
      ...this.defaultSecurityConfig,
      ...security
    };
    
    this.emit('defaultsUpdated', { securityConfig: this.defaultSecurityConfig });
  }

  /**
   * Generate configuration summary for audit purposes
   */
  generateConfigurationSummary(containerConfig: ContainerConfig): {
    securityFeatures: string[];
    resourceLimits: Record<string, any>;
    networkConfig: Record<string, any>;
    environmentVariableCount: number;
  } {
    const securityFeatures: string[] = [];
    
    if (containerConfig.HostConfig.ReadonlyRootfs) {
      securityFeatures.push('read-only-root-filesystem');
    }
    
    if (containerConfig.HostConfig.SecurityOpt?.includes('no-new-privileges:true')) {
      securityFeatures.push('no-new-privileges');
    }
    
    if (containerConfig.HostConfig.SecurityOpt?.some(opt => opt.startsWith('seccomp:'))) {
      securityFeatures.push('seccomp-profile');
    }
    
    return {
      securityFeatures,
      resourceLimits: {
        memory: containerConfig.HostConfig.Memory,
        cpuShares: containerConfig.HostConfig.CpuShares
      },
      networkConfig: {
        networkMode: containerConfig.HostConfig.NetworkMode,
        portBindings: containerConfig.HostConfig.PortBindings
      },
      environmentVariableCount: containerConfig.Env.length
    };
  }

  /**
   * Shutdown the configuration manager
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down ConfigurationManager...');
    
    this.configTemplates.clear();
    this.networkConfigs.clear();
    this.removeAllListeners();
    
    console.log('ConfigurationManager shutdown complete');
  }
} 