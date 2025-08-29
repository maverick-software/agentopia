import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';

interface ChannelService {
  id: string;
  name: string;
  description?: string;
  icon: React.ComponentType<any>;
  gradient: string;
  type: 'oauth' | 'api_key' | 'coming_soon';
}

interface ChannelSetupCardProps {
  service: ChannelService;
  status: 'connected' | 'available' | 'coming_soon';
  isSetupMode: boolean;
  isSelectingCredential: boolean;
  connectingService: string | null;
  onSetupClick: (serviceId: string) => void;
  onSelectCredentialClick: (serviceId: string) => void;
  onCancelSetup: () => void;
  capabilitiesByIntegrationId?: Record<string, any>;
  renderSetupFlow?: (service: ChannelService) => React.ReactNode;
  renderCredentialSelector?: (serviceId: string) => React.ReactNode;
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
  ],
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

export function ChannelSetupCard({ 
  service, 
  status, 
  isSetupMode,
  isSelectingCredential,
  connectingService,
  onSetupClick,
  onSelectCredentialClick,
  onCancelSetup,
  capabilitiesByIntegrationId,
  renderSetupFlow,
  renderCredentialSelector
}: ChannelSetupCardProps) {
  const Icon = service.icon;
  const isConnected = status === 'connected';
  const isConnecting = connectingService === service.id;

  // Setup mode
  if (isSetupMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-medium">{service.name}</h3>
              <p className="text-sm text-muted-foreground">Setting up connection...</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelSetup}
          >
            Cancel
          </Button>
        </div>
        {renderSetupFlow?.(service)}
      </div>
    );
  }

  // Credential selection mode
  if (isSelectingCredential) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-medium">{service.name}</h3>
              <p className="text-sm text-muted-foreground">Select credential...</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelSetup}
          >
            Cancel
          </Button>
        </div>
        {renderCredentialSelector?.(service.id)}
      </div>
    );
  }

  // Normal card view
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{service.name}</h3>
          <p className="text-sm text-muted-foreground">{service.description}</p>
          {renderCapabilitiesBadges(service.id, undefined, capabilitiesByIntegrationId)}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {isConnected ? (
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Connected
            </Badge>
          </div>
        ) : status === 'coming_soon' ? (
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">Coming Soon</Badge>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              // ✅ FIXED: Check for existing credentials FIRST, regardless of service type
              onSelectCredentialClick(service.id);
            }}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}
