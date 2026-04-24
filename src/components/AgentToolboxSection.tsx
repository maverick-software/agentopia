import React, { useState } from 'react';
import { Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AgentMCPConnections } from './agent-toolbox/AgentMCPConnections';
import { ConnectionHealthMonitor } from './agent-toolbox/ConnectionHealthMonitor';
import { MCPServerDiscovery } from './agent-toolbox/MCPServerDiscovery';
import { MCPConnectionWizard } from './agent-toolbox/MCPConnectionWizard';
import type { AgentToolboxSectionProps } from './agent-toolbox/types';

const AgentToolboxSection: React.FC<AgentToolboxSectionProps> = ({ agentId }) => {
  const [mcpConnectionWizardOpen, setMcpConnectionWizardOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<{ id: string; name: string } | null>(null);

  const handleMCPConnect = (serverId: string, serverName: string) => {
    setSelectedServer({ id: serverId, name: serverName });
    setMcpConnectionWizardOpen(true);
  };

  const handleConnectionSuccess = () => {
    // Refresh connections - handled by real-time updates
    console.log('MCP connection successful');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Agent Toolbox & MCP Connections</h2>
        <p className="text-sm text-muted-foreground">
          Connect your agent to MCP servers to extend its capabilities with additional tools and services.
        </p>
      </div>

      {/* MCP Integration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            MCP Server Connections
          </CardTitle>
          <CardDescription>
            Connect your agent to MCP servers to extend its capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="connections" className="space-y-4">
            <TabsList>
              <TabsTrigger value="connections">Active Connections</TabsTrigger>
              <TabsTrigger value="discover">Discover Servers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connections">
              <AgentMCPConnections agentId={agentId} />
              <ConnectionHealthMonitor agentId={agentId} />
            </TabsContent>
            
            <TabsContent value="discover">
              <MCPServerDiscovery onConnect={handleMCPConnect} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Connection Wizard */}
      {selectedServer && (
        <MCPConnectionWizard
          agentId={agentId}
          serverId={selectedServer.id}
          serverName={selectedServer.name}
          isOpen={mcpConnectionWizardOpen}
          onClose={() => {
            setMcpConnectionWizardOpen(false);
            setSelectedServer(null);
          }}
          onSuccess={handleConnectionSuccess}
        />
      )}

      {/* Legacy Developer Note */}
      <div className="mt-6 p-4 border rounded-lg bg-secondary/50">
        <h2 className="text-lg font-semibold">Integration Complete</h2>
        <p className="text-sm text-muted-foreground">
          This component now integrates with the new MCP-DTMA infrastructure:
          • Server discovery and connection management
          • Real-time status monitoring and health checks
          • Connection wizard with testing capabilities
          • Integration with UserMCPService and StatusSyncService
        </p>
      </div>
    </div>
  );
};

export default AgentToolboxSection; 