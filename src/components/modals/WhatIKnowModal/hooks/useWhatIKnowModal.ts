import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Datastore } from '@/types';
import type { WhatIKnowModalProps, WhatIKnowModalState } from '../types';

export function useWhatIKnowModal(props: WhatIKnowModalProps): WhatIKnowModalState {
  const { isOpen, agentId, agentData, onAgentUpdated } = props;
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [connectedDatastores, setConnectedDatastores] = useState<string[]>([]);
  const [memoryPreferences, setMemoryPreferences] = useState<string[]>([
    'remember_preferences',
    'track_projects',
    'learn_conversations',
  ]);
  const [contextHistorySize, setContextHistorySize] = useState<number>(
    parseInt(localStorage.getItem(`agent_${agentId}_context_size`) || '25'),
  );
  const [loading, setLoading] = useState(false);
  const [loadingDatastores, setLoadingDatastores] = useState(true);
  const [saved, setSaved] = useState(false);
  const [agentSettings, setAgentSettings] = useState<Record<string, any>>({});
  const [agentMetadata, setAgentMetadata] = useState<Record<string, any>>({});
  const [graphEnabled, setGraphEnabled] = useState(false);
  const [showVectorSelection, setShowVectorSelection] = useState(false);
  const [showKnowledgeSelection, setShowKnowledgeSelection] = useState(false);
  const [showMediaLibrarySelector, setShowMediaLibrarySelector] = useState(false);
  const [assignedMediaCount, setAssignedMediaCount] = useState(0);

  const loadDatastores = useCallback(async () => {
    if (!user) return;
    setLoadingDatastores(true);
    try {
      const { data, error } = await supabase.from('datastores').select('*').eq('user_id', user.id).order('name');
      if (error) throw error;
      setAvailableDatastores(data || []);
    } catch (error) {
      console.error('Error loading datastores:', error);
      toast.error('Failed to load knowledge sources');
    } finally {
      setLoadingDatastores(false);
    }
  }, [supabase, user]);

  const loadAssignedMediaCount = useCallback(async () => {
    if (!user || !agentId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list_documents', agent_id: agentId }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) setAssignedMediaCount(data.data.total_count || 0);
    } catch (error) {
      console.error('Error loading assigned media count:', error);
    }
  }, [agentId, supabase, user]);

  useEffect(() => {
    if (isOpen && user) {
      loadDatastores();
      loadAssignedMediaCount();
    }
  }, [isOpen, user, loadDatastores, loadAssignedMediaCount]);

  useEffect(() => {
    if (!isOpen || !agentId) return;
    (async () => {
      const { data } = await supabase.from('agents').select('metadata').eq('id', agentId).maybeSingle();
      const meta = (data?.metadata || {}) as Record<string, any>;
      const settings = (meta.settings || {}) as Record<string, any>;
      setAgentMetadata(meta);
      setAgentSettings(settings);
      setGraphEnabled(settings.use_account_graph === true);
    })();
  }, [agentId, isOpen, supabase]);

  useEffect(() => {
    if (isOpen && agentData?.agent_datastores) {
      setConnectedDatastores(agentData.agent_datastores.map((ad) => ad.datastore_id));
      setSaved(false);
    }
  }, [agentData, isOpen]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const getDatastoresByType = (type: 'pinecone' | 'getzep') => availableDatastores.filter((ds) => ds.type === type);

  const ensureAccountGraph = async () => {
    const { data: ag } = await supabase.from('account_graphs').select('id').eq('user_id', user?.id).maybeSingle();
    if (ag?.id) return true;
    const { data: provider } = await supabase.from('service_providers').select('id').eq('name', 'getzep').single();
    const { data: conn } = await supabase
      .from('user_integration_credentials')
      .select('id')
      .eq('oauth_provider_id', provider?.id)
      .eq('user_id', user?.id)
      .maybeSingle();
    if (!conn?.id) {
      toast.error('Connect GetZep in Integrations to enable the knowledge graph');
      return false;
    }
    const { error } = await supabase
      .from('account_graphs')
      .insert({ user_id: user?.id, connection_id: conn.id, settings: { retrieval: { hop_depth: 2, max_results: 50 } } });
    return !error;
  };

  const toggleGraphEnabled = async () => {
    const prev = graphEnabled;
    const next = !prev;
    setGraphEnabled(next);
    if (next && !(await ensureAccountGraph())) {
      setGraphEnabled(prev);
      return;
    }
    try {
      const newSettings = { ...(agentSettings || {}), use_account_graph: next };
      const mergedMetadata = { ...(agentMetadata || {}), settings: newSettings };
      await supabase.from('agents').update({ metadata: mergedMetadata }).eq('id', agentId);
      toast.success(next ? 'Knowledge graph enabled' : 'Knowledge graph disabled');
    } catch {
      setGraphEnabled(prev);
      toast.error('Failed to update knowledge graph setting');
    }
  };

  const handleSelectVectorDatastore = () => {
    const vectorDatastores = getDatastoresByType('pinecone');
    const connectedVector = vectorDatastores.find((ds) => connectedDatastores.includes(ds.id));
    if (connectedVector) {
      setConnectedDatastores((prev) => prev.filter((id) => id !== connectedVector.id));
      toast.success('Vector datastore disconnected');
      return;
    }
    setShowVectorSelection(true);
  };

  const handleSelectKnowledgeDatastore = () => {
    void toggleGraphEnabled();
  };

  const handleToggleMemoryPreference = (preferenceId: string) => {
    if (preferenceId === 'forget_sessions') {
      setMemoryPreferences((prev) => (prev.includes(preferenceId) ? [] : [preferenceId]));
      return;
    }
    setMemoryPreferences((prev) => {
      const filtered = prev.filter((id) => id !== 'forget_sessions');
      return filtered.includes(preferenceId)
        ? filtered.filter((id) => id !== preferenceId)
        : [...filtered, preferenceId];
    });
  };

  const handleContextSizeChange = (value: number[]) => {
    const newSize = value[0];
    setContextHistorySize(newSize);
    localStorage.setItem(`agent_${agentId}_context_size`, newSize.toString());
  };

  const handleVectorDatastoreSelect = (datastoreId: string) => {
    const vectorIds = getDatastoresByType('pinecone').map((ds) => ds.id);
    setConnectedDatastores((prev) => [...prev.filter((id) => !vectorIds.includes(id)), datastoreId]);
    setShowVectorSelection(false);
  };

  const handleKnowledgeDatastoreSelect = (datastoreId: string) => {
    const knowledgeIds = getDatastoresByType('getzep').map((ds) => ds.id);
    setConnectedDatastores((prev) => [...prev.filter((id) => !knowledgeIds.includes(id)), datastoreId]);
    setShowKnowledgeSelection(false);
  };

  const hasChanges = () => {
    if (!agentData?.agent_datastores) return connectedDatastores.length > 0;
    const current = agentData.agent_datastores.map((ad) => ad.datastore_id);
    return JSON.stringify([...current].sort()) !== JSON.stringify([...connectedDatastores].sort());
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    setLoading(true);
    try {
      await supabase.from('agent_datastores').delete().eq('agent_id', agentId);
      if (connectedDatastores.length > 0) {
        await supabase
          .from('agent_datastores')
          .insert(connectedDatastores.map((datastore_id) => ({ agent_id: agentId, datastore_id })));
      }
      setSaved(true);
      toast.success('Knowledge connections updated! 🧠');
      if (onAgentUpdated) {
        const { data } = await supabase.from('agents').select('*').eq('id', agentId).single();
        if (data) onAgentUpdated(data);
      }
    } catch (error) {
      console.error('Error updating knowledge connections:', error);
      toast.error('Failed to update knowledge connections');
    } finally {
      setLoading(false);
    }
  }, [agentId, connectedDatastores, onAgentUpdated, supabase, user]);

  return {
    availableDatastores,
    connectedDatastores,
    memoryPreferences,
    contextHistorySize,
    loading,
    loadingDatastores,
    saved,
    graphEnabled,
    assignedMediaCount,
    showMediaLibrarySelector,
    showVectorSelection,
    setShowVectorSelection,
    showKnowledgeSelection,
    setShowKnowledgeSelection,
    setShowMediaLibrarySelector,
    setAssignedMediaCount,
    handleSelectVectorDatastore,
    handleSelectKnowledgeDatastore,
    handleToggleMemoryPreference,
    handleContextSizeChange,
    handleVectorDatastoreSelect,
    handleKnowledgeDatastoreSelect,
    handleSave,
    hasChanges,
    getDatastoresByType,
  };
}

export function useWhatIKnowNavigation() {
  return useNavigate();
}
