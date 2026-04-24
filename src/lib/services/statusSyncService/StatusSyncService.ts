import type { SupabaseClient } from '@supabase/supabase-js';
import { MCPService, MCPServerStatus, EnhancedMCPServer } from '../mcpService';
import {
  calculateCacheHitRate,
  cleanupExpiredCache,
  clearCache,
  getFromCache,
  isCacheValid,
  updateStatusCache
} from './modules/cache';
import { createUnknownStatus, statusesEqual } from './modules/helpers';
import {
  fetchAllMCPServersRaw,
  fetchMCPServerByIdRaw,
  fetchServerForSync,
  fetchServersForSync,
  fetchStatusHistory,
  insertStatusChangeLog,
  mapRawToEnhancedServers
} from './modules/repository';
import {
  notifySubscribers,
  subscribe,
  subscribeToServer,
  unsubscribe,
  unsubscribeAll
} from './modules/subscriptions';
import {
  getWebSocketStatus,
  initializeWebSocket,
  publishStatusUpdate,
  reconnectWebSocket,
  stopWebSocket,
  type WebSocketHooks,
  type WebSocketRefs
} from './modules/websocket';
import {
  HeartbeatConfig,
  StatusCache,
  StatusSubscription,
  StatusUpdate,
  StatusUpdateFilter,
  SyncMetrics
} from './types';

export class StatusSyncService extends MCPService {
  private readonly statusCache = new Map<string, StatusCache>();
  private readonly subscriptions = new Map<string, StatusSubscription>();
  private syncInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private heartbeatConfig: HeartbeatConfig;
  private syncMetrics: SyncMetrics;
  private wsRefs: WebSocketRefs = {
    connection: null,
    heartbeatInterval: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
  };

  constructor(supabaseClient?: SupabaseClient, heartbeatConfig?: Partial<HeartbeatConfig>) {
    super(supabaseClient);
    this.heartbeatConfig = {
      interval: 30000,
      timeout: 10000,
      maxRetries: 3,
      backoffMultiplier: 2,
      healthCheckEndpoint: '/health',
      ...heartbeatConfig
    };
    this.syncMetrics = {
      totalServers: 0,
      activeServers: 0,
      errorServers: 0,
      lastSyncTime: new Date(),
      syncDuration: 0,
      statusChanges: 0,
      subscriptions: 0,
      cacheHitRate: 0
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('StatusSyncService is already running');
      return;
    }

    try {
      await this.initializeWebSocket();
      await this.startHeartbeatMonitoring();
      this.syncInterval = setInterval(async () => {
        try {
          await this.syncAllServerStatuses();
          cleanupExpiredCache(this.statusCache);
        } catch (error) {
          console.error('Error in periodic status sync:', error);
        }
      }, 60000);
      await this.syncAllServerStatuses();
      this.isRunning = true;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    stopWebSocket(this.wsRefs);
    this.unsubscribeAll();
    clearCache(this.statusCache);
  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async syncAllServerStatuses(): Promise<StatusUpdate[]> {
    const startTime = Date.now();
    const updates: StatusUpdate[] = [];
    const servers = await fetchServersForSync(this.supabase);
    this.syncMetrics.totalServers = servers.length;

    for (const server of servers) {
      try {
        const update = await this.syncServerStatus(server.id);
        if (update) {
          updates.push(update);
        }
      } catch (error) {
        console.error(`Error syncing server ${server.id}:`, error);
      }
    }

    this.syncMetrics.lastSyncTime = new Date();
    this.syncMetrics.syncDuration = Date.now() - startTime;
    this.syncMetrics.statusChanges += updates.length;
    this.syncMetrics.activeServers = Array.from(this.statusCache.values()).filter(
      (cache) => cache.status.state === 'running'
    ).length;
    this.syncMetrics.errorServers = Array.from(this.statusCache.values()).filter(
      (cache) => cache.status.health === 'unhealthy'
    ).length;

    return updates;
  }

  async syncServerStatus(serverId: string): Promise<StatusUpdate | null> {
    const server = await fetchServerForSync(this.supabase, serverId);
    const currentStatus = this.mapStatusToMCPStatus(
      server.status_on_toolbox,
      server.last_heartbeat_from_dtma
    );
    const previousStatus = getFromCache(this.statusCache, serverId)?.status;
    updateStatusCache(this.statusCache, serverId, currentStatus);

    if (previousStatus && statusesEqual(previousStatus, currentStatus)) {
      return null;
    }

    const update: StatusUpdate = {
      serverId,
      previousStatus: previousStatus || createUnknownStatus(),
      currentStatus,
      timestamp: new Date(),
      source: 'dtma',
      details: `Status changed from ${previousStatus?.state || 'unknown'} to ${currentStatus.state}`
    };

    await this.logStatusChange(update);
    this.notifySubscribers(update);
    return update;
  }

  async forceStatusUpdate(serverId: string, status: MCPServerStatus): Promise<void> {
    const previousStatus = getFromCache(this.statusCache, serverId)?.status;
    updateStatusCache(this.statusCache, serverId, status);

    const update: StatusUpdate = {
      serverId,
      previousStatus: previousStatus || createUnknownStatus(),
      currentStatus: status,
      timestamp: new Date(),
      source: 'manual',
      details: 'Manual status override'
    };

    await this.logStatusChange(update);
    this.notifySubscribers(update);
  }

  subscribe(callback: (update: StatusUpdate) => void, filters?: StatusUpdateFilter[]): string {
    const id = subscribe(this.subscriptions, callback, filters);
    this.syncMetrics.subscriptions = this.subscriptions.size;
    return id;
  }

  subscribeToServer(serverId: string, callback: (update: StatusUpdate) => void): string {
    const id = subscribeToServer(this.subscriptions, serverId, callback);
    this.syncMetrics.subscriptions = this.subscriptions.size;
    return id;
  }

  unsubscribe(subscriptionId: string): void {
    if (unsubscribe(this.subscriptions, subscriptionId)) {
      this.syncMetrics.subscriptions = this.subscriptions.size;
    }
  }

  unsubscribeAll(): void {
    unsubscribeAll(this.subscriptions);
    this.syncMetrics.subscriptions = 0;
  }

  async getServerStatus(serverId: string): Promise<MCPServerStatus> {
    const cached = getFromCache(this.statusCache, serverId);
    if (cached && isCacheValid(cached)) {
      return cached.status;
    }

    const update = await this.syncServerStatus(serverId);
    return update?.currentStatus || createUnknownStatus();
  }

  async getAllServerStatuses(): Promise<Record<string, MCPServerStatus>> {
    await this.syncAllServerStatuses();
    const statuses: Record<string, MCPServerStatus> = {};
    for (const [serverId, cache] of this.statusCache.entries()) {
      statuses[serverId] = cache.status;
    }

    return statuses;
  }

  async getServersByStatus(status: string): Promise<EnhancedMCPServer[]> {
    const servers = await this.getAllMCPServers();
    const results: EnhancedMCPServer[] = [];
    for (const server of servers) {
      const serverStatus = await this.getServerStatus(server.id.toString());
      if (serverStatus.state === status) {
        results.push(server);
      }
    }

    return results;
  }

  async getServersByHealth(health: string): Promise<EnhancedMCPServer[]> {
    const servers = await this.getAllMCPServers();
    const results: EnhancedMCPServer[] = [];
    for (const server of servers) {
      const serverStatus = await this.getServerStatus(server.id.toString());
      if (serverStatus.health === health) {
        results.push(server);
      }
    }

    return results;
  }

  async startHeartbeatMonitoring(): Promise<void> {
    if (this.heartbeatInterval) {
      console.warn('Heartbeat monitoring already running');
      return;
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.performBulkHeartbeatCheck();
      } catch (error) {
        console.error('Error in heartbeat monitoring:', error);
      }
    }, this.heartbeatConfig.interval);
    await this.performBulkHeartbeatCheck();
  }

  async stopHeartbeatMonitoring(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async performHeartbeatCheck(serverId: string): Promise<boolean> {
    try {
      const server = await this.getMCPServerById(serverId);
      if (!server) {
        return false;
      }

      const healthUrl = `${server.endpoint}${this.heartbeatConfig.healthCheckEndpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.heartbeatConfig.timeout);

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'Gofr-Agents-StatusSync/1.0' }
        });
        clearTimeout(timeoutId);
        const isHealthy = response.ok;

        if (!isHealthy) {
          const currentStatus = getFromCache(this.statusCache, serverId)?.status;
          if (currentStatus && currentStatus.health !== 'unhealthy') {
            await this.forceStatusUpdate(serverId, {
              ...currentStatus,
              health: 'unhealthy',
              lastError: `Health check failed: HTTP ${response.status}`
            });
          }
        }
        return isHealthy;
      } catch (error) {
        clearTimeout(timeoutId);
        const currentStatus = getFromCache(this.statusCache, serverId)?.status;
        if (currentStatus && currentStatus.health !== 'unhealthy') {
          await this.forceStatusUpdate(serverId, {
            ...currentStatus,
            health: 'unhealthy',
            lastError: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
        return false;
      }
    } catch (error) {
      console.error(`Error in heartbeat check for server ${serverId}:`, error);
      return false;
    }
  }

  async performBulkHeartbeatCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const servers = await this.getRunningMCPServers();
    const concurrencyLimit = 5;
    for (let i = 0; i < servers.length; i += concurrencyLimit) {
      const chunk = servers.slice(i, i + concurrencyLimit);
      await Promise.all(
        chunk.map(async (server) => {
          const result = await this.performHeartbeatCheck(server.id.toString());
          results[server.id.toString()] = result;
        })
      );
    }

    return results;
  }

  async getSyncMetrics(): Promise<SyncMetrics> {
    this.syncMetrics.cacheHitRate = calculateCacheHitRate(this.statusCache);
    return { ...this.syncMetrics };
  }

  async getStatusHistory(serverId: string, hours = 24): Promise<StatusUpdate[]> {
    try {
      return await fetchStatusHistory(this.supabase, serverId, hours);
    } catch (error) {
      console.error(`Error fetching status history for ${serverId}:`, error);
      return [];
    }
  }

  publishStatusUpdate(topic: string, data: any): void {
    publishStatusUpdate(this.wsRefs, topic, data);
  }

  getWebSocketStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    return getWebSocketStatus(this.wsRefs);
  }

  private async initializeWebSocket(): Promise<void> {
    const hooks: WebSocketHooks = {
      getIsRunning: () => this.isRunning,
      onStatusUpdate: (serverId: string) => {
        this.syncServerStatus(serverId).catch((error) => {
          console.error(`Error processing WebSocket status update for ${serverId}:`, error);
        });
      },
      onReconnect: async () => {
        await initializeWebSocket(this.wsRefs, hooks);
      }
    };

    try {
      await initializeWebSocket(this.wsRefs, hooks);
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private notifySubscribers(update: StatusUpdate): void {
    notifySubscribers(this.subscriptions, update);
  }

  private async logStatusChange(update: StatusUpdate): Promise<void> {
    try {
      await insertStatusChangeLog(this.supabase, update);
    } catch (error) {
      console.error('Failed to log status change:', error);
    }
  }

  private async getRunningMCPServers(): Promise<EnhancedMCPServer[]> {
    return this.getServersByStatus('running');
  }

  private async getAllMCPServers(): Promise<EnhancedMCPServer[]> {
    const rawRecords = await fetchAllMCPServersRaw(this.supabase);
    return mapRawToEnhancedServers(rawRecords, this.transformToEnhancedMCPServer.bind(this));
  }

  private async getMCPServerById(serverId: string): Promise<EnhancedMCPServer | null> {
    const record = await fetchMCPServerByIdRaw(this.supabase, serverId);
    if (!record) {
      return null;
    }

    return this.transformToEnhancedMCPServer(record);
  }
}

