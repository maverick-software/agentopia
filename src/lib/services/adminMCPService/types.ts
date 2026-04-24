export interface MCPServerDeploymentConfig {
  serverName: string;
  serverType: string;
  dockerImage: string;
  transport: 'http' | 'stdio' | 'websocket';
  endpointPath?: string;
  environmentVariables?: Record<string, string>;
  portMappings?: Array<{ containerPort: number; hostPort: number }>;
  capabilities?: string[];
  resourceLimits?: {
    memory?: string;
    cpu?: string;
  };
  environmentId?: string;
}

export interface MCPServerDeployment {
  id: string;
  status: 'deploying' | 'running' | 'failed' | 'stopped';
  serverName: string;
  deployedAt: Date;
  estimatedReadyTime?: Date;
  error?: string;
}

export interface AdminOperationLog {
  id: string;
  adminUserId: string;
  operation: 'deploy' | 'start' | 'stop' | 'restart' | 'delete' | 'configure';
  serverId: string;
  serverName: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServerMetrics {
  serverId: string;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: { in: number; out: number };
  requestCount: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
}

export interface AdminDashboardStats {
  totalServers: number;
  runningServers: number;
  stoppedServers: number;
  errorServers: number;
  totalConnections: number;
  activeConnections: number;
  totalRequests: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

export interface LogFilters {
  operation?: string;
  serverId?: string;
  adminUserId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ToolboxEnvironment {
  id: string;
  name: string;
  publicIP: string;
  status: string;
  region?: string;
  size?: string;
  userId?: string;
}
