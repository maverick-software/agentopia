import { Eye, Play, Plus, Server, Square, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EnhancedMCPServer } from '@/lib/services/mcpService';

interface ServersTabProps {
  loading: boolean;
  servers: EnhancedMCPServer[];
  onBrowseTemplates: () => void;
  onSelectServer: (server: EnhancedMCPServer) => void;
  onStopServer: (serverId: string) => void;
  onStartServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
}

export function ServersTab({
  loading,
  servers,
  onBrowseTemplates,
  onSelectServer,
  onStopServer,
  onStartServer,
  onDeleteServer,
}: ServersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployed MCP Servers</CardTitle>
        <p className="text-sm text-muted-foreground">MCP servers currently deployed to DigitalOcean droplets</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading deployed servers...</div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Deployed Servers</h3>
            <p className="text-sm mb-4">No MCP servers are currently deployed to your droplets. Deploy a template to get started.</p>
            <Button onClick={onBrowseTemplates}>
              <Plus className="w-4 h-4 mr-2" />
              Browse Templates
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{server.name}</h3>
                    <Badge
                      variant={server.status.state === 'running' ? 'default' : 'secondary'}
                      className={server.status.state === 'running' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {server.status.state}
                    </Badge>
                    <Badge variant="outline">{server.serverType}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">Endpoint: {server.endpoint}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Environment: {server.environment.name}</span>
                    <span>Region: {server.environment.region}</span>
                    <span>Health: {server.health.overall}</span>
                    {server.lastHeartbeat && <span>Last seen: {server.lastHeartbeat.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onSelectServer(server)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {server.status.state === 'running' ? (
                    <Button variant="outline" size="sm" onClick={() => onStopServer(server.id.toString())}>
                      <Square className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onStartServer(server.id.toString())}>
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => onDeleteServer(server.id.toString())}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
