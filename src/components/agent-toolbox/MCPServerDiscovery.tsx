import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { UserMCPService } from '@/lib/services/userMCPService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ServerCard } from './ServerCard';
import type { EnhancedMCPServer } from './types';

export const MCPServerDiscovery: React.FC<{ onConnect: (serverId: string, serverName: string) => void }> = ({
  onConnect,
}) => {
  const [availableServers, setAvailableServers] = useState<EnhancedMCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const userMCPService = useMemo(() => new UserMCPService(), []);

  const loadAvailableServers = async () => {
    try {
      setLoading(true);
      const servers = await userMCPService.getAvailableServers();
      setAvailableServers(servers);
    } catch (error) {
      console.error('Failed to load available servers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredServers = availableServers.filter(
    (server) =>
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.serverType.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Available MCP Servers</h3>
        <Button variant="outline" size="sm" onClick={loadAvailableServers}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Input
        placeholder="Search servers..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading available servers...</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredServers.map((server) => (
            <ServerCard key={server.id} server={server} onConnect={() => onConnect(server.id, server.name)} />
          ))}
          {filteredServers.length === 0 && <div className="text-center py-8 text-muted-foreground">No MCP servers available for connection</div>}
        </div>
      )}
    </div>
  );
};
