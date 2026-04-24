import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserIntegration } from './types';

export function useUserIntegrations() {
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserIntegrations() {
      try {
        setLoading(true);
        setError(null);
        const { data, error: queryError } = await supabase
          .from('user_integrations')
          .select('*')
          .order('created_at', { ascending: false });

        if (queryError) {
          if (queryError.code === '42P01') {
            setUserIntegrations([]);
          } else {
            throw queryError;
          }
        } else {
          setUserIntegrations(data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user integrations');
        setUserIntegrations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchUserIntegrations();
  }, []);

  const connectIntegration = async (
    integrationId: string,
    connectionName?: string,
    configuration?: Record<string, any>,
  ) => {
    try {
      const { data, error: upsertError } = await supabase
        .from('user_integrations')
        .insert({
          integration_id: integrationId,
          connection_name: connectionName,
          connection_status: 'pending',
          configuration: configuration || {},
        })
        .select()
        .single();

      if (upsertError) throw upsertError;
      setUserIntegrations((prev) => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to connect integration',
      };
    }
  };

  const disconnectIntegration = async (userIntegrationId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('user_integrations')
        .update({ connection_status: 'disconnected' })
        .eq('id', userIntegrationId);

      if (updateError) throw updateError;
      setUserIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === userIntegrationId
            ? { ...integration, connection_status: 'disconnected' as const }
            : integration,
        ),
      );
      return { error: null };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Failed to disconnect integration',
      };
    }
  };

  return {
    userIntegrations,
    loading,
    error,
    connectIntegration,
    disconnectIntegration,
  };
}
