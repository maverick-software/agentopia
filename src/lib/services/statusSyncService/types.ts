import { MCPServerStatus } from '../mcpService';

export interface StatusUpdate {
  serverId: string;
  previousStatus: MCPServerStatus;
  currentStatus: MCPServerStatus;
  timestamp: Date;
  source: 'dtma' | 'heartbeat' | 'manual' | 'system';
  details?: string;
}

export interface StatusSubscription {
  id: string;
  serverId?: string;
  callback: (update: StatusUpdate) => void;
  filters?: StatusUpdateFilter[];
  isActive: boolean;
  createdAt: Date;
}

export interface StatusUpdateFilter {
  type: 'status_change' | 'health_change' | 'error_state' | 'recovery';
  serverIds?: string[];
  statusStates?: string[];
  healthLevels?: string[];
}

export interface StatusCache {
  serverId: string;
  status: MCPServerStatus;
  lastUpdated: Date;
  lastChecked: Date;
  checkCount: number;
  errorCount: number;
}

export interface SyncMetrics {
  totalServers: number;
  activeServers: number;
  errorServers: number;
  lastSyncTime: Date;
  syncDuration: number;
  statusChanges: number;
  subscriptions: number;
  cacheHitRate: number;
}

export interface HeartbeatConfig {
  interval: number;
  timeout: number;
  maxRetries: number;
  backoffMultiplier: number;
  healthCheckEndpoint: string;
}

