import { Key, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CredentialModalState, ToolSettings } from './types';

interface CredentialModalProps {
  credentialModal: CredentialModalState;
  setCredentialModal: React.Dispatch<React.SetStateAction<CredentialModalState>>;
  newApiKey: string;
  setNewApiKey: (value: string) => void;
  onProviderSelect: (providerId: string) => void;
  onCreateCredential: () => Promise<void>;
  onUseExisting: () => void;
}

export function CredentialModal({
  credentialModal,
  setCredentialModal,
  newApiKey,
  setNewApiKey,
  onProviderSelect,
  onCreateCredential,
  onUseExisting,
}: CredentialModalProps) {
  return (
    <Dialog open={credentialModal.isOpen} onOpenChange={(open) => setCredentialModal((prev) => ({ ...prev, isOpen: open }))}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configure {credentialModal.toolType?.replace('_', ' ')} Provider</span>
          </DialogTitle>
          <DialogDescription>Select a provider and configure your credentials to enable this tool.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {credentialModal.availableCredentials.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Existing Credentials</Label>
              <div className="space-y-2">
                {credentialModal.availableCredentials.map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{cred.integration_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cred.provider_id} • {cred.status}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={onUseExisting}>
                      Use This
                    </Button>
                  </div>
                ))}
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
                {provider.requiresApiKey && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center space-x-2">
                      <Key className="h-4 w-4" />
                      <span>API Key</span>
                    </Label>
                    <Input type="password" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="Enter your API key..." />
                    <p className="text-xs text-muted-foreground">Your API key will be encrypted and stored securely.</p>
                  </div>
                )}

                {provider.requiresOAuth && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      This provider requires OAuth authentication. Click "Connect" to authorize access.
                    </p>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <Button variant="outline" onClick={() => setCredentialModal((prev) => ({ ...prev, isOpen: false }))} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={() => void onCreateCredential()} className="flex-1" disabled={provider.requiresApiKey && !newApiKey.trim()}>
                    {provider.requiresOAuth ? 'Connect' : 'Save'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
