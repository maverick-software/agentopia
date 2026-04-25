import { AlertCircle, CheckCircle, HardDrive, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { OneDrivePermission } from './types';
import { mapOneDriveScopes } from './oneDriveUtils';

interface OneDriveCardProps {
  enabled: boolean;
  statusText: string;
  credentialsCount: number;
  permissions: OneDrivePermission[];
  showPermissions: boolean;
  onTogglePermissions: () => void;
  onConfigure: () => void;
  onDisconnect: () => Promise<void>;
}

export function OneDriveCard({
  enabled,
  statusText,
  credentialsCount,
  permissions,
  showPermissions,
  onTogglePermissions,
  onConfigure,
  onDisconnect,
}: OneDriveCardProps) {
  return (
    <Card className={enabled ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">Microsoft OneDrive</h4>
                <Badge variant={enabled ? 'default' : 'outline'} className="text-xs">
                  {enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                  {statusText}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Access files and documents from Microsoft OneDrive with secure OAuth authentication.</p>
              {enabled && permissions.length > 0 && (
                <div className="mt-2">
                  <button type="button" onClick={onTogglePermissions} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1">
                    View Available Tools ({permissions.reduce((count, perm) => count + mapOneDriveScopes(perm.allowed_scopes).length, 0)})
                    <div className={`transform transition-transform text-[10px] ${showPermissions ? 'rotate-180' : ''}`}>▼</div>
                  </button>
                  {showPermissions && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {permissions.flatMap((perm) =>
                        mapOneDriveScopes(perm.allowed_scopes).map((cap) => (
                          <Badge key={`${perm.id}-${cap}`} variant="secondary" className="text-xs">
                            {cap.replace('files.', 'Files ').replace('sites.', 'Sites ')}
                          </Badge>
                        )),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onConfigure} disabled={credentialsCount === 0}>
              <Settings className="w-4 h-4 mr-1" />
              {enabled ? 'Manage' : 'Configure'}
            </Button>
            {enabled && permissions.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => void onDisconnect()}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
