export interface EnhancedMCPServer {
  id: string;
  name: string;
  description?: string;
  serverType: string;
  transport: string;
  status: 'running' | 'stopped' | 'error' | 'deploying';
  capabilities?: string[];
  endpoint?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMCPConnection {
  id: string;
  agentId: string;
  serverId: string;
  serverName: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  connectedAt: Date;
  lastUsed?: Date;
  config: {
    timeout: number;
    retryAttempts: number;
    enableLogging: boolean;
  };
}

export interface ConnectionHealth {
  connectionId: string;
  serverName: string;
  status: 'healthy' | 'warning' | 'error';
  latency: number;
  lastCheck: Date;
}

export interface AgentToolboxSectionProps {
  agentId: string;
}
