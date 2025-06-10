import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  MCPServerHealth, 
  UseMCPServerHealthReturn,
  MCPApiResponse 
} from '@/lib/mcp/ui-types';

const DTMA_BASE_URL = process.env.DTMA_API_URL || 'http://localhost:3001';

export function useMCPServerHealth(serverId?: string): UseMCPServerHealthReturn {
  const [health, setHealth] = useState<MCPServerHealth>({
    overall: 'unknown',
    checks: {
      connectivity: false,
      responseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    },
    lastChecked: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!serverId) {
      setError('No server ID provided');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${DTMA_BASE_URL}/mcp/health/${serverId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch health status: ${response.statusText}`);
      }

      const data: MCPApiResponse<MCPServerHealth> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch server health');
      }

      const healthData = {
        ...data.data,
        lastChecked: new Date(data.data.lastChecked),
      };
      
      setHealth(healthData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch server health';
      setError(errorMessage);
      
      // Set health to unknown state on error
      setHealth(prev => ({
        ...prev,
        overall: 'unknown',
        lastChecked: new Date(),
      }));
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const startMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!serverId) {
      return;
    }

    // Initial fetch
    refresh();

    // Set up periodic health checks every 30 seconds
    intervalRef.current = setInterval(() => {
      refresh();
    }, 30000);
  }, [serverId, refresh]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start monitoring when serverId is provided
  useEffect(() => {
    if (serverId) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    // Cleanup on unmount or serverId change
    return () => {
      stopMonitoring();
    };
  }, [serverId, startMonitoring, stopMonitoring]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    health,
    loading,
    error,
    refresh,
    startMonitoring,
    stopMonitoring,
  };
} 