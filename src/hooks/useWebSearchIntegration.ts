import { useState, useEffect } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

export interface WebSearchConnection {
  id: string;
  user_id: string;
  oauth_provider_id: string;
  provider_name: string;
  provider_display_name: string;
  external_username: string; // API key name
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentWebSearchPermission {
  id: string;
  agent_id: string;
  user_oauth_connection_id: string;
  granted_by_user_id: string;
  allowed_scopes: string[];
  permission_level: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for managing web search connections (API keys stored as OAuth-style connections)
 */
export function useWebSearchConnection() {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [connections, setConnections] = useState<WebSearchConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_oauth_connections')
        .select(`
          *,
          oauth_providers!inner(
            name,
            display_name
          )
        `)
        .eq('user_id', user.id)
        .in('oauth_providers.name', ['serper_api', 'serpapi', 'brave_search'])
        .eq('is_active', true);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const formattedConnections = (data || []).map((conn: any) => ({
        id: conn.id,
        user_id: conn.user_id,
        oauth_provider_id: conn.oauth_provider_id,
        provider_name: conn.oauth_providers.name,
        provider_display_name: conn.oauth_providers.display_name,
        external_username: conn.external_username,
        is_active: conn.is_active,
        created_at: conn.created_at,
        updated_at: conn.updated_at,
      }));

      setConnections(formattedConnections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch web search connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  return {
    connections,
    connection: connections.length > 0 ? connections[0] : null,
    loading,
    error,
    refetch: fetchConnections
  };
}

/**
 * Hook for managing agent web search permissions (using same system as Gmail)
 */
export function useAgentWebSearchPermissions(agentId?: string) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [permissions, setPermissions] = useState<AgentWebSearchPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !agentId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agent_oauth_permissions')
        .select(`
          *,
          user_oauth_connections!inner(
            external_username,
            oauth_provider_id,
            oauth_providers!inner(name, display_name)
          )
        `)
        .eq('agent_id', agentId)
        .in('user_oauth_connections.oauth_providers.name', ['serper_api', 'serpapi', 'brave_search'])
        .eq('user_oauth_connections.user_id', user.id);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setPermissions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent web search permissions');
    } finally {
      setLoading(false);
    }
  };

  const grantPermissions = async (
    connectionId: string,
    permissions: string[] = ['web_search', 'news_search', 'scrape_and_summarize']
  ): Promise<void> => {
    if (!user || !agentId) {
      throw new Error('User or agent not available');
    }

    const toastId = toast.loading('Granting web search permissions...');

    try {
      const { error } = await supabase
        .from('agent_oauth_permissions')
        .upsert({
          agent_id: agentId,
          user_oauth_connection_id: connectionId,
          granted_by_user_id: user.id,
          allowed_scopes: permissions,
          permission_level: 'custom',
          is_active: true,
        }, {
          onConflict: 'agent_id, user_oauth_connection_id'
        });

      if (error) {
        throw error;
      }

      toast.success('Web search permissions granted successfully!', { id: toastId });
      await fetchPermissions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to grant web search permissions';
      console.error('Error granting web search permissions:', errorMessage);
      toast.error(errorMessage, { id: toastId });
      throw err;
    }
  };

  const revokePermissions = async (permissionId: string): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await supabase
        .from('agent_oauth_permissions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', permissionId);

      if (error) {
        throw new Error(error.message);
      }

      await fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke web search permissions');
      throw err;
    }
  };

  useEffect(() => {
    if (user && agentId) {
      fetchPermissions();
    }
  }, [user, agentId]);

  return {
    permissions,
    loading,
    error,
    grantPermissions,
    revokePermissions,
    refetch: fetchPermissions
  };
} 