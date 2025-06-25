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
import { DTMAConsole } from '@/components/DTMAConsole';

// DTMA interfaces moved to DTMAConsole component

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

  // DTMA Diagnostics State - now handled by DTMAConsole component

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

  // DTMA Connectivity Functions - moved to DTMAConsole component

  // DTMA diagnostics now handled by DTMAConsole component

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

  // formatUptime moved to DTMAConsole component

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
          {toolbox?.public_ip_address ? (
            <DTMAConsole 
              toolboxId={toolboxId!} 
              dropletIp={toolbox.public_ip_address} 
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Toolbox Not Ready</h3>
                  <p className="text-muted-foreground">
                    The toolbox is still being provisioned. DTMA console will be available once the droplet is ready.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
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