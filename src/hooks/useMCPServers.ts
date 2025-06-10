import { useState, useEffect, useCallback } from 'react';
import { MCPServer, UseMCPServersReturn, MCPServerListResponse } from '@/lib/mcp/ui-types';

const DTMA_BASE_URL = process.env.DTMA_API_URL || 'http://localhost:3001';

export function useMCPServers(): UseMCPServersReturn {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${DTMA_BASE_URL}/mcp/status`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch servers: ${response.statusText}`);
      }

      const data: MCPServerListResponse = await response.json();
      
      if (data.success && data.data) {
        setServers(data.data);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch MCP servers';
      setError(errorMessage);
      console.error('Error fetching MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateServer = useCallback(async (id: string, updates: Partial<MCPServer>) => {
    try {
      setError(null);

      const response = await fetch(`${DTMA_BASE_URL}/mcp/servers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update server: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update the local state
        setServers(prev => 
          prev.map(server => 
            server.id.toString() === id 
              ? { ...server, ...updates }
              : server
          )
        );
      } else {
        throw new Error(data.error || 'Failed to update server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update server';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deleteServer = useCallback(async (id: string) => {
    try {
      setError(null);

      const response = await fetch(`${DTMA_BASE_URL}/mcp/groups/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete server: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Remove from local state
        setServers(prev => prev.filter(server => server.id.toString() !== id));
      } else {
        throw new Error(data.error || 'Failed to delete server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete server';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return {
    servers,
    loading,
    error,
    refetch,
    updateServer,
    deleteServer,
  };
} 