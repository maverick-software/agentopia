import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { ExtendedDatastore } from '../types';

const MAX_TOTAL_FETCH_ATTEMPTS = 5;

export function useDatastores() {
  const { user } = useAuth();
  const [datastores, setDatastores] = useState<ExtendedDatastore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDatastore, setEditingDatastore] = useState<ExtendedDatastore | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const totalFetchAttempts = useRef(0);

  const fetchDatastores = useCallback(
    async (isInitialCall = true) => {
      if (!user) return;

      let currentAttempt = totalFetchAttempts.current + 1;
      if (isInitialCall) {
        currentAttempt = 1;
        totalFetchAttempts.current = 0;
      }
      totalFetchAttempts.current = currentAttempt;

      if (currentAttempt > MAX_TOTAL_FETCH_ATTEMPTS) {
        setError(`Failed to load datastores after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts.`);
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);

        const { data, error: fetchError } = await supabase
          .from('datastores')
          .select('*, agent_datastores(agent_id)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        await new Promise((resolve) => setTimeout(resolve, 300));
        setDatastores(data || []);
        setLoading(false);
        if (isInitialCall) totalFetchAttempts.current = 0;
      } catch (err: any) {
        if (currentAttempt < MAX_TOTAL_FETCH_ATTEMPTS) {
          const delay = 2000;
          setTimeout(() => {
            void fetchDatastores(false);
          }, delay);
          const message = err instanceof Error ? err.message : 'An unknown error occurred';
          setError(`Failed to load datastores. Retrying... (${currentAttempt}/${MAX_TOTAL_FETCH_ATTEMPTS}): ${message}`);
          return;
        }

        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load datastores after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts: ${message}`);
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (user) {
      totalFetchAttempts.current = 0;
      void fetchDatastores(true);
      return;
    }

    setDatastores([]);
    setLoading(false);
    setError(null);
  }, [fetchDatastores, user]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!id || isDeleting) return;

      try {
        setIsDeleting(true);
        setError(null);

        const { error: deleteError } = await supabase.from('datastores').delete().eq('id', id).eq('user_id', user?.id);
        if (deleteError) throw deleteError;

        setDatastores((prev) => prev.filter((datastore) => datastore.id !== id));
        setShowDeleteConfirm(null);
      } catch {
        setError('Failed to delete datastore. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, user?.id],
  );

  const handleCreateOrUpdate = useCallback(
    async (formData: Partial<ExtendedDatastore>) => {
      if (!user?.id) {
        setError('You must be logged in to perform this action.');
        return;
      }

      try {
        setIsSaving(true);
        setError(null);

        if (!formData.name?.trim()) throw new Error('Name is required');
        if (!formData.description?.trim()) throw new Error('Description is required');
        if (!formData.type) throw new Error('Type is required');

        if (formData.type === 'pinecone') {
          if (!formData.config?.connectionId) throw new Error('API Key Connection is required');
          if (!formData.config?.region) throw new Error('Region is required');
          if (!formData.config?.host) throw new Error('Host is required');
          if (!formData.config?.indexName) throw new Error('Index Name is required');
          if (!formData.config?.dimensions) throw new Error('Dimensions is required');
          if (
            typeof formData.similarity_threshold !== 'number' ||
            formData.similarity_threshold < 0 ||
            formData.similarity_threshold > 1
          ) {
            throw new Error('Similarity threshold must be between 0 and 1');
          }
          if (typeof formData.max_results !== 'number' || formData.max_results < 1) {
            throw new Error('Max results must be at least 1');
          }
        }

        if (formData.type === 'getzep') {
          if (!formData.config?.connectionId) throw new Error('API Key Connection is required');
          if (!formData.config?.projectId) throw new Error('Project ID is required');
          if (!formData.config?.collectionName) throw new Error('Collection Name is required');
        }

        const datastoreData = {
          ...formData,
          user_id: user.id,
        };

        const result = editingDatastore
          ? await supabase
              .from('datastores')
              .update(datastoreData)
              .eq('id', editingDatastore.id)
              .eq('user_id', user.id)
              .select()
              .single()
          : await supabase.from('datastores').insert([datastoreData]).select().single();

        if (result.error) throw result.error;

        if (editingDatastore) {
          setDatastores((prev) => prev.map((datastore) => (datastore.id === editingDatastore.id ? result.data : datastore)));
        } else {
          setDatastores((prev) => [result.data, ...prev]);
        }

        setShowCreateModal(false);
        setEditingDatastore(null);
      } finally {
        setIsSaving(false);
      }
    },
    [editingDatastore, user?.id],
  );

  return {
    user,
    datastores,
    loading,
    error,
    showDeleteConfirm,
    isDeleting,
    showCreateModal,
    editingDatastore,
    isSaving,
    setShowCreateModal,
    setEditingDatastore,
    setShowDeleteConfirm,
    fetchDatastores,
    handleDelete,
    handleCreateOrUpdate,
  };
}
