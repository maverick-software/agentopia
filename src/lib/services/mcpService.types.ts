import { MCPServer } from '../mcp/ui-types';

export interface MCPServerStatus {
  state: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'unknown';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime?: number;
  lastStarted?: Date;
  lastError?: string;
}

export interface ConnectionTest {
  success: boolean;
  error?: string;
  latency?: number;
  capabilities?: string[];
  timestamp: Date;
}

export interface EnhancedMCPServer extends MCPServer {
  environment: {
    id: string;
    name: string;
    publicIP: string;
    privateIP: string;
    region: string;
    size: string;
  };
  endpoint: string;
  lastHeartbeat: Date | null;
  serverType: string;
  transport: 'http' | 'stdio' | 'websocket';
  discoveryMetadata: Record<string, any>;
}
