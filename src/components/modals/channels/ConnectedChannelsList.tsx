import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Plus } from 'lucide-react';
import { ChannelConnectionItem } from './ChannelConnectionItem';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface Integration {
  id: string;
  name: string;
  [key: string]: any;
}

interface ConnectedChannelsListProps {
  agentPermissions: AgentPermission[];
  integrations: Integration[];
  capabilitiesByIntegrationId?: Record<string, any>;
  onModifyPermissions: (connection: AgentPermission) => void;
  onRemoveSuccess: () => void;
  onAddChannel: () => void;
}

export function ConnectedChannelsList({ 
  agentPermissions, 
  integrations,
  capabilitiesByIntegrationId,
  onModifyPermissions,
  onRemoveSuccess,
  onAddChannel 
}: ConnectedChannelsListProps) {
  const channelConnections = agentPermissions.filter(p => p.is_active);

  if (channelConnections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Settings className="h-12 w-12 text-muted-foreground opacity-50" />
        <div className="text-center">
          <p className="text-muted-foreground font-medium">No channels connected</p>
          <p className="text-sm text-muted-foreground mt-1">Add a channel to get started</p>
        </div>
        <Button onClick={onAddChannel} className="mt-4">
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Button onClick={onAddChannel} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>
      
      <div className="space-y-4">
        {channelConnections.map((connection) => (
          <ChannelConnectionItem
            key={connection.id}
            connection={connection}
            integrations={integrations}
            capabilitiesByIntegrationId={capabilitiesByIntegrationId}
            onModifyPermissions={onModifyPermissions}
            onRemoveSuccess={onRemoveSuccess}
          />
        ))}
      </div>
    </div>
  );
}
