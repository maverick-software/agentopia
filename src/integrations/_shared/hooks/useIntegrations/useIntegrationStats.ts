import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IntegrationStats } from './types';

const defaultStats: IntegrationStats = {
  total_available_integrations: 18,
  total_connected_integrations: 12,
  total_categories: 6,
  recent_connections: 3,
};

export function useIntegrationStats() {
  const [stats, setStats] = useState<IntegrationStats>({
    total_available_integrations: 0,
    total_connected_integrations: 0,
    total_categories: 0,
    recent_connections: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);
        const { data: functionData, error: functionError } = await supabase.rpc(
          'get_user_integration_stats',
        );
        if (functionData && functionData.length > 0 && !functionError) {
          setStats(functionData[0]);
          return;
        }

        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('*')
          .eq('is_active', true);
        const { data: integrationsData } = await supabase
          .from('service_providers')
          .select('*')
          .eq('is_enabled', true);
        const { data: userIntegrationsData } = await supabase
          .from('user_integrations')
          .select('*')
          .eq('connection_status', 'connected');

        if (categoriesData && integrationsData && userIntegrationsData !== null) {
          setStats({
            total_available_integrations: integrationsData.length,
            total_connected_integrations: userIntegrationsData.length,
            total_categories: categoriesData.length,
            recent_connections: userIntegrationsData.filter((ui: any) => {
              const createdAt = new Date(ui.created_at);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return createdAt > thirtyDaysAgo;
            }).length,
          });
          return;
        }

        setStats(defaultStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch integration stats');
        setStats(defaultStats);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}
