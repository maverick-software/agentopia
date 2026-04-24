import { useState, useEffect, useCallback } from 'react';
import { useAgentIntegrationPermissions } from '@/integrations/_shared';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ToolPermissionsHook {
  agentPermissions: AgentPermission[];
  isLoading: boolean;
  error: string | null;
  refetchIntegrationPermissions: () => Promise<void>;
}

export function useToolPermissions(agentId: string): ToolPermissionsHook {
  const [agentPermissions, setAgentPermissions] = useState<AgentPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the shared hook for integration permissions
  const { permissions: integrationPermissions, refetch: refetchIntegrationPermissions } = useAgentIntegrationPermissions(agentId);

  // Map integration permissions to our format
  useEffect(() => {
    const mappedPermissions = integrationPermissions.map(perm => ({
      id: perm.permission_id,
      connection_id: perm.connection_id,
      provider_name: perm.provider_name,
      external_username: perm.external_username,
      is_active: perm.is_active,
      allowed_scopes: perm.allowed_scopes || []
    }));
    setAgentPermissions(mappedPermissions);
    setIsLoading(false);
  }, [integrationPermissions]);

  const wrappedRefetchIntegrationPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await refetchIntegrationPermissions();
    } catch (err: any) {
      console.error('Failed to refetch integration permissions:', err);
      setError(err.message || 'Failed to refresh permissions');
    } finally {
      setIsLoading(false);
    }
  }, [refetchIntegrationPermissions]);

  // Default scopes for different providers
  const defaultScopesForProvider = useCallback((provider: string): string[] => {
    // For unified web search or individual search providers
    if (['serper_api','serpapi','brave_search','web_search'].includes(provider)) {
      return ['web_search','news_search','image_search','local_search'];
    }
    // SMTP tools
    if (provider === 'smtp') {
      return ['smtp_send_email','smtp_email_templates','smtp_email_stats'];
    }
    return [];
  }, []);

  return {
    agentPermissions,
    isLoading,
    error,
    refetchIntegrationPermissions: wrappedRefetchIntegrationPermissions,
    defaultScopesForProvider
  };
}

