import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

interface Connection {
  connection_id?: string;
  id?: string;
  provider_name: string;
  provider_display_name?: string;
  connection_name?: string;
  external_username?: string | null;
  connection_status: string;
}

interface ChannelCredentialSelectorProps {
  serviceId: string;
  agentId: string;
  userId?: string;
  connections: Connection[];
  supabase: any;
  fetchAgentPermissions: () => Promise<void>;
  providerNameForServiceId: (serviceId: string) => string;
  defaultScopesForService: (serviceId: string) => string[];
  onSelectCredentialFor: (serviceId: string | null) => void;
  onSetupService: (serviceId: string | null) => void;
  onSetConnectingService: (serviceId: string | null) => void;
  onSetActiveTab: (tab: string) => void;
}

export function ChannelCredentialSelector({
  serviceId,
  agentId,
  userId,
  connections,
  supabase,
  fetchAgentPermissions,
  providerNameForServiceId: resolveProviderName,
  defaultScopesForService: resolveDefaultScopes,
  onSelectCredentialFor,
  onSetupService,
  onSetConnectingService,
  onSetActiveTab,
}: ChannelCredentialSelectorProps) {
  const provider = resolveProviderName(serviceId);

  console.log('[renderCredentialSelector] Service:', serviceId, 'Provider:', provider);
  console.log(
    '[renderCredentialSelector] All connections:',
    connections.map((connection) => ({
      provider_name: connection.provider_name,
      connection_name: connection.connection_name,
      connection_status: connection.connection_status,
      connection_id: connection.connection_id || connection.id,
      external_username: connection.external_username,
    })),
  );

  const creds = connections.filter(
    (connection) =>
      connection.provider_name === provider && connection.connection_status === 'active',
  );

  console.log('[renderCredentialSelector] Filtered credentials for', serviceId, ':', creds);

  if (creds.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground text-center py-4">
          No saved credentials for this service.
        </div>

        <div className="pt-2 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              console.log(
                '[renderCredentialSelector] No existing credentials, redirecting to setup for',
                serviceId,
              );
              onSelectCredentialFor(null);
              onSetupService(serviceId);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add new credential
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {creds.map((connection) => {
        const connectionId = connection.connection_id || connection.id;
        const displayName = connection.provider_display_name || connection.provider_name;

        return (
          <div key={connectionId} className="flex items-center justify-between p-3 border rounded">
            <div className="text-sm">
              <div className="font-medium">{displayName}</div>
              <div className="text-muted-foreground">
                {connection.external_username || connection.connection_name}
              </div>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  onSetConnectingService(serviceId);
                  const scopes = resolveDefaultScopes(serviceId);

                  const { error: grantError } = await supabase.rpc(
                    'grant_agent_integration_permission',
                    {
                      p_agent_id: agentId,
                      p_connection_id: connectionId,
                      p_allowed_scopes: scopes,
                      p_permission_level: 'custom',
                      p_user_id: userId,
                    },
                  );
                  if (grantError) throw grantError;
                  await fetchAgentPermissions();
                  onSelectCredentialFor(null);
                  onSetActiveTab('connected');
                } catch (error) {
                  console.error('Grant permission error', error);
                  toast.error('Failed to authorize agent');
                } finally {
                  onSetConnectingService(null);
                }
              }}
            >
              Authorize Agent
            </Button>
          </div>
        );
      })}

      <div className="pt-2 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            onSelectCredentialFor(null);
            onSetupService(serviceId);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add new credential
        </Button>
      </div>
    </div>
  );
}
