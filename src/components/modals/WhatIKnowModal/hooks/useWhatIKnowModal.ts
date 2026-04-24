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
  const [showVectorSelection, setShowVectorSelection] = useState(false);
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

  const getDatastoresByType = (type: 'pinecone') => availableDatastores.filter((ds) => ds.type === type);

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
    assignedMediaCount,
    showMediaLibrarySelector,
    showVectorSelection,
    setShowVectorSelection,
    setShowMediaLibrarySelector,
    setAssignedMediaCount,
    handleSelectVectorDatastore,
    handleToggleMemoryPreference,
    handleContextSizeChange,
    handleVectorDatastoreSelect,
    handleSave,
    hasChanges,
    getDatastoresByType,
  };
}

export function useWhatIKnowNavigation() {
  return useNavigate();
}
