import { HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { OneDriveCredential } from './types';
import { ONE_DRIVE_SCOPE_DISPLAY } from './oneDriveUtils';

interface OneDriveModalProps {
  open: boolean;
  loading: boolean;
  credentials: OneDriveCredential[];
  selectedCredential: string;
  selectedScopes: string[];
  showPermissions: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectedCredentialChange: (id: string) => void;
  onSelectedScopesChange: (scopes: string[]) => void;
  onTogglePermissions: () => void;
  onGrantAccess: () => Promise<void>;
}

export function OneDriveModal(props: OneDriveModalProps) {
  const selectedCred = props.credentials.find((c) => c.connection_id === props.selectedCredential);
  const availableScopes = selectedCred?.scopes_granted || [];

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden bg-background border-0 shadow-2xl rounded-2xl flex flex-col">
        <DialogHeader className="pb-4 border-b border-border/50 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Configure OneDrive Access
          </DialogTitle>
          <DialogDescription>Grant your agent access to specific OneDrive capabilities using your connected Microsoft account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2 pb-4">
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-foreground">Select OneDrive Account</Label>
            <div className="space-y-3">
              {props.credentials.map((cred) => (
                <div key={cred.connection_id} className="relative">
                  <input
                    type="radio"
                    id={cred.connection_id}
                    name="onedrive-credential"
                    value={cred.connection_id}
                    checked={props.selectedCredential === cred.connection_id}
                    onChange={(e) => props.onSelectedCredentialChange(e.target.value)}
                    className="sr-only peer"
                  />
                  <label
                    htmlFor={cred.connection_id}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-border/30 bg-card/50 hover:bg-card cursor-pointer transition-all duration-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-950/20 peer-checked:shadow-sm"
                  >
                    <div className="w-3 h-3 rounded-full border-2 border-border peer-checked:border-blue-500 peer-checked:bg-blue-500 transition-all duration-200" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{cred.connection_name || cred.external_username || 'Microsoft OneDrive Connection'}</div>
                      <div className="text-sm text-muted-foreground mt-1">{cred.scopes_granted.length} permissions available</div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {props.selectedCredential && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">Select Permissions</Label>
                <button
                  type="button"
                  onClick={() => props.onSelectedScopesChange(props.selectedScopes.length === availableScopes.length ? [] : availableScopes)}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  {props.selectedScopes.length === availableScopes.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <button type="button" onClick={props.onTogglePermissions} className="w-full flex items-center justify-between p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card transition-colors">
                <span className="text-sm font-medium">{props.selectedScopes.length > 0 ? `${props.selectedScopes.length} permissions selected` : 'Click to select permissions'}</span>
                <div className={`transform transition-transform ${props.showPermissions ? 'rotate-180' : ''}`}>▼</div>
              </button>

              {props.showPermissions && (
                <div className="bg-card/30 border border-border/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {availableScopes.map((scope) => {
                      const displayInfo = ONE_DRIVE_SCOPE_DISPLAY[scope] || { label: scope.split('/').pop() || scope, description: 'Microsoft Graph permission' };
                      return (
                        <div key={scope} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors">
                          <input
                            type="checkbox"
                            id={`scope-${scope}`}
                            checked={props.selectedScopes.includes(scope)}
                            onChange={(e) => props.onSelectedScopesChange(e.target.checked ? [...props.selectedScopes, scope] : props.selectedScopes.filter((s) => s !== scope))}
                            className="w-4 h-4 rounded border-border"
                          />
                          <label htmlFor={`scope-${scope}`} className="flex-1 cursor-pointer">
                            <div className="text-sm font-medium text-foreground">{displayInfo.label}</div>
                            <div className="text-xs text-muted-foreground">{displayInfo.description}</div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border/50 bg-background flex-shrink-0">
          <Button variant="outline" onClick={() => props.onOpenChange(false)} className="px-6">
            Cancel
          </Button>
          <Button onClick={() => void props.onGrantAccess()} disabled={props.loading || !props.selectedCredential || props.selectedScopes.length === 0} className="px-6 bg-blue-600 hover:bg-blue-700 text-white">
            {props.loading ? 'Granting Access...' : 'Grant Access'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
