import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Terminal, XCircle, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { OverviewTab } from '@/components/dtma-console/OverviewTab';
import { ContainersTab } from '@/components/dtma-console/ContainersTab';
import { SystemTab } from '@/components/dtma-console/SystemTab';
import { LogsTab } from '@/components/dtma-console/LogsTab';
import type { DTMAStatus, SystemMetrics } from '@/components/dtma-console/types';

interface DTMAConsoleProps {
  toolboxId: string;
  dropletIp: string;
}

export const DTMAConsole: React.FC<DTMAConsoleProps> = ({ toolboxId, dropletIp }) => {
  const [dtmaStatus, setDtmaStatus] = useState<DTMAStatus | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Check DTMA connectivity and status
  const checkDTMAStatus = useCallback(async () => {
    setIsLoading(true);
    setConnectionError(null);
    
    try {
      // Call our Supabase Edge Function to check DTMA status
      const { data, error } = await supabase.functions.invoke('toolbox-dtma-console', {
        body: { toolboxId, action: 'status' }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        setDtmaStatus(data.dtma_status);
        setSystemMetrics(data.system_metrics);
        setConnectionError(null);
      } else {
        setConnectionError(data.error || 'Failed to connect to DTMA');
      }
      
      setLastChecked(new Date());
    } catch (error) {
      console.error('DTMA status check failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setDtmaStatus(null);
      setSystemMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [toolboxId]);

  // Redeploy DTMA service
  const redeployDTMA = async () => {
    setIsRedeploying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('toolbox-dtma-console', {
        body: { toolboxId, action: 'redeploy' }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        // Add success log
        setLogs(prev => [...prev, `${new Date().toISOString()}: DTMA redeployment initiated successfully`]);
        
        // Wait a bit then check status
        setTimeout(() => {
          checkDTMAStatus();
        }, 5000);
      } else {
        throw new Error(data.error || 'Redeployment failed');
      }
    } catch (error) {
      console.error('DTMA redeployment failed:', error);
      setLogs(prev => [...prev, `${new Date().toISOString()}: ERROR - ${error instanceof Error ? error.message : 'Redeployment failed'}`]);
    } finally {
      setIsRedeploying(false);
    }
  };

  // Restart DTMA service
  const restartDTMA = async () => {
    setIsRedeploying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('toolbox-dtma-console', {
        body: { toolboxId, action: 'restart' }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        setLogs(prev => [...prev, `${new Date().toISOString()}: DTMA restart initiated successfully`]);
        
        // Wait a bit then check status
        setTimeout(() => {
          checkDTMAStatus();
        }, 3000);
      } else {
        throw new Error(data.error || 'Restart failed');
      }
    } catch (error) {
      console.error('DTMA restart failed:', error);
      setLogs(prev => [...prev, `${new Date().toISOString()}: ERROR - ${error instanceof Error ? error.message : 'Restart failed'}`]);
    } finally {
      setIsRedeploying(false);
    }
  };

  // Initial load
  useEffect(() => {
    checkDTMAStatus();
  }, [checkDTMAStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkDTMAStatus, 30000);
    return () => clearInterval(interval);
  }, [checkDTMAStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Terminal className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold">DTMA Console</h2>
          <Badge variant="outline" className="text-xs">
            {dropletIp}:30000
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          {lastChecked && (
            <span className="text-sm text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={checkDTMAStatus}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {connectionError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-700">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Connection Failed</span>
            </div>
            <p className="text-sm text-red-600 mt-2">{connectionError}</p>
            <div className="mt-4 space-x-2">
              <Button
                onClick={restartDTMA}
                disabled={isRedeploying}
                size="sm"
                variant="outline"
              >
                <Power className="h-4 w-4 mr-2" />
                Restart DTMA
              </Button>
              <Button
                onClick={redeployDTMA}
                disabled={isRedeploying}
                size="sm"
                variant="outline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Redeploy DTMA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab
            toolboxId={toolboxId}
            dropletIp={dropletIp}
            dtmaStatus={dtmaStatus}
            systemMetrics={systemMetrics}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          <ContainersTab dtmaStatus={dtmaStatus} />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemTab
            dropletIp={dropletIp}
            isRedeploying={isRedeploying}
            isLoading={isLoading}
            restartDTMA={restartDTMA}
            redeployDTMA={redeployDTMA}
            checkDTMAStatus={checkDTMAStatus}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogsTab logs={logs} onClear={() => setLogs([])} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DTMAConsole; 