import React from 'react';
import { TestTube, Unplug } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import type { AgentMCPConnection } from './types';

export const ConnectionCard: React.FC<{
  connection: AgentMCPConnection;
  onDisconnect: () => void;
  onTest: () => void;
}> = ({ connection, onDisconnect, onTest }) => (
  <Card className="border-l-4 border-l-green-500">
    <CardContent className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{connection.serverName}</h4>
            <StatusBadge status={connection.status} size="sm" />
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Connected: {formatDistanceToNow(connection.connectedAt)} ago</span>
            {connection.lastUsed && (
              <>
                <span>•</span>
                <span>Last used: {formatDistanceToNow(connection.lastUsed)} ago</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onTest}>
            <TestTube className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={onDisconnect}>
            <Unplug className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
