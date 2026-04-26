import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Bot, CheckCircle, ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

type JsonRecord = Record<string, unknown>;
const LOCAL_HELPER_URL = 'http://127.0.0.1:1456';

interface CodexCredential {
  id: string;
  external_username?: string | null;
  connection_name?: string | null;
  connection_status?: string | null;
  token_expires_at?: string | null;
  connection_metadata?: JsonRecord | null;
}

interface CodexStatus {
  connected: boolean;
  credential: CodexCredential | null;
}

interface Props {
  onChanged?: () => Promise<void> | void;
}

export function CodexOAuthControls({ onChanged }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<CodexStatus>({ connected: false, credential: null });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [authStarted, setAuthStarted] = useState(false);
  const [helperMissing, setHelperMissing] = useState(false);

  const accountLabel = useMemo(() => {
    const credential = status.credential;
    const email = stringValue(credential?.connection_metadata?.email);
    return email || credential?.external_username || credential?.connection_name || 'ChatGPT Codex';
  }, [status.credential]);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('codex-oauth', {
        body: { action: 'status' },
      });
      if (error) throw error;
      const payload = asRecord(data?.data);
      setStatus({
        connected: Boolean(payload.connected),
        credential: asCredential(payload.credential),
      });
    } catch (error) {
      console.error('Codex OAuth status error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const finishAction = async (message: string) => {
    toast.success(message);
    await loadStatus();
    await onChanged?.();
  };

  const handleLogin = async () => {
    setBusyAction('login');
    try {
      await callLocalHelper('/health');
      await callLocalHelper('/login', { method: 'POST' });
      setAuthStarted(true);
      setHelperMissing(false);
      toast.success('Codex login started locally. Complete the Codex browser flow, then import the auth cache.');
    } catch (error) {
      setHelperMissing(true);
      toast.error(errorMessage(error, 'Start the local Codex helper, then try again.'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportLocalAuth = async () => {
    setBusyAction('import');
    try {
      const localAuth = await callLocalHelper('/auth');
      const { data } = await invokeCodexOAuth({
        action: 'local_import',
        auth: asRecord(localAuth.auth),
      });
      if (!data?.success) throw new Error(data?.error || 'Failed to import Codex auth');
      setAuthStarted(false);
      await finishAction('OpenAI Codex connected');
    } catch (error) {
      toast.error(await asyncErrorMessage(error, 'Failed to import local Codex auth'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleRefresh = async () => {
    setBusyAction('refresh');
    try {
      const { data, error } = await supabase.functions.invoke('codex-oauth', {
        body: { action: 'refresh', credential_id: status.credential?.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to refresh Codex OAuth');
      await finishAction('OpenAI Codex refreshed');
    } catch (error) {
      toast.error(await asyncErrorMessage(error, 'Failed to refresh Codex OAuth'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect OpenAI Codex OAuth? Agents will stop receiving Codex bridge tools until you reconnect.')) return;
    setBusyAction('disconnect');
    try {
      const { data, error } = await supabase.functions.invoke('codex-oauth', {
        body: { action: 'disconnect', credential_id: status.credential?.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to disconnect Codex OAuth');
      await finishAction('OpenAI Codex disconnected');
    } catch (error) {
      toast.error(await asyncErrorMessage(error, 'Failed to disconnect Codex OAuth'));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
              <Bot className="h-4 w-4 text-blue-700 dark:text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">OpenAI Codex OAuth</h2>
                {status.connected ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {status.connected
                  ? `Using ChatGPT-managed Codex as ${accountLabel}.`
                  : 'Connect ChatGPT-managed Codex OAuth so agents can use the Codex CLI bridge.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {loading ? (
              <Button variant="outline" size="sm" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking</Button>
            ) : status.connected ? (
              <>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={Boolean(busyAction)}>
                  <RefreshCw className="mr-2 h-4 w-4" />Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogin} disabled={Boolean(busyAction)}>
                  <ExternalLink className="mr-2 h-4 w-4" />Reconnect Local Codex
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={Boolean(busyAction)}>
                  <Trash2 className="mr-2 h-4 w-4" />Disconnect
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleLogin} disabled={Boolean(busyAction)}>
                  {busyAction === 'login' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  Connect Local Codex
                </Button>
              </>
            )}
          </div>
        </div>
        {authStarted && !status.connected && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-background/80 p-3 dark:border-blue-800">
            <p className="text-sm text-muted-foreground">
              Complete the official Codex login window. When it finishes, import the local auth cache into Agentopia Vault.
            </p>
            <div className="mt-3">
              <Button size="sm" onClick={handleImportLocalAuth} disabled={busyAction === 'import'}>
                {busyAction === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Import Local Auth
              </Button>
            </div>
          </div>
        )}
        {helperMissing && !status.connected && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
            <p className="font-medium">Install Codex CLI if needed, start the local helper, then retry:</p>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs">npm install -g @openai/codex</pre>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs">node services\codex-local-auth-helper\server.js</pre>
            <p className="mt-2 text-muted-foreground">
              The helper runs on `127.0.0.1:1456` and uses `%USERPROFILE%\.agentopia\codex-auth` as its private Codex home.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asCredential(value: unknown): CodexCredential | null {
  const record = asRecord(value);
  return typeof record.id === 'string' ? record as unknown as CodexCredential : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function asyncErrorMessage(error: unknown, fallback: string): Promise<string> {
  const response = (error as { context?: Response })?.context;
  if (response) {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === 'string') return payload.error;
    } catch {
      // Fall through to the standard Error message.
    }
  }
  return errorMessage(error, fallback);
}

async function invokeCodexOAuth(body: JsonRecord) {
  const { data, error } = await supabase.functions.invoke('codex-oauth', { body });
  if (error) throw error;
  return { data };
}

async function callLocalHelper(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${LOCAL_HELPER_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok || payload.success === false) {
    throw new Error(stringValue(payload.error) || `Local Codex helper request failed: ${path}`);
  }
  return payload;
}
