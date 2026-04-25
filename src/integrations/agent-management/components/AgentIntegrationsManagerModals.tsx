import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, ChevronRight, Mail, Search, Settings, Shield } from 'lucide-react';

type WorkflowMode = 'add' | 'view' | 'edit';

interface IntegrationOption {
  id: string;
  name: string;
  description?: string;
}

interface Capability {
  capability_key: string;
  display_label: string;
  display_order: number;
}

interface CredentialOption {
  id: string;
  external_username?: string;
  provider_display_name?: string;
  provider_name?: string;
  connection_metadata?: {
    user_name?: string;
  };
}

interface PermissionRecord {
  id: string;
  allowed_scopes: string[];
  connection?: {
    external_username?: string;
    connection_name?: string;
  };
}

interface AddIntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: 'tool' | 'channel';
  availableIntegrations: IntegrationOption[];
  capabilities: Record<string, Capability[]>;
  onSelectIntegration: (integration: IntegrationOption) => void;
}

export function AddIntegrationModal({
  open,
  onOpenChange,
  category,
  availableIntegrations,
  capabilities,
  onSelectIntegration,
}: AddIntegrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}</DialogTitle>
          <DialogDescription>
            Choose {category === 'channel' ? 'a channel' : category === 'tool' ? 'a tool' : 'an integration'} to connect to this agent
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(85vh-10rem)]">
          <div className="space-y-4 p-1">
            {availableIntegrations.length > 0 ? (
              availableIntegrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                  onClick={() => onSelectIntegration(integration)}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="font-medium">{integration.name}</div>
                      <div className="text-sm text-muted-foreground">{integration.description}</div>
                      {capabilities[integration.id] && capabilities[integration.id].length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {capabilities[integration.id].map((capability) => (
                            <Badge key={capability.capability_key} variant="secondary" className="text-xs">
                              {capability.display_label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </div>
              ))
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No new integrations available. Gmail is currently the only supported integration.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SelectCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIntegration: { name?: string } | null;
  availableCredentials: CredentialOption[];
  onSelectCredential: (credential: CredentialOption) => void;
  onBack: () => void;
  getIntegrationIcon: (providerName?: string) => React.ReactNode;
}

export function SelectCredentialsModal({
  open,
  onOpenChange,
  selectedIntegration,
  availableCredentials,
  onSelectCredential,
  onBack,
  getIntegrationIcon,
}: SelectCredentialsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Select Credentials
          </DialogTitle>
          <DialogDescription>Choose which {selectedIntegration?.name} account to use</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(85vh-10rem)]">
          <div className="space-y-4 p-1">
            {availableCredentials.length > 0 ? (
              availableCredentials.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                  onClick={() => onSelectCredential(credential)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded">{getIntegrationIcon(selectedIntegration?.name)}</div>
                    <div>
                      <div className="font-medium">{credential.external_username}</div>
                      <div className="text-sm text-muted-foreground">
                        {credential.connection_metadata?.user_name ||
                          credential.provider_display_name ||
                          selectedIntegration?.name ||
                          'API Account'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </div>
              ))
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No available credentials. Please connect {selectedIntegration?.name || 'this integration'} first in the{' '}
                  <a href="/integrations" className="text-primary hover:underline">
                    Integrations page
                  </a>
                  .
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowMode: WorkflowMode;
  selectedIntegration: { id?: string; name?: string } | null;
  selectedCredential: { external_username?: string } | null;
  selectedScopes: string[];
  setSelectedScopes: React.Dispatch<React.SetStateAction<string[]>>;
  onBackFromAdd: () => void;
  onBackFromEdit: () => void;
  onSubmit: () => void;
  saving: boolean;
  category: 'tool' | 'channel';
}

export function PermissionsModal({
  open,
  onOpenChange,
  workflowMode,
  selectedIntegration,
  selectedCredential,
  selectedScopes,
  setSelectedScopes,
  onBackFromAdd,
  onBackFromEdit,
  onSubmit,
  saving,
  category,
}: PermissionsModalProps) {
  const integrationId = selectedIntegration?.id || selectedIntegration?.name?.toLowerCase() || '';
  const isSearchAPI =
    integrationId.includes('serper') ||
    integrationId.includes('serpapi') ||
    integrationId.includes('brave') ||
    integrationId.includes('search');

  const toggleScope = (scope: string, checked: boolean) => {
    if (checked) {
      setSelectedScopes((prev) => [...prev, scope]);
      return;
    }
    setSelectedScopes((prev) => prev.filter((existingScope) => existingScope !== scope));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {workflowMode === 'add' && (
              <Button variant="ghost" size="sm" onClick={onBackFromAdd}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {workflowMode === 'edit' && (
              <Button variant="ghost" size="sm" onClick={onBackFromEdit}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {workflowMode === 'edit' ? 'Modify Permissions' : 'Set Permissions'}
          </DialogTitle>
          <DialogDescription>Choose what this agent can do with {selectedCredential?.external_username}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allowed Actions</Label>
            <div className="space-y-2">
              {isSearchAPI ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('web_search')}
                      onChange={(event) => toggleScope('web_search', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Search className="h-4 w-4" />
                    Web search
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('news_search')}
                      onChange={(event) => toggleScope('news_search', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Search className="h-4 w-4" />
                    News search
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('image_search')}
                      onChange={(event) => toggleScope('image_search', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Search className="h-4 w-4" />
                    Image search
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('local_search')}
                      onChange={(event) => toggleScope('local_search', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Search className="h-4 w-4" />
                    Local search
                  </label>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')}
                      onChange={(event) => toggleScope('https://www.googleapis.com/auth/gmail.readonly', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Mail className="h-4 w-4" />
                    Read emails
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.send')}
                      onChange={(event) => toggleScope('https://www.googleapis.com/auth/gmail.send', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Mail className="h-4 w-4" />
                    Send emails
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.modify')}
                      onChange={(event) => toggleScope('https://www.googleapis.com/auth/gmail.modify', event.target.checked)}
                      className="rounded border-border"
                    />
                    <Settings className="h-4 w-4" />
                    Modify emails (archive, labels, etc.)
                  </label>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={selectedScopes.length === 0 || saving}>
            {saving
              ? workflowMode === 'edit'
                ? 'Updating...'
                : 'Adding...'
              : workflowMode === 'edit'
                ? 'Update Permissions'
                : `Add ${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CredentialsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: 'tool' | 'channel';
  selectedIntegration: { name?: string } | null;
  selectedCredential: { external_username?: string } | null;
  permissions: PermissionRecord[];
  getIntegrationIcon: (providerName?: string) => React.ReactNode;
  onRevokePermission: (permissionId: string) => void;
  onModifyPermissions: (permission: PermissionRecord) => void;
}

export function CredentialsDetailModal({
  open,
  onOpenChange,
  category,
  selectedIntegration,
  selectedCredential,
  permissions,
  getIntegrationIcon,
  onRevokePermission,
  onModifyPermissions,
}: CredentialsDetailModalProps) {
  const selectedPermission = permissions.find(
    (permission) => permission.connection?.external_username === selectedCredential?.external_username,
  );
  const scopes = selectedPermission?.allowed_scopes || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIntegrationIcon(selectedIntegration?.name)}
            {selectedIntegration?.name || 'Integration'}
          </DialogTitle>
          <DialogDescription>Account: {selectedCredential?.external_username}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Current Permissions</span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {scopes.includes('https://www.googleapis.com/auth/gmail.readonly') && <div>- Read emails</div>}
              {scopes.includes('https://www.googleapis.com/auth/gmail.send') && <div>- Send emails</div>}
              {scopes.includes('https://www.googleapis.com/auth/gmail.modify') && <div>- Modify emails (archive, labels, etc.)</div>}
              {scopes.length === 0 && <div>- No permissions granted</div>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (!selectedPermission) return;
              onRevokePermission(selectedPermission.id);
              onOpenChange(false);
            }}
          >
            Remove {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!selectedPermission) return;
              onModifyPermissions(selectedPermission);
            }}
          >
            Modify Permissions
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
