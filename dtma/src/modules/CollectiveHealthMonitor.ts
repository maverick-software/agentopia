import { EventEmitter } from 'events';
import { inspectContainer } from '../docker_manager.js';
import axios from 'axios';

export interface MCPServerHealthConfig {
  containerId: string;
  mcpEndpointPath: string;
  transportType: 'stdio' | 'sse' | 'websocket';
  expectedCapabilities: Record<string, any>;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  failureThreshold?: number;
  recoveryThreshold?: number;
}

export interface HealthCheckResult {
  instanceName: string;
  timestamp: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  errorMessage?: string;
  containerStatus?: string;
  mcpCapabilities?: Record<string, any>;
  details: {
    containerRunning: boolean;
    mcpEndpointReachable: boolean;
    capabilitiesMatch: boolean;
    resourceUsage?: {
      cpuPercent: number;
      memoryUsage: number;
      memoryLimit: number;
    };
  };
}

export interface GroupHealthStatus {
  groupId: string;
  totalServers: number;
  healthyServers: number;
  degradedServers: number;
  failedServers: number;
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'failed';
  lastChecked: Date;
  averageResponseTime?: number;
}

/**
 * CollectiveHealthMonitor - Monitors health of multiple MCP servers
 * 
 * Features:
 * - Individual server health checks (container + MCP protocol)
 * - Group-level health aggregation
 * - Automatic failure detection and recovery tracking
 * - Performance metrics collection
 * - Configurable thresholds and intervals
 * - Event-driven health status notifications
 */
export class CollectiveHealthMonitor extends EventEmitter {
  private monitoredServers = new Map<string, MCPServerHealthConfig>();
  private serverGroups = new Map<string, Set<string>>();
  private healthHistory = new Map<string, HealthCheckResult[]>();
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private failureCounts = new Map<string, number>();
  private recoveryAttempts = new Map<string, number>();
  
  private readonly DEFAULT_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly DEFAULT_FAILURE_THRESHOLD = 3;
  private readonly DEFAULT_RECOVERY_THRESHOLD = 2;
  private readonly MAX_HISTORY_SIZE = 100;
  
  private isShuttingDown = false;

  constructor() {
    super();
    console.log('CollectiveHealthMonitor initialized');
  }

  /**
   * Register an MCP server for health monitoring
   */
  registerMCPServer(instanceName: string, config: MCPServerHealthConfig): void {
    console.log(`Registering MCP server for health monitoring: ${instanceName}`);
    
    const fullConfig: MCPServerHealthConfig = {
      ...config,
      healthCheckInterval: config.healthCheckInterval || this.DEFAULT_CHECK_INTERVAL,
      healthCheckTimeout: config.healthCheckTimeout || this.DEFAULT_TIMEOUT,
      failureThreshold: config.failureThreshold || this.DEFAULT_FAILURE_THRESHOLD,
      recoveryThreshold: config.recoveryThreshold || this.DEFAULT_RECOVERY_THRESHOLD
    };
    
    this.monitoredServers.set(instanceName, fullConfig);
    this.healthHistory.set(instanceName, []);
    this.failureCounts.set(instanceName, 0);
    this.recoveryAttempts.set(instanceName, 0);
    
    // Start individual monitoring
    this.startIndividualMonitoring(instanceName);
    
    this.emit('serverRegistered', { instanceName, config: fullConfig });
  }

  /**
   * Unregister an MCP server from monitoring
   */
  unregisterMCPServer(instanceName: string): void {
    console.log(`Unregistering MCP server from health monitoring: ${instanceName}`);
    
    // Stop monitoring interval
    const interval = this.monitoringIntervals.get(instanceName);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(instanceName);
    }
    
    // Clean up data
    this.monitoredServers.delete(instanceName);
    this.healthHistory.delete(instanceName);
    this.failureCounts.delete(instanceName);
    this.recoveryAttempts.delete(instanceName);
    
    // Remove from groups
    for (const serverSet of this.serverGroups.values()) {
      serverSet.delete(instanceName);
    }
    
    this.emit('serverUnregistered', { instanceName });
  }

  /**
   * Start monitoring a group of MCP servers
   */
  startGroupMonitoring(groupId: string, instanceNames: string[]): void {
    console.log(`Starting group monitoring for: ${groupId} with ${instanceNames.length} servers`);
    
    const serverSet = new Set(instanceNames);
    this.serverGroups.set(groupId, serverSet);
    
    // Start group-level health aggregation
    this.startGroupAggregation(groupId);
    
    this.emit('groupMonitoringStarted', { groupId, instanceNames });
  }

  /**
   * Stop monitoring a group of MCP servers
   */
  stopGroupMonitoring(groupId: string): void {
    console.log(`Stopping group monitoring for: ${groupId}`);
    
    this.serverGroups.delete(groupId);
    
    this.emit('groupMonitoringStopped', { groupId });
  }

  /**
   * Perform health check on a specific MCP server
   */
  async performHealthCheck(instanceName: string): Promise<HealthCheckResult> {
    const config = this.monitoredServers.get(instanceName);
    if (!config) {
      throw new Error(`MCP server ${instanceName} not registered for monitoring`);
    }
    
    const startTime = Date.now();
    const result: HealthCheckResult = {
      instanceName,
      timestamp: new Date(),
      status: 'unknown',
      details: {
        containerRunning: false,
        mcpEndpointReachable: false,
        capabilitiesMatch: false
      }
    };
    
    try {
      // 1. Check container status
      const containerInfo = await inspectContainer(config.containerId);
      result.details.containerRunning = containerInfo.State.Running;
      result.containerStatus = containerInfo.State.Status;
      
      if (!containerInfo.State.Running) {
        result.status = 'unhealthy';
        result.errorMessage = `Container not running: ${containerInfo.State.Status}`;
        return result;
      }
      
      // 2. Extract basic container info (Stats not available in inspect)
      // Note: Container stats would require separate docker.stats() call
      // For now, we'll skip resource usage in health checks
      
      // 3. Check MCP endpoint reachability and capabilities
      const mcpHealth = await this.checkMCPEndpoint(instanceName, config);
      result.details.mcpEndpointReachable = mcpHealth.reachable;
      result.details.capabilitiesMatch = mcpHealth.capabilitiesMatch;
      result.mcpCapabilities = mcpHealth.capabilities;
      
      if (mcpHealth.error) {
        result.errorMessage = mcpHealth.error;
      }
      
      // 4. Determine overall health status
      if (result.details.containerRunning && 
          result.details.mcpEndpointReachable && 
          result.details.capabilitiesMatch) {
        result.status = 'healthy';
      } else {
        result.status = 'unhealthy';
      }
      
      result.responseTime = Date.now() - startTime;
      
    } catch (error: any) {
      result.status = 'unhealthy';
      result.errorMessage = error.message;
      result.responseTime = Date.now() - startTime;
      console.error(`Health check failed for ${instanceName}:`, error);
    }
    
    // Update health history
    this.updateHealthHistory(instanceName, result);
    
    // Update failure/recovery counts
    this.updateFailureTracking(instanceName, result);
    
    return result;
  }

  /**
   * Check MCP endpoint health and capabilities
   */
  private async checkMCPEndpoint(
    instanceName: string, 
    config: MCPServerHealthConfig
  ): Promise<{ reachable: boolean; capabilitiesMatch: boolean; capabilities?: any; error?: string }> {
    
    try {
      // Get container port mappings
      const containerInfo = await inspectContainer(config.containerId);
      const portBindings = containerInfo.NetworkSettings.Ports;
      
      let endpointUrl = '';
      
      // Find the exposed port for MCP endpoint
      for (const [, hostBindings] of Object.entries(portBindings)) {
        if (hostBindings && hostBindings.length > 0 && hostBindings[0]) {
          const hostPort = hostBindings[0].HostPort;
          endpointUrl = `http://localhost:${hostPort}${config.mcpEndpointPath}`;
          break;
        }
      }
      
      if (!endpointUrl) {
        return { 
          reachable: false, 
          capabilitiesMatch: false, 
          error: 'No exposed ports found for MCP endpoint' 
        };
      }
      
      // Health check based on transport type
      let mcpResponse: any;
      
      switch (config.transportType) {
        case 'sse':
          mcpResponse = await this.checkSSEEndpoint(endpointUrl, config.healthCheckTimeout!);
          break;
        case 'websocket':
          mcpResponse = await this.checkWebSocketEndpoint(endpointUrl, config.healthCheckTimeout!);
          break;
        case 'stdio':
          // For stdio, we can only check if the container is running and healthy
          mcpResponse = { reachable: true, capabilities: {} };
          break;
        default:
          throw new Error(`Unsupported transport type: ${config.transportType}`);
      }
      
      // Check capabilities match
      const capabilitiesMatch = this.checkCapabilitiesMatch(
        mcpResponse.capabilities || {},
        config.expectedCapabilities
      );
      
      return {
        reachable: mcpResponse.reachable,
        capabilitiesMatch,
        capabilities: mcpResponse.capabilities
      };
      
    } catch (error: any) {
      return { 
        reachable: false, 
        capabilitiesMatch: false, 
        error: error.message 
      };
    }
  }

  /**
   * Check SSE endpoint health
   */
  private async checkSSEEndpoint(url: string, timeout: number): Promise<{ reachable: boolean; capabilities?: any }> {
    try {
      const response = await axios.get(`${url}/capabilities`, {
        timeout,
        headers: { 'Accept': 'application/json' }
      });
      
      return {
        reachable: response.status === 200,
        capabilities: response.data
      };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return { reachable: false };
      }
      throw error;
    }
  }

  /**
   * Check WebSocket endpoint health
   */
  private async checkWebSocketEndpoint(url: string, timeout: number): Promise<{ reachable: boolean; capabilities?: any }> {
    return new Promise((resolve, reject) => {
      const wsUrl = url.replace('http://', 'ws://');
      
      try {
        // For now, we'll do a simple HTTP check to the WebSocket endpoint
        // In a full implementation, we'd use a WebSocket library
        const httpUrl = url.replace('/ws', '/health'); // Common pattern
        
        axios.get(httpUrl, { timeout })
          .then(response => {
            resolve({
              reachable: response.status === 200,
              capabilities: response.data
            });
          })
          .catch(() => {
            // Fallback: if health endpoint doesn't exist, just check base endpoint
            axios.get(url.replace('/ws', ''), { timeout })
              .then(() => resolve({ reachable: true, capabilities: {} }))
              .catch(() => resolve({ reachable: false }));
          });
      } catch (error) {
        resolve({ reachable: false });
      }
    });
  }

  /**
   * Check if actual capabilities match expected capabilities
   */
  private checkCapabilitiesMatch(actual: any, expected: any): boolean {
    if (!expected || Object.keys(expected).length === 0) {
      return true; // No specific capabilities required
    }
    
    try {
      // Simple capability matching - can be enhanced based on MCP spec
      for (const [key, value] of Object.entries(expected)) {
        if (!(key in actual) || actual[key] !== value) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate CPU percentage from container stats
   */
  private calculateCpuPercent(stats: any): number {
    try {
      if (!stats.cpu_stats || !stats.precpu_stats) {
        return 0;
      }
      
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuCount = stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
      
      if (systemDelta > 0 && cpuDelta > 0) {
        return (cpuDelta / systemDelta) * cpuCount * 100;
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Update health history for a server
   */
  private updateHealthHistory(instanceName: string, result: HealthCheckResult): void {
    const history = this.healthHistory.get(instanceName) || [];
    history.push(result);
    
    // Keep only recent history
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    this.healthHistory.set(instanceName, history);
  }

  /**
   * Update failure and recovery tracking
   */
  private updateFailureTracking(instanceName: string, result: HealthCheckResult): void {
    const config = this.monitoredServers.get(instanceName);
    if (!config) return;
    
    const currentFailures = this.failureCounts.get(instanceName) || 0;
    const currentRecovery = this.recoveryAttempts.get(instanceName) || 0;
    
    if (result.status === 'unhealthy') {
      const newFailureCount = currentFailures + 1;
      this.failureCounts.set(instanceName, newFailureCount);
      this.recoveryAttempts.set(instanceName, 0); // Reset recovery counter
      
      // Emit failure event if threshold reached
      if (newFailureCount >= config.failureThreshold!) {
        this.emit('serverHealthChange', {
          instanceName,
          healthStatus: 'unhealthy',
          failureCount: newFailureCount,
          details: result
        });
      }
      
    } else if (result.status === 'healthy') {
      const newRecoveryCount = currentRecovery + 1;
      this.recoveryAttempts.set(instanceName, newRecoveryCount);
      
      // Reset failure count and emit recovery if threshold reached
      if (currentFailures > 0 && newRecoveryCount >= config.recoveryThreshold!) {
        this.failureCounts.set(instanceName, 0);
        this.recoveryAttempts.set(instanceName, 0);
        
        this.emit('serverHealthChange', {
          instanceName,
          healthStatus: 'healthy',
          recoveryCount: newRecoveryCount,
          details: result
        });
      }
    }
  }

  /**
   * Start individual server monitoring
   */
  private startIndividualMonitoring(instanceName: string): void {
    const config = this.monitoredServers.get(instanceName);
    if (!config || this.isShuttingDown) return;
    
    // Clear existing interval if any
    const existingInterval = this.monitoringIntervals.get(instanceName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Start new monitoring interval
    const interval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        await this.performHealthCheck(instanceName);
      } catch (error) {
        console.error(`Health check interval failed for ${instanceName}:`, error);
      }
    }, config.healthCheckInterval!);
    
    this.monitoringIntervals.set(instanceName, interval);
    
    // Perform initial health check
    setTimeout(() => this.performHealthCheck(instanceName), 1000);
  }

  /**
   * Start group-level health aggregation
   */
  private startGroupAggregation(groupId: string): void {
    // Group aggregation runs every 30 seconds
    const groupInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      this.aggregateGroupHealth(groupId);
    }, 30000);
    
    // Store group interval for cleanup (could extend data structure)
    // For now, we'll let it be managed by the main monitoring intervals
  }

  /**
   * Aggregate health status for a group
   */
  private aggregateGroupHealth(groupId: string): void {
    const serverSet = this.serverGroups.get(groupId);
    if (!serverSet) return;
    
    const servers = Array.from(serverSet);
    let healthyCount = 0;
    let degradedCount = 0;
    let failedCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    for (const instanceName of servers) {
      const history = this.healthHistory.get(instanceName);
      if (history && history.length > 0) {
        const latest = history[history.length - 1];
        
        if (latest) {
          switch (latest.status) {
            case 'healthy':
              healthyCount++;
              break;
            case 'unhealthy':
              // Check if it's degraded (some services working) or failed (nothing working)
              if (latest.details.containerRunning) {
                degradedCount++;
              } else {
                failedCount++;
              }
              break;
            default:
              degradedCount++; // Unknown status counts as degraded
          }
          
          if (latest.responseTime) {
            totalResponseTime += latest.responseTime;
            responseTimeCount++;
          }
        } else {
          degradedCount++; // No valid latest result
        }
      } else {
        degradedCount++; // No history means unknown/degraded state
      }
    }
    
    const totalServers = servers.length;
    const groupStatus: GroupHealthStatus = {
      groupId,
      totalServers,
      healthyServers: healthyCount,
      degradedServers: degradedCount,
      failedServers: failedCount,
      overallStatus: this.calculateOverallStatus(healthyCount, degradedCount, failedCount, totalServers),
      lastChecked: new Date(),
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : undefined
    };
    
    this.emit('groupHealthUpdate', groupStatus);
  }

  /**
   * Calculate overall group status
   */
  private calculateOverallStatus(
    healthy: number, 
    degraded: number, 
    failed: number, 
    total: number
  ): 'healthy' | 'degraded' | 'critical' | 'failed' {
    if (healthy === total) return 'healthy';
    if (failed === total) return 'failed';
    if (healthy === 0) return 'critical';
    return 'degraded';
  }

  /**
   * Get current health status for a server
   */
  getServerHealth(instanceName: string): HealthCheckResult | null {
    const history = this.healthHistory.get(instanceName);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get health history for a server
   */
  getServerHealthHistory(instanceName: string, limit?: number): HealthCheckResult[] {
    const history = this.healthHistory.get(instanceName) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Get current group health status
   */
  getGroupHealth(groupId: string): GroupHealthStatus | null {
    const serverSet = this.serverGroups.get(groupId);
    if (!serverSet) return null;
    
    // Calculate on-demand group health
    this.aggregateGroupHealth(groupId);
    
    // This would typically return cached status, but for simplicity we'll recalculate
    const servers = Array.from(serverSet);
    let healthyCount = 0;
    let degradedCount = 0;
    let failedCount = 0;
    
    for (const instanceName of servers) {
      const latest = this.getServerHealth(instanceName);
      if (latest) {
        switch (latest.status) {
          case 'healthy':
            healthyCount++;
            break;
          case 'unhealthy':
            if (latest.details.containerRunning) {
              degradedCount++;
            } else {
              failedCount++;
            }
            break;
          default:
            degradedCount++;
        }
      } else {
        degradedCount++;
      }
    }
    
    return {
      groupId,
      totalServers: servers.length,
      healthyServers: healthyCount,
      degradedServers: degradedCount,
      failedServers: failedCount,
      overallStatus: this.calculateOverallStatus(healthyCount, degradedCount, failedCount, servers.length),
      lastChecked: new Date()
    };
  }

  /**
   * Shutdown the health monitor
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down CollectiveHealthMonitor...');
    this.isShuttingDown = true;
    
    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    this.removeAllListeners();
    
    console.log('CollectiveHealthMonitor shutdown complete');
  }
} 