import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Server } from 'lucide-react';
import { UserMCPService } from '@/lib/services/userMCPService';
import { StatusSyncService } from '@/lib/services/statusSyncService';
import { Badge } from '@/components/ui/badge';
import { ConnectionCard } from './ConnectionCard';
import type { AgentMCPConnection } from './types';

export const AgentMCPConnections: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [connections, setConnections] = useState<AgentMCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const userMCPService = useMemo(() => new UserMCPService(), []);
  const statusSyncService = useMemo(() => new StatusSyncService(), []);

  const loadAgentConnections = async () => {
    try {
      setLoading(true);
      const agentConnections = await userMCPService.getAgentConnections(agentId);
      setConnections(agentConnections);
    } catch (error) {
      console.error('Failed to load agent connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentConnections();
    const subscription = statusSyncService.subscribe(`agent:${agentId}:connections`, (updates) => {
      setConnections(updates);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleDisconnect = async (connectionId: string) => {
    try {
      await userMCPService.disconnectAgent(agentId, connectionId);
      await loadAgentConnections();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    try {
      const result = await userMCPService.testConnection(connectionId);
      console.log('Connection test result:', result);
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active MCP Connections</h3>
        <Badge variant="outline">{connections.length} connected</Badge>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No MCP servers connected</p>
          <p className="text-xs">Connect to MCP servers to enhance your agent's capabilities</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onDisconnect={() => handleDisconnect(connection.id)}
              onTest={() => handleTestConnection(connection.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
