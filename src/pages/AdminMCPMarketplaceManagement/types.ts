import type { MCPServerTemplate } from '@/lib/mcp/ui-types';

export interface AdminMCPTemplate extends MCPServerTemplate {
  totalDeployments: number;
  activeDeployments: number;
  isVerified: boolean;
}

export interface LoadingState {
  templates: boolean;
  servers: boolean;
  connections: boolean;
  deployment: boolean;
}

export interface DashboardStats {
  totalTemplates: number;
  verifiedTemplates: number;
  totalDeployments: number;
  activeServers: number;
  totalConnections: number;
  errorRate: number;
}

export interface DropletSummary {
  id: string;
  name: string;
  publicIP: string;
  region?: string;
  size?: string;
  status: string;
}
