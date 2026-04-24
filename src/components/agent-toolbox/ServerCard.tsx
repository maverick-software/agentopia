import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import type { EnhancedMCPServer } from './types';

export const ServerCard: React.FC<{ server: EnhancedMCPServer; onConnect: () => void }> = ({ server, onConnect }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium">{server.name}</h4>
            <StatusBadge status={server.status} />
            <Badge variant="outline">{server.serverType}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{server.description || 'No description available'}</p>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Transport: {server.transport}</span>
            <span>•</span>
            <span>Capabilities: {server.capabilities?.length || 0}</span>
          </div>
        </div>
        <Button size="sm" onClick={onConnect} disabled={server.status !== 'running'}>
          Connect
        </Button>
      </div>
    </CardContent>
  </Card>
);
