import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import type { Datastore } from '@/types';
import type { WhatIKnowModalProps } from '../types';

const MEMORY_PREFERENCES = [
  { id: 'remember_preferences', label: 'Remember your preferences', description: 'Your communication style, work patterns, and personal preferences' },
  { id: 'track_projects', label: 'Keep track of ongoing projects', description: 'Project status, deadlines, and collaborative work details' },
  { id: 'learn_conversations', label: 'Learn from our conversations', description: 'Patterns, insights, and context from our chat history' },
  { id: 'forget_sessions', label: 'Forget after each session', description: 'Start fresh each time without remembering previous conversations' },
];

export function useWhatIKnowModalState({ isOpen, agentId, agentData, onAgentUpdated }: WhatIKnowModalProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [connectedDatastores, setConnectedDatastores] = useState<string[]>([]);
  const [memoryPreferences, setMemoryPreferences] = useState<string[]>(['remember_preferences', 'track_projects', 'learn_conversations']);
  const [contextHistorySize, setContextHistorySize] = useState<number>(parseInt(localStorage.getItem(`agent_${agentId}_context_size`) || '25'));
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

  const getDatastoresByType = (type: 'pinecone' | 'getzep') => availableDatastores.filter((ds) => ds.type === type);

  const loadDatastores = useCallback(async () => {
    if (!user) return;
    setLoadingDatastores(true);
    try {
      const { data: datastores, error } = await supabase.from('datastores').select('*').eq('user_id', user.id).order('name');
      if (error) throw error;
      setAvailableDatastores(datastores || []);
    } catch (error: any) {
      console.error('Error loading datastores:', error);
      toast.error('Failed to load knowledge sources');
    } finally {
      setLoadingDatastores(false);
    }
  }, [user, supabase]);

  const loadAssignedMediaCount = useCallback(async () => {
    if (!user || !agentId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_documents', agent_id: agentId }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) setAssignedMediaCount(data.data.total_count || 0);
      }
    } catch (error) {
      console.error('Error loading assigned media count:', error);
    }
  }, [user, agentId, supabase]);

  useEffect(() => {
    if (isOpen && user) {
      loadDatastores();
      loadAssignedMediaCount();
    }
  }, [isOpen, user, loadDatastores, loadAssignedMediaCount]);

  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!isOpen || !agentId) return;
      try {
        const { data, error } = await supabase.from('agents').select('metadata').eq('id', agentId).maybeSingle();
        if (error) {
          setAgentMetadata({});
          setAgentSettings({});
          setGraphEnabled(false);
          return;
        }
        const meta = (data?.metadata || {}) as Record<string, any>;
        const settings = (meta.settings || {}) as Record<string, any>;
        setAgentMetadata(meta);
        setAgentSettings(settings);
        setGraphEnabled(settings.use_account_graph === true);
      } catch {
        setAgentMetadata({});
        setAgentSettings({});
        setGraphEnabled(false);
      }
    };
    loadAgentSettings();
  }, [isOpen, agentId, supabase]);

  useEffect(() => {
    if (!isOpen || !agentData?.agent_datastores) return;
    setConnectedDatastores(agentData.agent_datastores.map((ad) => ad.datastore_id));
    setSaved(false);
  }, [isOpen, agentData]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const ensureAccountGraph = async () => {
    try {
      const { data: ag } = await supabase.from('account_graphs').select('id').eq('user_id', user?.id).maybeSingle();
      if (ag?.id) return true;
      const { data: provider } = await supabase.from('service_providers').select('id').eq('name', 'getzep').single();
      if (!provider) return false;
      const { data: conn } = await supabase
        .from('user_integration_credentials')
        .select('id')
        .eq('oauth_provider_id', provider.id)
        .eq('user_id', user?.id)
        .maybeSingle();
      if (!conn?.id) return false;
      const { error } = await supabase
        .from('account_graphs')
        .insert({ user_id: user?.id, connection_id: conn.id, settings: { retrieval: { hop_depth: 2, max_results: 50 } } });
      return !error;
    } catch {
      return false;
    }
  };

  const toggleGraphEnabled = async () => {
    const prev = graphEnabled;
    const next = !prev;
    setGraphEnabled(next);
    if (next) {
      const ok = await ensureAccountGraph();
      if (!ok) {
        setGraphEnabled(prev);
        toast.error('Connect GetZep in Integrations to enable the knowledge graph');
        return;
      }
    }

    try {
      const newSettings = { ...(agentSettings || {}), use_account_graph: next };
      const mergedMetadata = { ...(agentMetadata || {}), settings: newSettings };
      const { data, error } = await supabase.from('agents').update({ metadata: mergedMetadata }).eq('id', agentId).select('metadata').single();
      if (error) throw error;
      if (data?.metadata) {
        setAgentMetadata(data.metadata);
        setAgentSettings(data.metadata.settings || {});
      }
      toast.success(next ? 'Knowledge graph enabled' : 'Knowledge graph disabled');
    } catch (e: any) {
      setGraphEnabled(prev);
      toast.error(`Failed to update knowledge graph setting: ${e.message || 'Unknown error'}`);
    }
  };

  const handleToggleMemoryPreference = (preferenceId: string) => {
    if (preferenceId === 'forget_sessions') {
      setMemoryPreferences((prev) => (prev.includes(preferenceId) ? [] : [preferenceId]));
      return;
    }
    setMemoryPreferences((prev) => {
      const filtered = prev.filter((id) => id !== 'forget_sessions');
      return filtered.includes(preferenceId) ? filtered.filter((id) => id !== preferenceId) : [...filtered, preferenceId];
    });
  };

  const handleContextSizeChange = (value: number[]) => {
    const newSize = value[0];
    setContextHistorySize(newSize);
    localStorage.setItem(`agent_${agentId}_context_size`, String(newSize));
  };

  const handleSelectVectorDatastore = () => {
    const vectorDatastores = getDatastoresByType('pinecone');
    const connectedVector = vectorDatastores.find((ds) => connectedDatastores.includes(ds.id));
    if (connectedVector) {
      setConnectedDatastores((prev) => prev.filter((id) => id !== connectedVector.id));
      toast.success('Vector datastore disconnected');
    } else {
      setShowVectorSelection(true);
    }
  };

  const handleVectorDatastoreSelect = (datastoreId: string) => {
    const vectorIds = getDatastoresByType('pinecone').map((ds) => ds.id);
    setConnectedDatastores((prev) => [...prev.filter((id) => !vectorIds.includes(id)), datastoreId]);
    setShowVectorSelection(false);
    const datastore = availableDatastores.find((ds) => ds.id === datastoreId);
    toast.success(`Connected to vector datastore: ${datastore?.name || 'Unknown'}`);
  };

  const handleKnowledgeDatastoreSelect = (datastoreId: string) => {
    const knowledgeIds = getDatastoresByType('getzep').map((ds) => ds.id);
    setConnectedDatastores((prev) => [...prev.filter((id) => !knowledgeIds.includes(id)), datastoreId]);
    setShowKnowledgeSelection(false);
    const datastore = availableDatastores.find((ds) => ds.id === datastoreId);
    toast.success(`Connected to knowledge graph: ${datastore?.name || 'Unknown'}`);
  };

  const hasChanges = () => {
    if (!agentData?.agent_datastores) return connectedDatastores.length > 0;
    const current = agentData.agent_datastores.map((ad) => ad.datastore_id).sort();
    const next = [...connectedDatastores].sort();
    return JSON.stringify(current) !== JSON.stringify(next);
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    setLoading(true);
    try {
      await supabase.from('agent_datastores').delete().eq('agent_id', agentId);
      if (connectedDatastores.length > 0) {
        const connections = connectedDatastores.map((datastoreId) => ({ agent_id: agentId, datastore_id: datastoreId }));
        const { error } = await supabase.from('agent_datastores').insert(connections);
        if (error) throw error;
      }
      toast.success('Knowledge connections updated! 🧠');
      setSaved(true);
      if (onAgentUpdated) {
        const { data: updatedAgent } = await supabase.from('agents').select('*').eq('id', agentId).single();
        if (updatedAgent) onAgentUpdated(updatedAgent);
      }
    } catch (error: any) {
      console.error('Error updating knowledge connections:', error);
      toast.error('Failed to update knowledge connections');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, connectedDatastores, supabase, onAgentUpdated]);

  return {
    navigate,
    MEMORY_PREFERENCES,
    availableDatastores,
    connectedDatastores,
    memoryPreferences,
    contextHistorySize,
    loading,
    loadingDatastores,
    saved,
    graphEnabled,
    showVectorSelection,
    showKnowledgeSelection,
    showMediaLibrarySelector,
    assignedMediaCount,
    setShowVectorSelection,
    setShowKnowledgeSelection,
    setShowMediaLibrarySelector,
    setAssignedMediaCount,
    getDatastoresByType,
    hasChanges,
    handleSave,
    handleToggleMemoryPreference,
    handleContextSizeChange,
    handleSelectVectorDatastore,
    toggleGraphEnabled,
    handleVectorDatastoreSelect,
    handleKnowledgeDatastoreSelect,
  };
}
