import React from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Server } from 'lucide-react';
import HealthMonitor from '@/components/HealthMonitor';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DTMAStatus, SystemMetrics } from './types';
import { formatBytes, formatTimestamp, getStatusColor, getStatusIcon } from './utils';

interface OverviewTabProps {
  toolboxId: string;
  dropletIp: string;
  dtmaStatus: DTMAStatus | null;
  systemMetrics: SystemMetrics | null;
  isLoading: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ toolboxId, dropletIp, dtmaStatus, systemMetrics, isLoading }) => (
  <div className="space-y-4">
    <HealthMonitor toolboxId={toolboxId} dropletIp={dropletIp} showSSHStatus={true} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>DTMA Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dtmaStatus ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(dtmaStatus.status)}
                <Badge className={getStatusColor(dtmaStatus.status)}>{dtmaStatus.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Version: {dtmaStatus.version}</p>
                <p>Service: {dtmaStatus.service}</p>
                <p>Updated: {formatTimestamp(dtmaStatus.timestamp)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Environment:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${dtmaStatus.environment.hasAuthToken ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>Auth Token</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${dtmaStatus.environment.hasApiKey ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>API Key</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${dtmaStatus.environment.hasApiBaseUrl ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>API URL</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Port {dtmaStatus.environment.port}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">{isLoading ? 'Loading...' : 'No status data available'}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {systemMetrics ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Cpu className="h-4 w-4 text-blue-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>CPU Load</span>
                    <span>{systemMetrics.cpu_load_percent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(systemMetrics.cpu_load_percent, 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MemoryStick className="h-4 w-4 text-green-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>Memory</span>
                    <span>
                      {formatBytes(systemMetrics.memory.used_bytes)} / {formatBytes(systemMetrics.memory.total_bytes)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(systemMetrics.memory.used_bytes / systemMetrics.memory.total_bytes) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <HardDrive className="h-4 w-4 text-purple-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>Disk ({systemMetrics.disk.mount})</span>
                    <span>
                      {formatBytes(systemMetrics.disk.used_bytes)} / {formatBytes(systemMetrics.disk.total_bytes)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(systemMetrics.disk.used_bytes / systemMetrics.disk.total_bytes) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No system metrics available</div>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
);
