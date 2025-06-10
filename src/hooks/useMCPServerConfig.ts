import { useState, useCallback, useEffect } from 'react';
import { 
  MCPServer, 
  UseMCPServerConfigReturn,
  MCPApiResponse 
} from '@/lib/mcp/ui-types';

const DTMA_BASE_URL = process.env.DTMA_API_URL || 'http://localhost:3001';

export function useMCPServerConfig(serverId?: string): UseMCPServerConfigReturn {
  const [config, setConfig] = useState<MCPServer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async (id: string): Promise<MCPServer> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${DTMA_BASE_URL}/mcp/servers/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch server: ${response.statusText}`);
      }

      const data: MCPApiResponse<MCPServer> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch server configuration');
      }

      const serverConfig = data.data;
      setConfig(serverConfig);
      return serverConfig;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch server configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (updates: Partial<MCPServer>): Promise<void> => {
    if (!config) {
      throw new Error('No server loaded');
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${DTMA_BASE_URL}/mcp/servers/${config.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update configuration: ${response.statusText}`);
      }

      const data: MCPApiResponse<MCPServer> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to update server configuration');
      }

      const updatedConfig = data.data;
      setConfig(updatedConfig);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update server configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [config]);

  const validateConfig = useCallback(async (
    id: string, 
    configToValidate: Partial<MCPServer>
  ): Promise<{ valid: boolean; errors: string[] }> => {
    try {
      const response = await fetch(`${DTMA_BASE_URL}/mcp/servers/${id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToValidate),
      });

      if (!response.ok) {
        throw new Error(`Failed to validate configuration: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? 
        { valid: true, errors: [] } : 
        { valid: false, errors: data.errors || ['Configuration validation failed'] };

    } catch (err) {
      return { 
        valid: false, 
        errors: [err instanceof Error ? err.message : 'Validation request failed'] 
      };
    }
  }, []);

  const restartServer = useCallback(async (id: string): Promise<void> => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${DTMA_BASE_URL}/mcp/servers/${id}/restart`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to restart server: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to restart server');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restart server';
      setError(errorMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const resetConfig = useCallback((): void => {
    if (config && serverId) {
      // Reset to original state by refetching
      fetchConfig(serverId).catch(() => {
        // Error already handled in fetchConfig
      });
    }
  }, [config, serverId, fetchConfig]);

  // Auto-fetch config if serverId is provided
  useEffect(() => {
    if (serverId) {
      fetchConfig(serverId).catch(() => {
        // Error already handled in fetchConfig
      });
    }
  }, [serverId, fetchConfig]);

  return {
    config,
    loading,
    error,
    updateConfig,
    resetConfig,
  };
} 