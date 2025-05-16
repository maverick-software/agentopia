import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getToolboxById, AccountToolEnvironmentRecord } from '@/lib/api/toolboxes'; // Changed path to use alias
import { listToolInstancesForToolbox, AccountToolInstanceRecord } from '@/lib/api/toolboxTools'; // Import for tool instances
import { Loader2, Server, AlertTriangle, Package, PlayCircle, StopCircle, Trash2, ExternalLink as ExternalLinkIcon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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

  useEffect(() => {
    fetchToolboxDetails();
    fetchToolInstances();
  }, [fetchToolboxDetails, fetchToolInstances]);

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
        <h1 className="text-3xl font-bold flex items-center">
          <Server size={28} className="mr-3 text-indigo-500" /> 
          {toolbox.name || 'Unnamed Toolbox'}
        </h1>
        <p className="text-sm text-muted-foreground">ID: {toolbox.id}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-1 bg-card border border-border rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Details</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {toolbox.name || 'N/A'}</p>
            <p><strong>Description:</strong> {toolbox.description || 'N/A'}</p>
            <p><strong>Status:</strong> <span className={`font-medium ${toolbox.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>{toolbox.status}</span></p>
            <p><strong>Region:</strong> {toolbox.region_slug}</p>
            <p><strong>Size:</strong> {toolbox.size_slug}</p>
            <p><strong>Public IP:</strong> {toolbox.public_ip_address || 'N/A'}</p>
            <p><strong>Created:</strong> {new Date(toolbox.created_at).toLocaleString()}</p>
            <p><strong>Last Updated:</strong> {new Date(toolbox.updated_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-card border border-border rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Deployed Tools / Services</h2>
            <Button size="sm" disabled>
              <Package className="mr-2 h-4 w-4" /> Deploy New Tool
            </Button>
          </div>
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
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Toolbox Actions</h2>
        <div className="flex space-x-3">
            <Button variant="outline" disabled>Refresh Status</Button>
            <Button variant="destructive" disabled>Deprovision Toolbox</Button>
        </div>
      </div>

    </div>
  );
}

export default ToolboxDetailPage; 