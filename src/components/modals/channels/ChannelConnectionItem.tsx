import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { RemoveChannelButton } from './RemoveChannelButton';

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

interface ChannelConnectionItemProps {
  connection: AgentPermission;
  integrations: Integration[];
  capabilitiesByIntegrationId?: Record<string, any>;
  onModifyPermissions: (connection: AgentPermission) => void;
  onRemoveSuccess: () => void;
}

// Static capability catalog per provider for display
const CAPABILITIES: Record<string, { id: string; label: string }[]> = {
  smtp: [
    { id: 'smtp_send_email', label: 'Send Email' },
    { id: 'smtp_configuration', label: 'SMTP Configuration' }
  ]
};

function renderCapabilitiesBadges(
  provider: string, 
  integrationId?: string, 
  capabilitiesByIntegrationId?: Record<string, any>
) {
  const dbCaps = integrationId ? (capabilitiesByIntegrationId as any)?.[integrationId] : null;
  const caps = dbCaps && dbCaps.length 
    ? dbCaps.map((c: any) => ({ key: c.capability_key, label: c.display_label })) 
    : (CAPABILITIES[provider?.toLowerCase()] || []);
    
  if (!caps || caps.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {caps.map((c: any) => (
        <Badge key={c.key || c.id} variant="secondary" className="text-xs">
          {c.label}
        </Badge>
      ))}
    </div>
  );
}

export function ChannelConnectionItem({ 
  connection, 
  integrations,
  capabilitiesByIntegrationId,
  onModifyPermissions,
  onRemoveSuccess 
}: ChannelConnectionItemProps) {
  const providerName = (connection as any).provider_name;
  
  // Find the matching channel integration for proper display info
  const matchedIntegration = integrations.find(i => 
    i.name.toLowerCase().includes(providerName?.toLowerCase() || '') ||
    providerName === 'smtp' && i.name.toLowerCase().includes('smtp')
  );
  
  // Determine display properties based on the matched integration or fallback to provider
  let name = matchedIntegration?.name || providerName;
  let gradient = 'from-zinc-500 to-zinc-600'; // default
  
  if (providerName === 'smtp') {
    name = matchedIntegration?.name || 'SMTP Server';
    gradient = 'from-green-500 to-emerald-500';
  } else if (matchedIntegration) {
    // Use integration name for other channel types
    name = matchedIntegration.name;
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Mail className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-medium">{name}</h3>
          <p className="text-sm text-muted-foreground">
            {(connection as any).external_username || 'Authorized'}
          </p>
          {renderCapabilitiesBadges(providerName, matchedIntegration?.id, capabilitiesByIntegrationId)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          Connected
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onModifyPermissions(connection)}
        >
          Modify Permissions
        </Button>
        <RemoveChannelButton
          connectionId={connection.id}
          connectionName={name}
          onRemoveSuccess={onRemoveSuccess}
        />
      </div>
    </div>
  );
}
