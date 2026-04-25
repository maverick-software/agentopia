import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { GmailOperationLog } from './types';

export function useGmailOperationLogs(agentId?: string, limit = 50) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<GmailOperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('gmail_operation_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        throw new Error(fetchError.message);
      }
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch operation logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, agentId, limit]);

  return {
    logs,
    loading,
    error,
    fetchLogs,
    clearLogs: () => setLogs([]),
  };
}
