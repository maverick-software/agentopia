import { useEffect, useState } from 'react';
import { Cloud, FolderOpen, HardDrive } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useConnections } from '@/integrations/_shared';
import { useAgentIntegrationPermissions } from '@/integrations/_shared/hooks/useAgentIntegrationPermissions';
import { supabase } from '@/lib/supabase';
import { OneDriveCard } from './OneDriveCard';
import { OneDriveModal } from './OneDriveModal';
import { getOneDriveStatus } from './oneDriveUtils';
import type { OneDriveCredential, OneDrivePermission, SourcesTabProps } from './types';

export function SourcesTab({ agentId }: SourcesTabProps) {
  const { user } = useAuth();
  const { connections } = useConnections({ includeRevoked: false });
  const { permissions: agentPermissions, refetch: refetchPermissions } = useAgentIntegrationPermissions(agentId);

  const [onedriveCredentials, setOnedriveCredentials] = useState<OneDriveCredential[]>([]);
  const [onedrivePermissions, setOnedrivePermissions] = useState<OneDrivePermission[]>([]);
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [selectedCredential, setSelectedCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    if (!user || !agentId) return;
    const onedriveConnections = connections.filter((conn) => conn.provider_name === 'microsoft-onedrive' && conn.connection_status === 'active');
    setOnedriveCredentials(
      onedriveConnections.map((conn) => ({
        connection_id: conn.connection_id,
        external_username: conn.external_username,
        connection_name: conn.connection_name,
        scopes_granted: conn.scopes_granted || [],
        connection_status: conn.connection_status,
      })),
    );
    const permissions = agentPermissions.filter((perm) => perm.provider_name === 'microsoft-onedrive');
    setOnedrivePermissions(
      permissions.map((perm) => ({
        id: perm.permission_id,
        connection_id: perm.connection_id,
        is_active: perm.is_active,
        allowed_scopes: perm.allowed_scopes || [],
      })),
    );
  }, [user, agentId, connections, agentPermissions]);

  const handleConfigureOneDrive = () => {
    if (onedriveCredentials.length === 0) {
      toast.error('No OneDrive connections found. Please connect your OneDrive account first from the Credentials page.');
      return;
    }
    setShowOneDriveModal(true);
  };

  const handleGrantOneDrivePermission = async () => {
    if (!selectedCredential || selectedScopes.length === 0) return toast.error('Please select a credential and at least one permission');
    if (!user?.id) return toast.error('User not authenticated');

    setLoading(true);
    try {
      const { error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: selectedCredential,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user.id,
      });
      if (error) throw error;
      toast.success('OneDrive permission granted successfully');
      await refetchPermissions();
      setShowOneDriveModal(false);
      setSelectedCredential('');
      setSelectedScopes([]);
    } catch (error) {
      console.error('Error granting OneDrive permission:', error);
      toast.error('Failed to grant OneDrive permission');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeOneDrivePermission = async () => {
    const permissionId = onedrivePermissions[0]?.id;
    if (!permissionId) return;
    try {
      const { error } = await supabase.rpc('revoke_agent_integration_permission', { p_permission_id: permissionId });
      if (error) throw error;
      toast.success('OneDrive permission revoked successfully');
      await refetchPermissions();
    } catch (error) {
      console.error('Error revoking OneDrive permission:', error);
      toast.error('Failed to revoke OneDrive permission');
    }
  };

  const onedriveStatus = getOneDriveStatus(onedriveCredentials.length, onedrivePermissions.length);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Cloud Storage Sources</h3>
        <p className="text-sm text-muted-foreground">Connect your agent to cloud storage services for document access and file operations.</p>
      </div>

      <OneDriveCard
        enabled={onedriveStatus.enabled}
        statusText={onedriveStatus.statusText}
        credentialsCount={onedriveCredentials.length}
        permissions={onedrivePermissions}
        showPermissions={showPermissions}
        onTogglePermissions={() => setShowPermissions((prev) => !prev)}
        onConfigure={handleConfigureOneDrive}
        onDisconnect={handleRevokeOneDrivePermission}
      />

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            Additional Cloud Storage (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Google Drive', icon: Cloud, features: ['File Access', 'Shared Documents', 'Version History'] },
              { name: 'Dropbox', icon: Cloud, features: ['File Sync', 'Shared Folders', 'File History'] },
              { name: 'Box', icon: HardDrive, features: ['Enterprise Security', 'Workflow Integration', 'Advanced Permissions'] },
              { name: 'SharePoint', icon: HardDrive, features: ['Team Sites', 'Document Libraries', 'Workflows'] },
            ].map((source) => {
              const Icon = source.icon;
              return (
                <div key={source.name} className="p-4 border rounded-lg bg-background/50 opacity-60">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <h5 className="font-medium text-sm">{source.name}</h5>
                    <Badge variant="outline" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {source.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <OneDriveModal
        open={showOneDriveModal}
        loading={loading}
        credentials={onedriveCredentials}
        selectedCredential={selectedCredential}
        selectedScopes={selectedScopes}
        showPermissions={showPermissions}
        onOpenChange={setShowOneDriveModal}
        onSelectedCredentialChange={setSelectedCredential}
        onSelectedScopesChange={setSelectedScopes}
        onTogglePermissions={() => setShowPermissions((prev) => !prev)}
        onGrantAccess={handleGrantOneDrivePermission}
      />
    </div>
  );
}
