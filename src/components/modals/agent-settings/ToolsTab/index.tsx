import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useConnections } from '@/integrations/_shared/hooks/useConnections';
import { PROVIDER_CONFIGS, PROVIDERS_BY_TOOL, DEFAULT_TOOL_SETTINGS, buildTools } from './constants';
import { CredentialModal } from './CredentialModal';
import { ToolsContent } from './ToolsContent';
import type { CredentialModalState, ToolSettings, ToolsTabProps, ToolsTabRef } from './types';

const DEFAULT_CREDENTIAL_MODAL: CredentialModalState = {
  isOpen: false,
  toolType: null,
  selectedProvider: '',
  availableProviders: [],
  availableCredentials: [],
};

export const ToolsTab = forwardRef<ToolsTabRef, ToolsTabProps>(({ agentId, agentData, onAgentUpdated }, ref) => {
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [selectedCredentials, setSelectedCredentials] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [credentialModal, setCredentialModal] = useState<CredentialModalState>(DEFAULT_CREDENTIAL_MODAL);
  const [newApiKey, setNewApiKey] = useState('');
  const [agentSettings, setAgentSettings] = useState<Record<string, unknown>>({});
  const [agentMetadata, setAgentMetadata] = useState<Record<string, unknown>>({});
  const [hasAssignedDocuments, setHasAssignedDocuments] = useState(false);
  const [assignedDocumentsCount, setAssignedDocumentsCount] = useState(0);
  const [refreshingCache, setRefreshingCache] = useState(false);

  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { connections } = useConnections({ includeRevoked: false });

  useImperativeHandle(ref, () => ({ save: handleSave, hasChanges, saving: isLoading, saveSuccess }));

  useEffect(() => {
    const checkAssignedDocuments = async () => {
      if (!agentId || !user) return;
      const { data } = await supabase.from('agent_media_assignments').select('id').eq('agent_id', agentId).eq('user_id', user.id).eq('is_active', true);
      const count = data?.length || 0;
      setHasAssignedDocuments(count > 0);
      setAssignedDocumentsCount(count);
    };
    void checkAssignedDocuments();
  }, [agentId, user, supabase]);

  useEffect(() => {
    if (!agentData) return;
    const metadata = agentData.metadata || {};
    const toolState = metadata.settings || {};
    const shouldEnableOCR = hasAssignedDocuments ? true : (toolState.ocr_processing_enabled || false);
    setAgentMetadata(metadata);
    setAgentSettings(toolState);
    setSettings({
      voice_enabled: toolState.voice_enabled || false,
      web_search_enabled: toolState.web_search_enabled || false,
      document_creation_enabled: toolState.document_creation_enabled || false,
      ocr_processing_enabled: shouldEnableOCR,
      temporary_chat_links_enabled: toolState.temporary_chat_links_enabled || false,
      codex_bridge_enabled: toolState.codex_bridge_enabled || false,
    });
    setSelectedCredentials({
      web_search: toolState.web_search_credential || '',
      voice: toolState.voice_credential || '',
      document_creation: toolState.document_creation_credential || '',
      ocr_processing: toolState.ocr_processing_credential || '',
      temporary_chat_links: toolState.temporary_chat_links_credential || '',
      codex_bridge: toolState.codex_bridge_credential || '',
    });
  }, [agentData, hasAssignedDocuments]);

  const getAvailableCredentials = useCallback((toolType: string) =>
    connections.filter((c) => PROVIDERS_BY_TOOL[toolType]?.includes(c.provider_name) && c.connection_status === 'active'), [connections]);

  const openCredentialModal = async (toolType: 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links' | 'codex_bridge') => {
    const configProviders = PROVIDER_CONFIGS[toolType] || [];
    const providerNames = configProviders.map((p) => p.id);
    let providers = configProviders;
    try {
      const { data: serviceProviders } = await supabase.from('service_providers').select('id, name, display_name').in('name', providerNames).eq('is_enabled', true);
      providers = (serviceProviders || []).map((sp) => {
        const config = configProviders.find((cp) => cp.id === sp.name);
        return { id: sp.id, name: sp.display_name || sp.name, description: config?.description || '', requiresApiKey: config?.requiresApiKey || false, requiresOAuth: config?.requiresOAuth || false };
      });
    } catch (error) {
      console.error('Error loading service providers:', error);
    }
    const { data: credentials } = await supabase.from('user_integration_credentials').select('*').eq('user_id', user?.id).ilike('connection_name', `%${toolType}%`);
    setCredentialModal({ isOpen: true, toolType, selectedProvider: '', availableProviders: providers, availableCredentials: credentials || [] });
  };

  const handleToggle = async (tool: keyof ToolSettings, enabled: boolean) => {
    if (!agentId) return toast.error('Agent ID is missing. Please close and reopen the settings.');
    if (tool === 'ocr_processing_enabled' && !enabled && hasAssignedDocuments) {
      return toast.error(`Cannot disable Read Documents while ${assignedDocumentsCount} document${assignedDocumentsCount !== 1 ? 's are' : ' is'} assigned.`, { duration: 4000 });
    }
    if (enabled) {
      const toolType = tool.replace('_enabled', '') as 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links' | 'codex_bridge';
      if (!['temporary_chat_links', 'document_creation', 'codex_bridge'].includes(toolType) && getAvailableCredentials(toolType).length === 0) {
        return openCredentialModal(toolType);
      }
    }

    setSettings((prev) => ({ ...prev, [tool]: enabled }));
    if (!enabled) setSelectedCredentials((prev) => ({ ...prev, [tool.replace('_enabled', '')]: '' }));

    try {
      const updatedSettings = { ...agentSettings, [tool]: enabled };
      const updatedMetadata = { ...agentMetadata, settings: updatedSettings };
      const { error } = await supabase.from('agents').update({ metadata: updatedMetadata }).eq('id', agentId).eq('user_id', user?.id);
      if (error) throw error;
      setAgentSettings(updatedSettings);
      setAgentMetadata(updatedMetadata);
      onAgentUpdated?.({ ...agentData, id: agentId, metadata: updatedMetadata });
      toast.success(`${tool.replace('_enabled', '').replace('_', ' ')} ${enabled ? 'enabled' : 'disabled'}`, { duration: 2000 });
    } catch (error) {
      console.error('Error updating tool setting:', error);
      setSettings((prev) => ({ ...prev, [tool]: !enabled }));
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} ${tool.replace('_enabled', '').replace('_', ' ')}`);
    }
  };

  const handleCreateCredential = async () => {
    if (!credentialModal.selectedProvider || !user) return;
    const provider = credentialModal.availableProviders.find((p) => p.id === credentialModal.selectedProvider);
    if (!provider) return;
    if (provider.requiresApiKey && !newApiKey.trim()) return toast.error('API key is required');

    try {
      const { error } = await supabase.from('user_integration_credentials').insert({
        user_id: user.id,
        oauth_provider_id: provider.id,
        external_user_id: `api_key_${Date.now()}`,
        external_username: provider.name || null,
        connection_name: `${credentialModal.toolType}_${provider.id}`,
        connection_status: 'active',
        credential_type: 'api_key',
        scopes_granted: provider.requiresApiKey ? ['api_access'] : [],
        vault_access_token_id: provider.requiresApiKey ? newApiKey : null,
        vault_refresh_token_id: null,
        token_expires_at: null,
        connection_metadata: provider.requiresApiKey ? { api_key: newApiKey, provider: provider.id, auth_type: 'api_key' } : { provider: provider.id, auth_type: 'oauth', oauth_pending: true },
      });
      if (error) throw error;
      const toolKey = `${credentialModal.toolType}_enabled` as keyof ToolSettings;
      setSettings((prev) => ({ ...prev, [toolKey]: true }));
      setHasChanges(true);
      setNewApiKey('');
      setCredentialModal((prev) => ({ ...prev, isOpen: false }));
      toast.success(`${provider.name} credentials saved successfully`);
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Failed to save credentials');
    }
  };

  const handleCredentialChange = async (tool: ReturnType<typeof buildTools>[number], value: string) => {
    const previous = selectedCredentials[tool.toolType] || '';
    setSelectedCredentials((prev) => ({ ...prev, [tool.toolType]: value }));
    try {
      const updatedSettings = { ...agentSettings, [`${tool.toolType}_credential`]: value };
      const updatedMetadata = { ...agentMetadata, settings: updatedSettings };
      const { error } = await supabase.from('agents').update({ metadata: updatedMetadata }).eq('id', agentId).eq('user_id', user?.id);
      if (error) throw error;
      setAgentSettings(updatedSettings);
      setAgentMetadata(updatedMetadata);
      onAgentUpdated?.({ ...agentData, id: agentId, metadata: updatedMetadata });
      toast.success(`Credentials updated for ${tool.name}`, { duration: 2000 });
    } catch (error) {
      console.error('Error updating credentials:', error);
      setSelectedCredentials((prev) => ({ ...prev, [tool.toolType]: previous }));
      toast.error(`Failed to update credentials for ${tool.name}`);
    }
  };

  const handleRefreshCache = async () => {
    const userId = agentData?.user_id || user?.id;
    if (!userId) return toast.error('Unable to refresh cache: missing user information');
    setRefreshingCache(true);
    try {
      toast.loading('Refreshing tool cache...', { duration: 1000 });
      const { data, error } = await supabase.functions.invoke('invalidate-agent-tool-cache', { body: { agent_id: agentId, user_id: userId } });
      if (error) return toast.error(`Failed to refresh tool cache: ${error.message}`);
      if (data?.success) toast.success(`Tool cache refreshed successfully! (${data.tools_count || 0} tools updated)`);
      else toast.error(data?.error || 'Failed to refresh cache');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to refresh tool cache: ${message}`);
    } finally {
      setRefreshingCache(false);
    }
  };

  async function handleSave() {
    setIsLoading(true);
    try {
      const updatedMetadata = {
        ...agentMetadata,
        settings: {
          ...agentSettings,
          voice_enabled: settings.voice_enabled,
          web_search_enabled: settings.web_search_enabled,
          document_creation_enabled: settings.document_creation_enabled,
          ocr_processing_enabled: settings.ocr_processing_enabled,
          temporary_chat_links_enabled: settings.temporary_chat_links_enabled,
          codex_bridge_enabled: settings.codex_bridge_enabled,
          web_search_credential: selectedCredentials.web_search,
          voice_credential: selectedCredentials.voice,
          document_creation_credential: selectedCredentials.document_creation,
        },
      };
      const { error } = await supabase.from('agents').update({ metadata: updatedMetadata }).eq('id', agentId).eq('user_id', user?.id);
      if (error) throw error;
      setHasChanges(false);
      setSaveSuccess(true);
      onAgentUpdated?.({ id: agentId, ...agentData, metadata: updatedMetadata });
      toast.success('Tool settings updated successfully! 🛠️');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error updating tool settings:', error);
      toast.error('Failed to update tool settings');
    } finally {
      setIsLoading(false);
    }
  }

  const tools = useMemo(() => buildTools(settings, getAvailableCredentials), [settings, getAvailableCredentials]);

  const handleUseExisting = () => {
    const toolKey = `${credentialModal.toolType}_enabled` as keyof ToolSettings;
    setSettings((prev) => ({ ...prev, [toolKey]: true }));
    setHasChanges(true);
    setCredentialModal((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="space-y-4">
      <ToolsContent
        tools={tools}
        refreshingCache={refreshingCache}
        hasAssignedDocuments={hasAssignedDocuments}
        assignedDocumentsCount={assignedDocumentsCount}
        selectedCredentials={selectedCredentials}
        onRefreshCache={handleRefreshCache}
        onToggle={handleToggle}
        onCredentialChange={handleCredentialChange}
      />

      <CredentialModal
        credentialModal={credentialModal}
        setCredentialModal={setCredentialModal}
        newApiKey={newApiKey}
        setNewApiKey={setNewApiKey}
        onProviderSelect={(providerId) => setCredentialModal((prev) => ({ ...prev, selectedProvider: providerId }))}
        onCreateCredential={handleCreateCredential}
        onUseExisting={handleUseExisting}
      />
    </div>
  );
});

ToolsTab.displayName = 'ToolsTab';
