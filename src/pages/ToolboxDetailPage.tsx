import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getToolboxById, AccountToolEnvironmentRecord, refreshToolboxStatus } from '@/lib/api/toolboxes'; // Changed path to use alias
import { listToolInstancesForToolbox, AccountToolInstanceRecord } from '@/lib/api/toolboxTools'; // Import for tool instances
import { Loader2, Server, AlertTriangle, Package, PlayCircle, StopCircle, Trash2, ExternalLink as ExternalLinkIcon, Eye, RefreshCw, Activity, Cpu, HardDrive, MemoryStick, Network, CheckCircle, XCircle, Clock, Terminal, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// DTMA connectivity and system status interfaces
interface DTMAHealthStatus {
  healthy: boolean;
  version?: string;
  uptime?: number;
  error?: string;
}

interface DTMASystemStatus {
  cpu_load_percent?: number;
  memory?: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
  };
  disk?: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    mount: string;
  };
  uptime?: number;
}

interface DTMATool {
  id: string;
  name: string;
  status: string;
  ports?: Array<{
    private_port: number;
    public_port: number;
    type: string;
  }>;
}

// Helper function to get status text/color for tool instances
const getToolInstanceStatusAppearance = (status: AccountToolInstanceRecord['status_on_toolbox']) => {
  switch (status) {
    case 'active':
    case 'running':
      return { text: 'Running', color: 'bg-green-500/20 text-green-400 border-green-500/50', icon: <PlayCircle className="h-4 w-4 text-green-400" /> };
    case 'stopped':
      return { text: 'Stopped', color: 'bg-red-500/20 text-red-400 border-red-500/50', icon: <StopCircle className="h-4 w-4 text-red-400" /> };
    case 'pending_deploy':
    case 'deploying':
    case 'installing':
    case 'pending_install':
      return { text: 'Deploying', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: <Loader2 className="h-4 w-4 animate-spin text-yellow-400" /> };
    case 'error':
    case 'error_install':
    case 'error_runtime':
      return { text: 'Error', color: 'bg-red-700/30 text-red-300 border-red-700/50', icon: <AlertTriangle className="h-4 w-4 text-red-300" /> };
    case 'uninstalled':
       return { text: 'Uninstalled', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', icon: <Trash2 className="h-4 w-4 text-gray-400" /> };
    default:
      return { text: status ? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown', color: 'bg-gray-600/30 text-gray-300 border-gray-600/50', icon: <Package className="h-4 w-4"/> };
  }
};

export function ToolboxDetailPage() {
  const { toolboxId } = useParams<{ toolboxId: string }>();
  const { user } = useAuth();
  const [toolbox, setToolbox] = useState<AccountToolEnvironmentRecord | null>(null);
  const [loadingToolbox, setLoadingToolbox] = useState(true);
  const [toolboxError, setToolboxError] = useState<string | null>(null);

  const [toolInstances, setToolInstances] = useState<AccountToolInstanceRecord[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);

  // DTMA Diagnostics State
  const [dtmaHealth, setDtmaHealth] = useState<DTMAHealthStatus | null>(null);
  const [dtmaSystemStatus, setDtmaSystemStatus] = useState<DTMASystemStatus | null>(null);
  const [dtmaTools, setDtmaTools] = useState<DTMATool[]>([]);
  const [loadingDtma, setLoadingDtma] = useState(false);
  const [dtmaError, setDtmaError] = useState<string | null>(null);
  const [lastDtmaCheck, setLastDtmaCheck] = useState<Date | null>(null);

  // Action states
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const fetchToolboxDetails = useCallback(async () => {
    if (!user || !toolboxId) return;
    setLoadingToolbox(true);
    setToolboxError(null);
    try {
      const fetchedToolbox = await getToolboxById(toolboxId);
      if (fetchedToolbox) {
        setToolbox(fetchedToolbox);
      } else {
        setToolboxError('Toolbox not found.');
      }
    } catch (err: any) {
      console.error('Error fetching toolbox details:', err);
      setToolboxError(err.message || 'Failed to load toolbox details.');
    }
    setLoadingToolbox(false);
  }, [user, toolboxId]);

  const fetchToolInstances = useCallback(async () => {
    if (!user || !toolboxId) return;
    setLoadingTools(true);
    setToolsError(null);
    try {
      const fetchedInstances = await listToolInstancesForToolbox(toolboxId);
      setToolInstances(fetchedInstances || []);
    } catch (err: any) {
      console.error('Error fetching tool instances:', err);
      setToolsError(err.message || 'Failed to load tool instances.');
    }
    setLoadingTools(false);
  }, [user, toolboxId]);

  // DTMA Connectivity Functions
  const checkDtmaHealth = useCallback(async (ipAddress: string) => {
    const dtmaPort = 30000;
    const dtmaBaseUrl = `http://${ipAddress}:${dtmaPort}`;
    
    try {
      const response = await fetch(`${dtmaBaseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          version: data.version,
          uptime: data.uptime
        };
      } else {
        return {
          healthy: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      return {
        healthy: false,
        error: error.name === 'TimeoutError' 
          ? 'Connection timeout - DTMA service may not be running'
          : `Connection failed: ${error.message}`
      };
    }
  }, []);

  const getDtmaSystemStatus = useCallback(async (ipAddress: string, bearerToken?: string) => {
    if (!bearerToken) return null;
    
    const dtmaPort = 30000;
    const dtmaBaseUrl = `http://${ipAddress}:${dtmaPort}`;
    
    try {
      const response = await fetch(`${dtmaBaseUrl}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error fetching DTMA system status:', error);
      return null;
    }
  }, []);

  const getDtmaTools = useCallback(async (ipAddress: string, bearerToken?: string) => {
    if (!bearerToken) return [];
    
    const dtmaPort = 30000;
    const dtmaBaseUrl = `http://${ipAddress}:${dtmaPort}`;
    
    try {
      const response = await fetch(`${dtmaBaseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching DTMA tools:', error);
      return [];
    }
  }, []);

  const runDtmaDiagnostics = useCallback(async () => {
    if (!toolbox?.public_ip_address) {
      setDtmaError('No IP address available for DTMA connectivity test');
      return;
    }

    setLoadingDtma(true);
    setDtmaError(null);
    setDtmaHealth(null);
    setDtmaSystemStatus(null);
    setDtmaTools([]);

    try {
      // Check health first
      const healthStatus = await checkDtmaHealth(toolbox.public_ip_address);
      setDtmaHealth(healthStatus);

      if (healthStatus.healthy && toolbox.dtma_bearer_token) {
        // Get system status
        const systemStatus = await getDtmaSystemStatus(toolbox.public_ip_address, toolbox.dtma_bearer_token);
        if (systemStatus) {
          setDtmaSystemStatus(systemStatus);
        }

        // Get tools list
        const tools = await getDtmaTools(toolbox.public_ip_address, toolbox.dtma_bearer_token);
        setDtmaTools(tools);
      }

      setLastDtmaCheck(new Date());
    } catch (error: any) {
      setDtmaError(`Diagnostics failed: ${error.message}`);
    } finally {
      setLoadingDtma(false);
    }
  }, [toolbox, checkDtmaHealth, getDtmaSystemStatus, getDtmaTools]);

  const handleRefreshStatus = useCallback(async () => {
    if (!toolboxId) return;
    
    setRefreshingStatus(true);
    try {
      await refreshToolboxStatus(toolboxId);
      await fetchToolboxDetails(); // Refresh the toolbox data
      await fetchToolInstances(); // Refresh tool instances
    } catch (error: any) {
      console.error('Error refreshing status:', error);
    } finally {
      setRefreshingStatus(false);
    }
  }, [toolboxId, fetchToolboxDetails, fetchToolInstances]);

  useEffect(() => {
    fetchToolboxDetails();
    fetchToolInstances();
  }, [fetchToolboxDetails, fetchToolInstances]);

  // Format helper functions
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loadingToolbox) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
        <p className="ml-4 text-xl">Loading Toolbox Details...</p>
      </div>
    );
  }

  if (toolboxError) {
    return (
      <div className="container mx-auto p-4 text-center">
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-6 rounded-md max-w-md mx-auto">
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-10 w-10 mb-3 text-red-400" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Toolbox</h2>
            <p>{toolboxError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!toolbox) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>Toolbox not found or details are unavailable.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Server size={28} className="mr-3 text-indigo-500" /> 
              {toolbox.name || 'Unnamed Toolbox'}
            </h1>
            <p className="text-sm text-muted-foreground">ID: {toolbox.id}</p>
            {toolbox.do_droplet_name && toolbox.do_droplet_name !== toolbox.name && (
              <p className="text-sm text-muted-foreground">DigitalOcean Name: {toolbox.do_droplet_name}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleRefreshStatus}
              disabled={refreshingStatus}
              variant="outline"
            >
              {refreshingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Status
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tools">Deployed Tools</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Basic Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{toolbox.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Description:</span>
                  <span className="text-right">{toolbox.description || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge variant={toolbox.status === 'active' ? 'default' : 'secondary'}>
                    {toolbox.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Region:</span>
                  <span>{toolbox.region_slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Size:</span>
                  <span>{toolbox.size_slug}</span>
                </div>
              </CardContent>
            </Card>

            {/* Network Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Network className="mr-2 h-5 w-5" />
                  Network Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Public IP:</span>
                  <span className="font-mono">{toolbox.public_ip_address || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">DO Droplet ID:</span>
                  <span>{toolbox.do_droplet_id || 'N/A'}</span>
                </div>
                {toolbox.public_ip_address && (
                  <div className="pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => window.open(`http://${toolbox.public_ip_address}:30000`, '_blank')}
                      className="w-full"
                    >
                      <ExternalLinkIcon className="mr-2 h-4 w-4" />
                      Open DTMA Console
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timestamps Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Timestamps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Created:</span>
                  <p className="text-muted-foreground">{new Date(toolbox.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>
                  <p className="text-muted-foreground">{new Date(toolbox.updated_at).toLocaleString()}</p>
                </div>
                {toolbox.last_heartbeat_at && (
                  <div>
                    <span className="font-medium">Last Heartbeat:</span>
                    <p className="text-muted-foreground">{new Date(toolbox.last_heartbeat_at).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Error Message Display */}
          {toolbox.provisioning_error_message && (
            <Card className="border-red-700 bg-red-900/20">
              <CardHeader>
                <CardTitle className="text-lg text-red-400 flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Provisioning Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-300">{toolbox.provisioning_error_message}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Deployed Tools / Services</CardTitle>
                <Button size="sm" disabled>
                  <Package className="mr-2 h-4 w-4" /> Deploy New Tool
                </Button>
              </div>
              <CardDescription>
                Tools and services currently running on this toolbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTools && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="ml-3 text-muted-foreground">Loading tools...</p>
                </div>
              )}
              {!loadingTools && toolsError && (
                <div className="text-red-400 bg-red-900/20 p-3 rounded-md">
                  <p>Error loading tools: {toolsError}</p>
                </div>
              )}
              {!loadingTools && !toolsError && toolInstances.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No tools deployed to this Toolbox yet.</p>
              )}
              {!loadingTools && !toolsError && toolInstances.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {toolInstances.map((instance) => {
                      const status = getToolInstanceStatusAppearance(instance.status_on_toolbox);
                      return (
                        <TableRow key={instance.id}>
                          <TableCell className="font-medium">{instance.instance_name_on_toolbox || 'Unnamed Instance'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`border ${status.color}`}>
                                {status.icon}
                                <span className="ml-1.5">{status.text}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>{instance.version || 'N/A'}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" title="Start" disabled><PlayCircle className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" title="Stop" disabled><StopCircle className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" title="View Details/Logs" disabled><Eye className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" title="Delete" disabled><Trash2 className="h-4 w-4 text-destructive"/></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    DTMA Connectivity & System Diagnostics
                  </CardTitle>
                  <CardDescription>
                    Test connectivity and monitor system performance of your toolbox
                  </CardDescription>
                </div>
                <Button 
                  onClick={runDtmaDiagnostics}
                  disabled={loadingDtma || !toolbox.public_ip_address}
                >
                  {loadingDtma ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Terminal className="mr-2 h-4 w-4" />
                  )}
                  Run Diagnostics
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!toolbox.public_ip_address && (
                <div className="text-yellow-400 bg-yellow-900/20 p-3 rounded-md mb-4">
                  <p>No IP address available. Toolbox may still be provisioning.</p>
                </div>
              )}

              {lastDtmaCheck && (
                <p className="text-sm text-muted-foreground mb-4">
                  Last checked: {lastDtmaCheck.toLocaleString()}
                </p>
              )}

              {dtmaError && (
                <div className="text-red-400 bg-red-900/20 p-3 rounded-md mb-4">
                  <p>{dtmaError}</p>
                </div>
              )}

              {loadingDtma && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="ml-3 text-muted-foreground">Running diagnostics...</p>
                </div>
              )}

              {dtmaHealth && !loadingDtma && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* DTMA Health Status */}
                  <Card className={dtmaHealth.healthy ? 'border-green-700 bg-green-900/20' : 'border-red-700 bg-red-900/20'}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center">
                        {dtmaHealth.healthy ? (
                          <CheckCircle className="mr-2 h-5 w-5 text-green-400" />
                        ) : (
                          <XCircle className="mr-2 h-5 w-5 text-red-400" />
                        )}
                        DTMA Service
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant={dtmaHealth.healthy ? 'default' : 'destructive'}>
                            {dtmaHealth.healthy ? 'Healthy' : 'Unhealthy'}
                          </Badge>
                        </div>
                        {dtmaHealth.version && (
                          <div className="flex justify-between">
                            <span>Version:</span>
                            <span>{dtmaHealth.version}</span>
                          </div>
                        )}
                        {dtmaHealth.uptime && (
                          <div className="flex justify-between">
                            <span>Uptime:</span>
                            <span>{formatUptime(dtmaHealth.uptime)}</span>
                          </div>
                        )}
                        {dtmaHealth.error && (
                          <div className="mt-2 p-2 bg-red-800/30 rounded text-red-300 text-xs">
                            {dtmaHealth.error}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* System Resources */}
                  {dtmaSystemStatus && (
                    <>
                      {dtmaSystemStatus.cpu_load_percent !== undefined && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center">
                              <Cpu className="mr-2 h-5 w-5 text-blue-400" />
                              CPU Usage
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-2xl font-bold mb-2">
                              {dtmaSystemStatus.cpu_load_percent.toFixed(1)}%
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  dtmaSystemStatus.cpu_load_percent > 80 ? 'bg-red-500' :
                                  dtmaSystemStatus.cpu_load_percent > 60 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(dtmaSystemStatus.cpu_load_percent, 100)}%` }}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {dtmaSystemStatus.memory && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center">
                              <MemoryStick className="mr-2 h-5 w-5 text-purple-400" />
                              Memory Usage
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-sm space-y-2">
                              <div className="flex justify-between">
                                <span>Used:</span>
                                <span>{formatBytes(dtmaSystemStatus.memory.used_bytes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total:</span>
                                <span>{formatBytes(dtmaSystemStatus.memory.total_bytes)}</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="h-2 bg-purple-500 rounded-full transition-all"
                                  style={{ 
                                    width: `${(dtmaSystemStatus.memory.used_bytes / dtmaSystemStatus.memory.total_bytes) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {dtmaSystemStatus.disk && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center">
                              <HardDrive className="mr-2 h-5 w-5 text-orange-400" />
                              Disk Usage
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="text-sm space-y-2">
                              <div className="flex justify-between">
                                <span>Used:</span>
                                <span>{formatBytes(dtmaSystemStatus.disk.used_bytes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total:</span>
                                <span>{formatBytes(dtmaSystemStatus.disk.total_bytes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Mount:</span>
                                <span className="font-mono">{dtmaSystemStatus.disk.mount}</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="h-2 bg-orange-500 rounded-full transition-all"
                                  style={{ 
                                    width: `${(dtmaSystemStatus.disk.used_bytes / dtmaSystemStatus.disk.total_bytes) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* DTMA Tools List */}
              {dtmaTools.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">DTMA Managed Tools</CardTitle>
                    <CardDescription>
                      Tools currently managed by the DTMA service
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ports</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dtmaTools.map((tool) => (
                          <TableRow key={tool.id}>
                            <TableCell className="font-mono text-sm">{tool.id}</TableCell>
                            <TableCell className="font-medium">{tool.name}</TableCell>
                            <TableCell>
                              <Badge variant={tool.status === 'running' ? 'default' : 'secondary'}>
                                {tool.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {tool.ports && tool.ports.length > 0 ? (
                                <div className="space-y-1">
                                  {tool.ports.map((port, idx) => (
                                    <div key={idx} className="text-xs font-mono">
                                      {port.private_port} → {port.public_port} ({port.type})
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">None</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Toolbox Management Actions</CardTitle>
              <CardDescription>
                Administrative actions for managing this toolbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" disabled className="h-auto p-4 flex flex-col items-start">
                  <div className="flex items-center mb-2">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span className="font-medium">Sync Droplet Status</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Synchronize toolbox status with DigitalOcean droplet state
                  </p>
                </Button>
                
                <Button variant="outline" disabled className="h-auto p-4 flex flex-col items-start">
                  <div className="flex items-center mb-2">
                    <Terminal className="mr-2 h-4 w-4" />
                    <span className="font-medium">Access SSH Console</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Open SSH connection to the droplet for direct access
                  </p>
                </Button>
                
                <Button variant="outline" disabled className="h-auto p-4 flex flex-col items-start">
                  <div className="flex items-center mb-2">
                    <Settings className="mr-2 h-4 w-4" />
                    <span className="font-medium">Configure DTMA</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Update DTMA service configuration and settings
                  </p>
                </Button>
                
                <Button variant="destructive" disabled className="h-auto p-4 flex flex-col items-start">
                  <div className="flex items-center mb-2">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span className="font-medium">Deprovision Toolbox</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Permanently delete this toolbox and all associated resources
                  </p>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ToolboxDetailPage; 