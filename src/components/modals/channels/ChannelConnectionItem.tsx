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
  gmail: [
    { id: 'send_email', label: 'Send Email' },
    { id: 'read_emails', label: 'Read Emails' },
    { id: 'modify_emails', label: 'Modify Labels' }
  ],
  sendgrid: [
    { id: 'send_email', label: 'Send Email' },
    { id: 'inbound', label: 'Inbound Routing' },
    { id: 'templates', label: 'Templates' },
    { id: 'analytics', label: 'Analytics' }
  ],
  mailgun: [
    { id: 'send_email', label: 'Send Email' },
    { id: 'validate', label: 'Validate Email' },
    { id: 'stats', label: 'Stats' },
    { id: 'suppressions', label: 'Suppressions' }
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
  const isSendGrid = providerName === 'sendgrid';
  const isMailgun = providerName === 'mailgun';
  
  const gradient = isSendGrid
    ? 'from-blue-500 to-indigo-500'
    : isMailgun
    ? 'from-rose-500 to-pink-500'
    : 'from-red-500 to-orange-500';
    
  const name = isSendGrid ? 'SendGrid' : isMailgun ? 'Mailgun' : 'Gmail';
  const matched = integrations.find(i => i.name.toLowerCase().includes((providerName || '').toLowerCase()));

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
          {renderCapabilitiesBadges(providerName, matched?.id, capabilitiesByIntegrationId)}
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
