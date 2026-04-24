import { CheckCircle, ExternalLink, Key, Link as LinkIcon, RefreshCw, Shield } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { StripeConfig } from './types';

interface ConfigurationTabProps {
  config: StripeConfig;
  loading: boolean;
  testingConnection: boolean;
  onConfigChange: (config: StripeConfig) => void;
  onSave: () => void;
  onTestConnection: () => void;
  onInitiateOAuth: () => void;
  onDisconnectOAuth: () => void;
}

export function ConfigurationTab({
  config,
  loading,
  testingConnection,
  onConfigChange,
  onSave,
  onTestConnection,
  onInitiateOAuth,
  onDisconnectOAuth,
}: ConfigurationTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5" />Connect with Stripe</CardTitle>
          <p className="text-sm text-muted-foreground">Securely connect your Stripe account using OAuth (recommended) or manually enter API keys.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <input type="radio" id="oauth" name="connection_method" checked={config.connection_method === 'oauth'} onChange={() => onConfigChange({ ...config, connection_method: 'oauth' })} className="w-4 h-4 text-blue-600" />
              <Label htmlFor="oauth">OAuth Connection (Recommended)</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="radio" id="manual" name="connection_method" checked={config.connection_method === 'manual'} onChange={() => onConfigChange({ ...config, connection_method: 'manual' })} className="w-4 h-4 text-blue-600" />
              <Label htmlFor="manual">Manual API Keys</Label>
            </div>
          </div>

          {config.connection_method === 'oauth' && (
            <div className="space-y-4">
              {config.oauth_connected ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-5 h-5 text-green-600" /><h3 className="font-medium text-green-800 dark:text-green-200">Connected to Stripe</h3></div>
                      <p className="text-sm text-green-600 dark:text-green-300">Account ID: {config.stripe_account_id}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={onDisconnectOAuth} disabled={loading} className="text-red-600 border-red-300 hover:bg-red-50">Disconnect</Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Connect your Stripe account</h3>
                  <p className="text-sm text-blue-600 dark:text-blue-300 mb-3">Securely connect to Stripe using OAuth for key rotation and streamlined setup.</p>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                    Client ID: {import.meta.env.VITE_STRIPE_CLIENT_ID ? 'Configured' : 'Not configured'}
                    <br />
                    Redirect URI: {window.location.origin}/admin/billing/stripe-callback
                  </div>
                  <Button onClick={onInitiateOAuth} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Connect with Stripe
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {config.connection_method === 'manual' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" />API Keys</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <select value={config.mode} disabled={!!(config.secret_key || config.publishable_key)} onChange={(e) => onConfigChange({ ...config, mode: e.target.value as 'test' | 'live' })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-background disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="test">Test Mode</option>
                  <option value="live">Live Mode</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Badge className={config.connected ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}>
                  {config.connected ? <><CheckCircle className="w-3 h-3 mr-1" />Connected</> : <><AlertCircle className="w-3 h-3 mr-1" />Disconnected</>}
                </Badge>
              </div>
            </div>

            <div>
              <Label htmlFor="publishable_key">Publishable Key</Label>
              <Input id="publishable_key" type="text" placeholder={`pk_${config.mode}_...`} value={config.publishable_key} onChange={(e) => onConfigChange({ ...config, publishable_key: e.target.value, mode: e.target.value.startsWith('pk_live_') ? 'live' : 'test' })} />
            </div>
            <div>
              <Label htmlFor="secret_key">Secret Key</Label>
              <Input id="secret_key" type="password" placeholder={`sk_${config.mode}_...`} value={config.secret_key} onChange={(e) => onConfigChange({ ...config, secret_key: e.target.value, mode: e.target.value.startsWith('sk_live_') ? 'live' : 'test' })} />
            </div>
            <div>
              <Label htmlFor="webhook_secret">Webhook Secret</Label>
              <Input id="webhook_secret" type="password" placeholder="whsec_..." value={config.webhook_secret} onChange={(e) => onConfigChange({ ...config, webhook_secret: e.target.value })} />
            </div>

            <Separator />
            <div className="flex gap-2">
              <Button onClick={onTestConnection} disabled={testingConnection || !config.secret_key} variant="outline">
                {testingConnection ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Testing...</> : <><Shield className="w-4 h-4 mr-2" />Test Connection</>}
              </Button>
              <Button onClick={onSave} disabled={loading}>
                {loading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
