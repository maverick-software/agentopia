import React, { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { UserMCPService } from '@/lib/services/userMCPService';
import { Card } from '@/components/ui/card';
import type { ConnectionHealth } from './types';

export const ConnectionHealthMonitor: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [healthData, setHealthData] = useState<ConnectionHealth[]>([]);
  const userMCPService = useMemo(() => new UserMCPService(), []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const health = await userMCPService.getConnectionHealth(agentId);
        setHealthData(health);
      } catch (error) {
        console.error('Failed to fetch connection health:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [agentId, userMCPService]);

  if (healthData.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Connection Health
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {healthData.map((health) => (
          <Card key={health.connectionId} className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium truncate">{health.serverName}</span>
              <div className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    health.status === 'healthy' ? 'bg-green-500' : health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-xs text-muted-foreground">{health.latency}ms</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
