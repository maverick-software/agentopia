import { EnhancedMCPServer } from '../mcpService';

export interface AgentMCPConnection {
  id: string;
  agentId: string;
  mcpServerInstanceId: string;
  connectionConfig: ConnectionConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  usageStats?: ConnectionUsageStats;
  agent?: {
    id: string;
    name: string;
  };
  mcpServer?: {
    id: string;
    name: string;
    capabilities: string[];
    status: string;
  };
}

export interface ConnectionConfig {
  timeout?: number;
  retryAttempts?: number;
  customHeaders?: Record<string, string>;
  enableLogging?: boolean;
  maxConcurrentRequests?: number;
}

export interface ConnectionUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  bytesTransferred: number;
}

export interface ConnectionStatus {
  connectionId: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  serverStatus: string;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  uptime?: number;
  error?: string;
}

export interface UserMCPDashboard {
  connectedAgents: number;
  availableServers: number;
  activeConnections: number;
  totalRequests: number;
  connections: AgentMCPConnection[];
  availableServers: EnhancedMCPServer[];
  lastUpdated: Date;
}

export interface AgentToolbelt {
  agentId: string;
  agentName: string;
  mcpConnections: AgentMCPConnection[];
  availableCapabilities: string[];
  connectionHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  lastUpdated: Date;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}
