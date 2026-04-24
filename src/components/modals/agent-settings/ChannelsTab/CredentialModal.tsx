import { Key, Mail, Settings, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CredentialModalState } from './types';

interface CredentialModalProps {
  credentialModal: CredentialModalState;
  setCredentialModal: React.Dispatch<React.SetStateAction<CredentialModalState>>;
  newApiKey: string;
  setNewApiKey: (value: string) => void;
  newBotToken: string;
  setNewBotToken: (value: string) => void;
  onProviderSelect: (providerId: string) => void;
  onCreateCredential: () => Promise<void>;
  onAuthorizeCredential: (credentialId: string) => Promise<void>;
}

export function CredentialModal({
  credentialModal,
  setCredentialModal,
  newApiKey,
  setNewApiKey,
  newBotToken,
  setNewBotToken,
  onProviderSelect,
  onCreateCredential,
  onAuthorizeCredential,
}: CredentialModalProps) {
  return (
    <Dialog open={credentialModal.isOpen} onOpenChange={(open) => setCredentialModal((prev) => ({ ...prev, isOpen: open }))}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configure {credentialModal.channelType?.toUpperCase()} Provider</span>
          </DialogTitle>
          <DialogDescription>
            Select a provider and configure your credentials to enable this communication channel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {credentialModal.availableCredentials.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Existing Credentials</Label>
              <div className="space-y-2">
                {credentialModal.availableCredentials.map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{cred.connection_name || cred.service_providers?.display_name || 'Email Account'}</div>
                        <div className="text-xs text-muted-foreground">
                          {cred.service_providers?.display_name || cred.service_providers?.name || 'Unknown Provider'}
                          {cred.external_username && ` • ${cred.external_username}`}
                          {cred.connection_status && ` • ${cred.connection_status}`}
                        </div>
                      </div>
                    </div>
                    <Button variant="default" size="sm" onClick={() => void onAuthorizeCredential(cred.id)}>
                      Authorize Agent
                    </Button>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or create new</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Provider</Label>
            <Select value={credentialModal.selectedProvider} onValueChange={onProviderSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a provider..." />
              </SelectTrigger>
              <SelectContent>
                {credentialModal.availableProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-xs text-muted-foreground">{provider.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {credentialModal.selectedProvider && (() => {
            const provider = credentialModal.availableProviders.find((p) => p.id === credentialModal.selectedProvider);
            if (!provider) return null;

            return (
              <div className="space-y-4">
                <div className="space-y-3">
                  {provider.authType === 'api_key' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center space-x-2">
                        <Key className="h-4 w-4" />
                        <span>API Key</span>
                      </Label>
                      <Input type="password" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="Enter your API key..." />
                      <p className="text-xs text-muted-foreground">Your API key will be encrypted and stored securely.</p>
                    </div>
                  )}

                  {provider.authType === 'bot_token' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span>Bot Token</span>
                      </Label>
                      <Input type="password" value={newBotToken} onChange={(e) => setNewBotToken(e.target.value)} placeholder="Enter your bot token..." />
                      <p className="text-xs text-muted-foreground">Your bot token will be encrypted and stored securely.</p>
                    </div>
                  )}

                  {provider.authType === 'oauth' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        This provider requires OAuth authentication. Click "Connect" to authorize access through {provider.name}.
                      </p>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" onClick={() => setCredentialModal((prev) => ({ ...prev, isOpen: false }))} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void onCreateCredential()}
                      className="flex-1"
                      disabled={(provider.authType === 'api_key' && !newApiKey.trim()) || (provider.authType === 'bot_token' && !newBotToken.trim())}
                    >
                      {provider.authType === 'oauth' ? 'Connect' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
