import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAgentIntegrationPermissions } from '@/integrations/_shared/hooks/useAgentIntegrationPermissions';
import { StandaloneIntegrationSetupModal } from '../StandaloneIntegrationSetupModal';
import { useChannelPermissions } from '../../channels/useChannelPermissions';
import { ChannelCards } from './ChannelCards';
import { CHANNEL_DISABLE_PROVIDER_MAP, CHANNEL_META, CHANNEL_PROVIDER_MAP, DEFAULT_CHANNEL_SETTINGS, EMAIL_PROVIDERS, SMS_PROVIDERS } from './constants';
import { CredentialModal } from './CredentialModal';
import { mapOAuthScopesToAgentCapabilities } from './scopeMapping';
import type { ChannelCardItem, ChannelSettings, ChannelsTabProps, CredentialModalState, IntegrationSetupModalState } from './types';

const DEFAULT_CREDENTIAL_MODAL: CredentialModalState = {
  isOpen: false,
  channelType: null,
  selectedProvider: '',
  availableProviders: [],
  availableCredentials: [],
};

const DEFAULT_SETUP_MODAL: IntegrationSetupModalState = {
  isOpen: false,
  providerName: '',
  channelType: null,
};

export function ChannelsTab({ agentId, onAgentUpdated }: ChannelsTabProps) {
  const [settings, setSettings] = useState<ChannelSettings>(DEFAULT_CHANNEL_SETTINGS);
  const [credentialModal, setCredentialModal] = useState<CredentialModalState>(DEFAULT_CREDENTIAL_MODAL);
  const [integrationSetupModal, setIntegrationSetupModal] = useState<IntegrationSetupModalState>(DEFAULT_SETUP_MODAL);
  const [newApiKey, setNewApiKey] = useState('');
  const [newBotToken, setNewBotToken] = useState('');

  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { agentPermissions, fetchAgentPermissions } = useChannelPermissions(agentId);
  const { refetch: refetchPermissions } = useAgentIntegrationPermissions(agentId);

  const isChannelEnabled = useCallback(
    (channelType: string) => {
      const providers = CHANNEL_PROVIDER_MAP[channelType] || [];
      return agentPermissions.some((perm) => perm.is_active && providers.includes(perm.provider_name));
    },
    [agentPermissions],
  );

  useEffect(() => {
    setSettings({
      email_enabled: isChannelEnabled('email'),
      sms_enabled: isChannelEnabled('sms'),
      slack_enabled: isChannelEnabled('slack'),
      discord_enabled: isChannelEnabled('discord'),
      telegram_enabled: isChannelEnabled('telegram'),
      whatsapp_enabled: isChannelEnabled('whatsapp'),
    });
  }, [isChannelEnabled]);

  const getConnectedProviders = useCallback(
    (channelType: string) => {
      const providers = CHANNEL_DISABLE_PROVIDER_MAP[channelType] || [];
      return agentPermissions
        .filter((perm) => perm.is_active && providers.includes(perm.provider_name))
        .map((perm) => perm.provider_name.charAt(0).toUpperCase() + perm.provider_name.slice(1));
    },
    [agentPermissions],
  );

  const channels = useMemo<ChannelCardItem[]>(
    () =>
      CHANNEL_META.map((channel) => {
        const providers = getConnectedProviders(channel.type);
        const enabled = settings[channel.id as keyof ChannelSettings];
        const status = enabled && providers.length > 0 ? 'configured' : 'not_configured';
        return {
          id: channel.id as keyof ChannelSettings,
          name: channel.name,
          description: channel.description,
          icon: channel.icon,
          enabled,
          requiresAuth: channel.requiresAuth,
          providers,
          status,
          disabled: channel.disabled,
        };
      }),
    [getConnectedProviders, settings],
  );

  const openProviderModal = async (channelType: 'email' | 'sms') => {
    try {
      const providerNames = channelType === 'email' ? ['smtp', 'sendgrid', 'mailgun', 'gmail', 'microsoft-outlook'] : ['twilio', 'aws_sns', 'clicksend_sms'];
      const providerOptions = channelType === 'email' ? EMAIL_PROVIDERS : SMS_PROVIDERS;
      const { data: credentials } = await supabase
        .from('user_integration_credentials')
        .select('*, service_providers!inner(name, display_name)')
        .eq('user_id', user?.id)
        .in('connection_status', ['active', 'connected'])
        .in('service_providers.name', providerNames);

      setCredentialModal({
        isOpen: true,
        channelType,
        selectedProvider: '',
        availableProviders: providerOptions,
        availableCredentials: credentials || [],
      });
    } catch (error) {
      console.error(`Error opening ${channelType} provider modal:`, error);
      toast.error(`Failed to load ${channelType.toUpperCase()} providers`);
    }
  };

  const handleDisableChannel = async (channel: keyof ChannelSettings) => {
    try {
      const channelType = channel.replace('_enabled', '');
      const providers = CHANNEL_DISABLE_PROVIDER_MAP[channelType] || [];
      const activePermissions = agentPermissions.filter((perm) => perm.is_active && providers.includes(perm.provider_name));
      for (const permission of activePermissions) {
        const { error } = await supabase.from('agent_integration_permissions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', permission.id);
        if (error) throw error;
      }
      await fetchAgentPermissions();
      await refetchPermissions();
      toast.success(`${channelType.charAt(0).toUpperCase() + channelType.slice(1)} channel disabled`);
    } catch (error) {
      console.error('Error disabling channel:', error);
      toast.error('Failed to disable channel');
    }
  };

  const handleToggle = async (channel: keyof ChannelSettings, enabled: boolean) => {
    if (enabled && channel === 'email_enabled' && !credentialModal.isOpen) return openProviderModal('email');
    if (enabled && channel === 'sms_enabled' && !credentialModal.isOpen) return openProviderModal('sms');
    if (!enabled) return handleDisableChannel(channel);
    setSettings((prev) => ({ ...prev, [channel]: enabled }));
  };

  const handleAuthorizeCredential = async (credentialId: string) => {
    try {
      const { data: credential, error: credentialError } = await supabase
        .from('user_integration_credentials')
        .select('*, service_providers!inner(name, display_name)')
        .eq('id', credentialId)
        .single();
      if (credentialError || !credential) throw new Error('Could not fetch credential details');

      const providerName = credential.service_providers.name;
      const allowedScopes = mapOAuthScopesToAgentCapabilities(credential.scopes_granted || [], providerName);
      const { data: existingPermission } = await supabase
        .from('agent_integration_permissions')
        .select('id, is_active')
        .eq('agent_id', agentId)
        .eq('user_oauth_connection_id', credentialId)
        .single();

      if (existingPermission) {
        const payload = existingPermission.is_active
          ? { allowed_scopes: allowedScopes, updated_at: new Date().toISOString() }
          : { is_active: true, allowed_scopes: allowedScopes, permission_level: 'custom', granted_by_user_id: user?.id, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('agent_integration_permissions').update(payload).eq('id', existingPermission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('agent_integration_permissions').insert({
          agent_id: agentId,
          user_oauth_connection_id: credentialId,
          allowed_scopes: allowedScopes,
          permission_level: 'custom',
          granted_by_user_id: user?.id,
          is_active: true,
        });
        if (error) throw error;
      }

      await fetchAgentPermissions();
      await refetchPermissions();
      setCredentialModal((prev) => ({ ...prev, isOpen: false }));
      toast.success(`Agent authorized with ${allowedScopes.length} ${providerName} capabilities`);
    } catch (error) {
      console.error('Error authorizing credential:', error);
      toast.error('Failed to authorize email access');
    }
  };

  const handleCreateCredential = async () => {
    if (!credentialModal.selectedProvider || !user) return;
    const provider = credentialModal.availableProviders.find((p) => p.id === credentialModal.selectedProvider);
    if (!provider) return;

    try {
      if (provider.authType === 'oauth') {
        setCredentialModal((prev) => ({ ...prev, isOpen: false }));
        if (provider.id === 'microsoft-outlook') {
          window.location.href = '/integrations?provider=microsoft-outlook';
          return;
        }
        toast(`Please set up ${provider.name} in the Integrations page first. OAuth providers require proper authentication flow.`, { icon: 'ℹ️', duration: 4000 });
        return;
      }
      if (provider.authType === 'api_key' && !newApiKey.trim()) return toast.error('API key is required');
      if (provider.authType === 'bot_token' && !newBotToken.trim()) return toast.error('Bot token is required');

      const { data: serviceProvider, error: providerError } = await supabase.from('service_providers').select('id').eq('name', provider.id).single();
      if (providerError || !serviceProvider) throw new Error(`Service provider ${provider.id} not found`);

      const credentialValue = provider.authType === 'bot_token' ? newBotToken : newApiKey;
      const { error } = await supabase.from('user_integration_credentials').insert({
        user_id: user.id,
        service_provider_id: serviceProvider.id,
        external_user_id: `${provider.authType}_${Date.now()}`,
        external_username: provider.name || null,
        connection_name: `${credentialModal.channelType}_${provider.id}`,
        connection_status: 'active',
        credential_type: provider.authType as 'api_key',
        scopes_granted: ['channel_access'],
        vault_access_token_id: credentialValue,
        vault_refresh_token_id: null,
        token_expires_at: null,
        connection_metadata: { provider: provider.id, auth_type: provider.authType, [provider.authType]: credentialValue },
      });
      if (error) throw error;

      toast.success(`${provider.name} credentials saved successfully`);
      setNewApiKey('');
      setNewBotToken('');
      setCredentialModal((prev) => ({ ...prev, isOpen: false }));
      await refetchPermissions();
    } catch (error) {
      console.error('Error creating credential:', error);
      toast.error('Failed to save credentials. Please try again.');
    }
  };

  const handleProviderSelect = (providerId: string) => setCredentialModal((prev) => ({ ...prev, selectedProvider: providerId }));

  const handleIntegrationSetupComplete = async (connection: any) => {
    setIntegrationSetupModal(DEFAULT_SETUP_MODAL);
    await refetchPermissions();
    toast.success(`${connection.provider_name} integration setup completed!`);
  };

  const handleSave = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', agentId)
        .select()
        .single();
      if (error) throw error;
      onAgentUpdated?.(data);
    } catch (error) {
      console.error('Error updating channel settings:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Communication Channels</h3>
        <p className="text-sm text-muted-foreground">Configure which communication channels your agent can use to interact with users.</p>
      </div>

      <ChannelCards channels={channels} onToggle={handleToggle} />

      <CredentialModal
        credentialModal={credentialModal}
        setCredentialModal={setCredentialModal}
        newApiKey={newApiKey}
        setNewApiKey={setNewApiKey}
        newBotToken={newBotToken}
        setNewBotToken={setNewBotToken}
        onProviderSelect={handleProviderSelect}
        onCreateCredential={handleCreateCredential}
        onAuthorizeCredential={handleAuthorizeCredential}
      />

      <StandaloneIntegrationSetupModal
        isOpen={integrationSetupModal.isOpen}
        onClose={() => setIntegrationSetupModal(DEFAULT_SETUP_MODAL)}
        onComplete={handleIntegrationSetupComplete}
        providerName={integrationSetupModal.providerName}
        channelType={integrationSetupModal.channelType}
      />
    </div>
  );
}
