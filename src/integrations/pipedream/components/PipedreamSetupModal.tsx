import { useMemo, useState } from 'react';
import { PipedreamClient } from '@pipedream/sdk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlugZap } from 'lucide-react';
import type { IntegrationSetupProps } from '@/integrations/_shared';
import {
  createPipedreamConnectToken,
  syncPipedreamAccounts,
} from '../services/pipedreamService';

interface PipedreamIntegrationMetadata {
  pipedream_app_slug?: string;
  pipedream_app_name?: string;
}

interface PipedreamConnectedAccount {
  id?: string;
  name?: string;
  external_id?: string;
}

interface PipedreamClientWithConnect {
  connectAccount: (options: {
    app: string;
    onSuccess: (account: PipedreamConnectedAccount) => void | Promise<void>;
    onError: (error: Error) => void;
  }) => Promise<void>;
}

export function PipedreamSetupModal({
  integration,
  user,
  supabase,
  onSuccess,
  onError,
  onClose,
}: IntegrationSetupProps) {
  const [connecting, setConnecting] = useState(false);
  const pipedreamIntegration = integration as IntegrationSetupProps['integration'] & PipedreamIntegrationMetadata;
  const appSlug = pipedreamIntegration.pipedream_app_slug || 'app_discovery';
  const appName = pipedreamIntegration.pipedream_app_name || integration.name;

  const client = useMemo(() => {
    return new PipedreamClient({
      projectEnvironment: import.meta.env.VITE_PIPEDREAM_ENVIRONMENT || 'development',
      externalUserId: user?.id || 'pending',
      tokenCallback: async () => {
        const tokenResponse = await createPipedreamConnectToken(supabase);
        return tokenResponse.token;
      },
    } as ConstructorParameters<typeof PipedreamClient>[0]) as PipedreamClientWithConnect;
  }, [supabase, user?.id]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await client.connectAccount({
        app: appSlug,
        onSuccess: async (account) => {
          await syncPipedreamAccounts(supabase, appSlug);
          onSuccess({
            connection_id: account?.id || appSlug,
            connection_name: account?.name || appName,
            provider_name: 'pipedream',
            external_username: account?.name || account?.external_id,
            scopes_granted: ['pipedream_mcp'],
          });
        },
        onError: (err: Error) => {
          onError(err.message);
        },
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to connect Pipedream account');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <PlugZap className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">Connect {appName} with Pipedream</h3>
          <p className="text-sm text-muted-foreground">
            Pipedream handles the app authorization and credential refresh. Agentopia stores
            only the connected account metadata needed to route MCP tools.
          </p>
          <Badge variant="secondary">Primary MCP provider</Badge>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          The connection flow opens Pipedream&apos;s embedded auth experience. After the account
          is connected, you can assign its MCP tools to an agent.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={connecting}>
          Cancel
        </Button>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Connect {appName}
        </Button>
      </div>
    </div>
  );
}
