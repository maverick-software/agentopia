import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EmailMessage } from './types';

export function useGmailOperations(agentId?: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeOperation = async (action: string, parameters: any): Promise<any> => {
    if (!user || !agentId) {
      throw new Error('User or agent not available');
    }

    try {
      setLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await supabase.functions.invoke('gmail-api', {
        body: {
          agent_id: agentId,
          action,
          parameters,
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || `Failed to execute ${action}`);
      }
      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to execute ${action}`;
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (message: EmailMessage): Promise<any> => {
    return executeOperation('send_email', message);
  };

  const readEmails = async (options?: {
    query?: string;
    max_results?: number;
    label_ids?: string[];
  }): Promise<any> => {
    return executeOperation('read_emails', options || {});
  };

  const searchEmails = async (
    query: string,
    options?: { labels?: string[]; max_results?: number },
  ): Promise<any> => {
    return executeOperation('search_emails', { query, ...options });
  };

  const manageLabels = async (
    action: string,
    params: {
      label_name?: string;
      label_id?: string;
      message_ids?: string[];
    },
  ): Promise<any> => {
    return executeOperation('manage_labels', { action, ...params });
  };

  return {
    loading,
    error,
    sendEmail,
    readEmails,
    searchEmails,
    manageLabels,
    executeOperation,
  };
}
