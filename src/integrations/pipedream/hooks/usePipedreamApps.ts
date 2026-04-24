import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import {
  fetchPipedreamApps,
  syncPipedreamAccounts,
  type PipedreamAccount,
  type PipedreamApp,
} from '../services/pipedreamService';

export function usePipedreamApps(searchTerm: string) {
  const supabase = useSupabaseClient();
  const [apps, setApps] = useState<PipedreamApp[]>([]);
  const [accounts, setAccounts] = useState<PipedreamAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [{ apps: pipedreamApps }, syncedAccounts] = await Promise.all([
          fetchPipedreamApps(supabase, {
            q: searchTerm || undefined,
            limit: 50,
            has_actions: true,
          }),
          syncPipedreamAccounts(supabase),
        ]);

        if (!cancelled) {
          setApps(pipedreamApps);
          setAccounts(syncedAccounts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Pipedream apps');
          setApps([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [searchTerm, supabase]);

  return { apps, accounts, loading, error };
}
