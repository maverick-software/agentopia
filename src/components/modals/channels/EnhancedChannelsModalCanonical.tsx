import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import {
  useConnections,
  useIntegrationsByClassification,
  VaultService,
} from '@/integrations/_shared';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

import { ConnectedChannelsList } from './ConnectedChannelsList';
import { AvailableChannelsList } from './AvailableChannelsList';
import { ChannelSetupForms } from './ChannelSetupForms';
import { ChannelPermissionsModal } from './ChannelPermissionsModal';
import { useChannelsModalState } from './useChannelsModalState';
import { useChannelPermissions } from './useChannelPermissions';
import { ChannelCredentialSelector } from './ChannelCredentialSelector';
import { defaultScopesForService, providerNameForServiceId } from './channelServiceUtils';

export interface EnhancedChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function EnhancedChannelsModalCanonical({
  isOpen,
  onClose,
  agentId,
}: EnhancedChannelsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const vaultService = new VaultService(supabase);

  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification('channel');

  useEffect(() => {
    console.log(
      '[EnhancedChannelsModal] Loaded channel integrations:',
      integrations.map((integration) => ({
        name: integration.name,
        id: integration.id,
        agent_classification: integration.agent_classification,
      })),
    );
  }, [integrations]);

  useEffect(() => {
    console.log('[EnhancedChannelsModal] Loaded connections from useConnections hook:');
    console.log('Raw connections data:', connections);
    console.log(
      'Mapped connections:',
      connections.map((connection) => ({
        connection_id: connection.connection_id || connection.id,
        provider_name: connection.provider_name,
        provider_display_name: connection.provider_display_name,
        connection_name: connection.connection_name,
        external_username: connection.external_username,
        connection_status: connection.connection_status,
        credential_type: connection.credential_type,
      })),
    );
  }, [connections]);

  const [capabilitiesByIntegrationId, setCapabilitiesByIntegrationId] = useState<
    Record<string, any[]>
  >({});

  const modalState = useChannelsModalState();
  const { agentPermissions, fetchAgentPermissions } = useChannelPermissions(agentId);

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        if (!integrations || integrations.length === 0) return;

        const integrationIds = integrations.map((integration) => integration.id);
        const { data } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', integrationIds)
          .order('display_order');

        const capabilitiesMap: Record<string, any[]> = {};
        (data || []).forEach((row: any) => {
          if (!capabilitiesMap[row.integration_id]) {
            capabilitiesMap[row.integration_id] = [];
          }
          capabilitiesMap[row.integration_id].push({
            capability_key: row.capability_key,
            display_label: row.display_label,
            display_order: row.display_order,
          });
        });

        setCapabilitiesByIntegrationId(capabilitiesMap);
      } catch (error) {
        console.warn('Failed to load integration capabilities:', error);
      }
    };

    void loadCapabilities();
  }, [integrations, supabase]);

  const handleSMTPSetup = async () => {
    if (!user) return;

    modalState.setConnectingService('smtp');
    modalState.setError(null);

    try {
      if (!modalState.smtpHost.trim()) {
        modalState.setError('SMTP Host is required');
        return;
      }
      if (!modalState.smtpPort.trim()) {
        modalState.setError('SMTP Port is required');
        return;
      }
      if (!modalState.smtpUsername.trim()) {
        modalState.setError('Username is required');
        return;
      }
      if (!modalState.smtpPassword.trim()) {
        modalState.setError('Password is required');
        return;
      }
      if (!modalState.fromEmail.trim()) {
        modalState.setError('From email is required');
        return;
      }

      const { data: smtpProvider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'smtp')
        .single();

      if (providerError || !smtpProvider) {
        throw providerError || new Error('SMTP provider missing');
      }

      const smtpConfig = {
        host: modalState.smtpHost,
        port: parseInt(modalState.smtpPort, 10),
        secure: modalState.smtpSecure === 'ssl',
        auth: {
          user: modalState.smtpUsername,
          pass: modalState.smtpPassword,
        },
        tls: modalState.smtpSecure === 'tls' ? { rejectUnauthorized: false } : undefined,
        from_email: modalState.fromEmail,
        from_name: modalState.fromName || undefined,
      };

      console.log('Securing SMTP configuration with vault encryption');
      const secretName = `smtp_config_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        smtpConfig,
        `SMTP server configuration for ${modalState.smtpHost}:${modalState.smtpPort} - Created: ${new Date().toISOString()}`,
      );

      const { data: credential, error: credentialError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: smtpProvider.id,
          external_user_id: user.id,
          external_username: modalState.smtpUsername,
          connection_name: modalState.connectionName || 'SMTP.com',
          vault_access_token_id: vaultKeyId,
          connection_status: 'active',
          credential_type: 'api_key',
        })
        .select()
        .single();

      if (credentialError || !credential) {
        throw credentialError || new Error('Failed to save SMTP credential');
      }

      await refetchConnections();
      await fetchAgentPermissions();

      toast.success('SMTP server connected successfully! 🚀');
      modalState.setSaved(true);
      modalState.setSetupService(null);
      modalState.setActiveTab('connected');
      modalState.resetForm();
    } catch (error: any) {
      console.error('SMTP setup error:', error);
      modalState.setError(error.message || 'Failed to setup SMTP server');
      toast.error('Failed to connect SMTP server. Please try again.');
    } finally {
      modalState.setConnectingService(null);
    }
  };

  const handleModifyPermissions = (connection: any) => {
    modalState.setEditingPermission(connection);
    modalState.setSelectedScopes(
      connection.allowed_scopes || defaultScopesForService(connection.provider_name),
    );
    modalState.setShowPermissionsModal(true);
  };

  const renderCredentialSelector = (serviceId: string) => (
    <ChannelCredentialSelector
      serviceId={serviceId}
      agentId={agentId}
      userId={user?.id}
      connections={connections}
      supabase={supabase}
      fetchAgentPermissions={fetchAgentPermissions}
      providerNameForServiceId={providerNameForServiceId}
      defaultScopesForService={defaultScopesForService}
      onSelectCredentialFor={modalState.setSelectingCredentialFor}
      onSetupService={modalState.setSetupService}
      onSetConnectingService={modalState.setConnectingService}
      onSetActiveTab={modalState.setActiveTab}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">💬 Channels</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect communication channels and manage permissions for your agent.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <Tabs value={modalState.activeTab} onValueChange={modalState.setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connected">Connected Channels</TabsTrigger>
              <TabsTrigger value="available">Add New Channel</TabsTrigger>
            </TabsList>

            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                <ConnectedChannelsList
                  agentPermissions={agentPermissions}
                  integrations={integrations}
                  capabilitiesByIntegrationId={capabilitiesByIntegrationId}
                  onModifyPermissions={handleModifyPermissions}
                  onRemoveSuccess={fetchAgentPermissions}
                  onAddChannel={() => modalState.setActiveTab('available')}
                />
              </div>
            </TabsContent>

            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                <AvailableChannelsList
                  integrations={integrations}
                  agentPermissions={agentPermissions}
                  connections={connections}
                  setupService={modalState.setupService}
                  selectingCredentialFor={modalState.selectingCredentialFor}
                  connectingService={modalState.connectingService}
                  capabilitiesByIntegrationId={capabilitiesByIntegrationId}
                  onSetupClick={modalState.setSetupService}
                  onSelectCredentialClick={modalState.setSelectingCredentialFor}
                  onCancelSetup={() => {
                    modalState.setSetupService(null);
                    modalState.setSelectingCredentialFor(null);
                  }}
                  renderSetupFlow={(service) => (
                    <ChannelSetupForms
                      service={service}
                      connectingService={modalState.connectingService}
                      connectionName={modalState.connectionName}
                      apiKey={modalState.apiKey}
                      fromEmail={modalState.fromEmail}
                      fromName={modalState.fromName}
                      smtpHost={modalState.smtpHost}
                      smtpPort={modalState.smtpPort}
                      smtpSecure={modalState.smtpSecure}
                      smtpUsername={modalState.smtpUsername}
                      smtpPassword={modalState.smtpPassword}
                      error={modalState.error}
                      onConnectionNameChange={modalState.setConnectionName}
                      onApiKeyChange={modalState.setApiKey}
                      onFromEmailChange={modalState.setFromEmail}
                      onFromNameChange={modalState.setFromName}
                      onSMTPHostChange={modalState.setSMTPHost}
                      onSMTPPortChange={modalState.setSMTPPort}
                      onSMTPSecureChange={modalState.setSMTPSecure}
                      onSMTPUsernameChange={modalState.setSMTPUsername}
                      onSMTPPasswordChange={modalState.setSMTPPassword}
                      onSMTPSetup={handleSMTPSetup}
                      onSetupService={modalState.setSetupService}
                      onSetupCancel={() => modalState.setSetupService(null)}
                    />
                  )}
                  renderCredentialSelector={renderCredentialSelector}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <ChannelPermissionsModal
        isOpen={modalState.showPermissionsModal}
        onClose={() => modalState.setShowPermissionsModal(false)}
        agentId={agentId}
        editingPermission={modalState.editingPermission}
        onPermissionUpdated={fetchAgentPermissions}
      />
    </Dialog>
  );
}
