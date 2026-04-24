import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { AgentGmailPermission } from './types';

export function useAgentGmailPermissions(agentId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AgentGmailPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !agentId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agent_integration_permissions')
        .select(
          `
          *,
          user_integration_credentials(
            external_username,
            oauth_provider_id,
            service_providers(name)
          )
        `,
        )
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', user.id);

      const filteredData = (data || []).filter(
        (permission: any) =>
          permission.user_integration_credentials &&
          permission.user_integration_credentials.service_providers &&
          permission.user_integration_credentials.service_providers.name === 'gmail',
      );

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setPermissions(filteredData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent permissions');
    } finally {
      setLoading(false);
    }
  };

  const grantPermissions = async (
    connectionId: string,
    scopes: string[],
    usageLimits?: { max_emails_per_day?: number; max_api_calls_per_hour?: number },
  ): Promise<void> => {
    if (!user || !agentId) {
      throw new Error('User or agent not available');
    }

    const toastId = toast.loading('Granting permissions...');

    try {
      const { error: upsertError } = await supabase
        .from('agent_integration_permissions')
        .upsert(
          {
            agent_id: agentId,
            user_oauth_connection_id: connectionId,
            granted_by_user_id: user.id,
            allowed_scopes: scopes,
            permission_level: 'custom',
            is_active: true,
          },
          {
            onConflict: 'agent_id, user_oauth_connection_id',
          },
        );

      if (upsertError) throw upsertError;
      toast.success('Permissions granted successfully!', { id: toastId });
      await fetchPermissions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to grant permissions';
      toast.error(errorMessage, { id: toastId });
      throw err;
    }
  };

  const revokePermissions = async (permissionId: string): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error: updateError } = await supabase
        .from('agent_integration_permissions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', permissionId);

      if (updateError) throw new Error(updateError.message);
      await fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke permissions');
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
    refetch: fetchPermissions,
  };
}
