import React, { useState, useEffect, useCallback } from 'react';
// import { supabase } from '../lib/supabase'; // Supabase client is now used via the API module
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Server, Power, Loader2, CheckCircle, XCircle, RefreshCw, ServerOff, PlusCircle, ExternalLink, Eye } from 'lucide-react';
import { ProvisionToolboxPayload } from '../components/ToolboxModal';
import {
  listToolboxes,
  provisionToolbox,
  deprovisionToolbox,
  refreshToolboxStatus,
  AccountToolEnvironmentRecord,
  AccountToolEnvironmentStatus // Assuming these types are exported from toolboxes.ts
} from '../lib/api/toolboxes';

// Local type definitions can be removed if they are correctly imported from toolboxes.ts
// interface AccountToolEnvironmentRecord { ... }
// type AccountToolEnvironmentStatus = ...;

// This component will be the main page for Toolbox management.
// It will eventually list user's Toolboxes and allow creation of new ones.
// It will also likely be the entry point to configure a selected Toolbox (Deployed Services, Agent Toolbelts).

// Changed from interface MCPPageProps
// interface ToolboxesPageProps {}

// Changed from const MCPPage: React.FC<MCPPageProps> = () => {
// Changed exported function name from MCP to ToolboxesPage
export function ToolboxesPage() { 
  const { user } = useAuth();
  const [toolboxes, setToolboxes] = useState<AccountToolEnvironmentRecord[]>([]);
  const [loading, setLoading] = useState(true); // For fetching the list
  const [error, setError] = useState<string | null>(null); // For fetching the list

  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [isCreatingToolbox, setIsCreatingToolbox] = useState(false);
  
  // Simple state management: only track start times for timeout logic
  const [provisioningStartTimes, setProvisioningStartTimes] = useState<Record<string, Date>>({});
  
  // State for per-toolbox actions
  const [actionStates, setActionStates] = useState<Record<string, { isLoading: boolean; error: string | null }>>({});

  const pageTitle = "Droplet Management";

  const fetchUserToolboxes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const fetchedToolboxes = await listToolboxes();
      setToolboxes(fetchedToolboxes || []);
    } catch (err: any) {
      console.error('Error fetching toolboxes:', err);
      setError(`Failed to load toolboxes: ${err.message}`);
      setToolboxes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserToolboxes();
  }, [fetchUserToolboxes]);

  // Clean up start times when toolboxes complete or error
  useEffect(() => {
    if (!toolboxes) return;
    
    toolboxes.forEach(toolbox => {
      if (toolbox.name && provisioningStartTimes[toolbox.name]) {
        // If toolbox is no longer provisioning, clean up start time
        if (toolbox.status === 'active' || toolbox.status.includes('error')) {
          setProvisioningStartTimes(prev => {
            const updated = { ...prev };
            delete updated[toolbox.name!];
            return updated;
          });
        }
      }
    });
  }, [toolboxes, provisioningStartTimes]);

  // Status-based display function - replaces timer-based approach
  const getProvisioningDisplay = (status: AccountToolEnvironmentStatus, startTime?: Date) => {
    switch (status) {
      case 'pending_creation':
      case 'creating':
        return { 
          phase: 'Creating server infrastructure...', 
          progress: 25,
          message: 'Setting up your toolbox environment'
        };
      case 'pending_provision':
      case 'provisioning':
        return { 
          phase: 'Installing and configuring...', 
          progress: 75,
          message: 'Installing Docker and DTMA container'
        };
      case 'unresponsive': // This often indicates waiting for heartbeat
        return { 
          phase: 'Almost ready...', 
          progress: 95,
          message: 'Finalizing setup and health checks'
        };
      default:
        return { 
          phase: 'Processing...', 
          progress: 10,
          message: 'Initializing toolbox creation'
        };
    }
  };

  // Helper to check if toolbox has been provisioning too long (10 minutes)
  const isProvisioningTimedOut = (toolboxId: string): boolean => {
    const startTime = provisioningStartTimes[toolboxId];
    if (!startTime) return false; // Don't show timeout for existing toolboxes on page load
    const elapsed = new Date().getTime() - startTime.getTime();
    return elapsed > 600000; // 10 minutes
  };





  // Generate automatic toolbox configuration with proper name from start
  const generateToolboxConfig = (): ProvisionToolboxPayload => {
    const now = new Date();
    
    // Generate proper structured name exactly like the backend does
    const toolboxId = crypto.randomUUID();
    const properName = `toolbox-${user!.id.substring(0, 8)}-${toolboxId.substring(0, 8)}`;
    
    return {
      name: properName, // Use the proper structured name from the start
      description: `Toolbox created on ${now.toLocaleDateString()}`,
      regionSlug: 'nyc1', // Primary region (nyc2 as fallback handled in backend)
      sizeSlug: 's-1vcpu-512mb-10gb' // $4.00/month plan
    };
  };

  const handleProvisionToolbox = async (payload: ProvisionToolboxPayload) => {
    setProvisioningError(null);
    
    try {
      // Start the provisioning process - name is already correct from generateToolboxConfig
      const newToolbox = await provisionToolbox(payload);
      
      // Add the toolbox to state immediately with proper name
      setToolboxes(prev => [...prev, newToolbox]);
      
      // Start status checking using toolbox ID
      startProvisioningStatusCheck(newToolbox.id);
      
    } catch (err: any) {
      console.error('Error starting toolbox provisioning:', err);
      setProvisioningError(err.message || 'Failed to start toolbox provisioning.');
    }
  };

  // Direct toolbox creation function
  const handleCreateToolbox = async () => {
    setIsCreatingToolbox(true);
    setProvisioningError(null);
    
    try {
      const config = generateToolboxConfig();
      await handleProvisionToolbox(config);
      // Success will be shown in the individual toolbox card
    } catch (err: any) {
      console.error('Error creating toolbox:', err);
      setProvisioningError(err.message || 'Failed to create toolbox.');
    } finally {
      setIsCreatingToolbox(false);
    }
  };

  // Function to periodically check provisioning status (simplified)
  const startProvisioningStatusCheck = (toolboxId: string) => {
    // Record start time for timeout tracking only
    setProvisioningStartTimes(prev => ({
      ...prev,
      [toolboxId]: new Date()
    }));
    
    const checkInterval = setInterval(async () => {
      try {
        // Check status without triggering a full page refresh
        const currentToolboxes = await listToolboxes();
        const newToolbox = currentToolboxes?.find(t => t.id === toolboxId);
        
        if (newToolbox) {
          if (newToolbox.status === 'active') {
            // Provisioning completed successfully
            clearInterval(checkInterval);
            setProvisioningStartTimes(prev => {
              const updated = { ...prev };
              delete updated[toolboxId];
              return updated;
            });
            // Update the toolboxes state with the new status
            setToolboxes(currentToolboxes || []);
          } else if (newToolbox.status.includes('error')) {
            // Provisioning failed
            clearInterval(checkInterval);
            setProvisioningStartTimes(prev => {
              const updated = { ...prev };
              delete updated[toolboxId];
              return updated;
            });
            // Update the toolboxes state with the new status
            setToolboxes(currentToolboxes || []);
            setProvisioningError(`Toolbox "${newToolbox.name || newToolbox.id}" provisioning failed: ${newToolbox.status}`);
          }
          // Continue checking if still in progress
        }
      } catch (err) {
        console.error('Error checking provisioning status:', err);
      }
    }, 15000); // Check every 15 seconds

    // Stop checking after 10 minutes (in case something goes wrong)
    setTimeout(() => {
      clearInterval(checkInterval);
      setProvisioningStartTimes(prev => {
        const updated = { ...prev };
        delete updated[toolboxId];
        return updated;
      });
    }, 600000);
  };

  const getStatusText = (status: AccountToolEnvironmentStatus): string => {
    // ... (getStatusText implementation remains the same for now, ensure all statuses are covered)
    // ... It was already updated in the previous step.
    switch (status) {
      case 'inactive': return 'Inactive';
      case 'pending_creation': return 'Pending Creation';
      case 'creating': return 'Creating';
      case 'active': return 'Active';
      case 'error_creation': return 'Creation Failed';
      case 'pending_deletion': return 'Pending Deletion';
      case 'deleting': return 'Deleting';
      case 'deprovisioned': return 'Deprovisioned';
      case 'error_deletion': return 'Deletion Failed';
      case 'error_deprovisioning': return 'Deprovisioning Failed';
      case 'unresponsive': return 'Unresponsive';
      case 'scaling': return 'Scaling';
      case 'pending_provision': return 'Preparing to Provision';
      case 'provisioning': return 'Provisioning Server...';
      case 'error_provisioning': return 'Provisioning Failed';
      case 'pending_deprovision': return 'Pending Deprovision';
      case 'deprovisioning': return 'Deprovisioning';
      default:
        const statusStr = status as string;
        return statusStr ? statusStr.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase()) : 'Unknown Status';
    }
  };
  
  const handleRefreshStatusUI = async (toolboxId: string) => {
    setActionStates(prev => ({ ...prev, [toolboxId]: { isLoading: true, error: null } }));
    try {
      await refreshToolboxStatus(toolboxId);
      fetchUserToolboxes(); // Re-fetch the whole list to get updated status
    } catch (err: any) {
      console.error(`Error refreshing status for ${toolboxId}:`, err);
      // Only set error if the toolbox is expected to be responsive (active or error state)
      const toolbox = toolboxes.find(t => t.id === toolboxId);
      if (toolbox && (toolbox.status === 'active' || toolbox.status.includes('error'))) {
        setActionStates(prev => ({ ...prev, [toolboxId]: { isLoading: false, error: err.message || 'Refresh failed' } }));
      } else {
        // Clear error for provisioning states - it's expected that services might not respond yet
        setActionStates(prev => ({ ...prev, [toolboxId]: { isLoading: false, error: null } }));
      }
    } finally {
      // Ensure isLoading is set to false even if it was successful but we re-fetched
      setTimeout(() => setActionStates(prev => ({ ...prev, [toolboxId]: { ...prev[toolboxId], isLoading: false } })), 500);
    }
  };

  const handleDeprovisionUI = async (toolboxId: string) => {
    if (!window.confirm('Are you sure you want to deprovision this toolbox? This action cannot be undone.')) {
      return;
    }
    setActionStates(prev => ({ ...prev, [toolboxId]: { isLoading: true, error: null } }));
    try {
      await deprovisionToolbox(toolboxId);
      fetchUserToolboxes(); // Refresh list after deprovisioning
      // TODO: Add success toast
    } catch (err: any) {
      console.error(`Error deprovisioning toolbox ${toolboxId}:`, err);
      setActionStates(prev => ({ ...prev, [toolboxId]: { isLoading: false, error: err.message || 'Deprovision failed' } }));
      // TODO: Add error toast
    } finally {
       // No need to set isLoading to false here if the item is removed from the list by fetchUserToolboxes
       // However, if fetchUserToolboxes fails or the item remains, it should be reset.
       // For safety, let's ensure it's reset if the component might not unmount immediately.
       setTimeout(() => setActionStates(prev => ({ ...prev, [toolboxId]: { ...prev[toolboxId], isLoading: false } })), 500);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Server size={28} className="mr-3" />
          {pageTitle}
        </h1>
        <button 
            onClick={() => {
              if (window.confirm('Create a new droplet? This will set up a new server environment.')) {
                handleCreateToolbox();
              }
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            disabled={isCreatingToolbox}
        >
          {isCreatingToolbox && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <PlusCircle className="mr-2 h-4 w-4" /> {isCreatingToolbox ? 'Creating...' : 'New Droplet'}
        </button>
      </div>

      {/* Agent Selector */}
      {/* <div className="mb-6">
        <AgentSelector 
          onSelectAgent={(agentId) => setSelectedAgent(agentId ? agentId : null)} 
          initialSelectedAgentId={selectedAgent}
          label="Select Agent to View Toolboxes:"
        />
      </div> */}
      
      {/* {user && selectedAgent && (
        <p className="mb-4 text-sm text-muted-foreground">
          Displaying toolboxes for agent: <strong>{selectedAgent}</strong> (Actual toolbox list coming soon)
        </p>
      )}
      {!selectedAgent && user && (
         <p className="mb-4 text-sm text-muted-foreground">
          Please select an agent to view their toolboxes.
        </p>
      )} */}

      {loading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="ml-3 text-lg">Loading your toolboxes...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-4 rounded-md mb-6">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Error</h3>
          </div>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}





      {!loading && !error && toolboxes.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg bg-card flex flex-col items-center">
            <ServerOff className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium text-gray-300">No Droplets Found</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-4">
                Create your first droplet to start managing your AI server environments.
            </p>
            <button 
                onClick={() => {
                  if (window.confirm('Create a new droplet? This will set up a new server environment.')) {
                    handleCreateToolbox();
                  }
                }}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors mt-2"
                disabled={isCreatingToolbox}
            >
                {isCreatingToolbox && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" /> {isCreatingToolbox ? 'Creating...' : 'Create New Droplet'}
            </button>
        </div>
      )}

      {!loading && !error && toolboxes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {toolboxes.map((toolbox) => {
            const currentActionState = actionStates[toolbox.id] || { isLoading: false, error: null };
            const isCurrentToolboxLoading = currentActionState.isLoading;
            const currentToolboxError = currentActionState.error;
            
            return (
              <div key={toolbox.id} className="bg-card border border-border rounded-lg shadow-lg p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold text-primary truncate" title={toolbox.name || 'Toolbox'}>
                      {toolbox.name || 'Toolbox'}
                    </h2>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center ${
                      toolbox.status === 'active' ? 'bg-green-700/30 text-green-300' :
                      toolbox.status.includes('error') ? 'bg-red-700/30 text-red-300' :
                      (toolbox.status.includes('pending') || toolbox.status.includes('creating') || toolbox.status.includes('deleting') || toolbox.status.includes('provisioning')) ? 'bg-yellow-700/30 text-yellow-300' :
                      'bg-gray-700/50 text-gray-400'
                    }`}>
                      {(toolbox.status.includes('provisioning') || toolbox.status.includes('pending') || toolbox.status.includes('creating')) && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {getStatusText(toolbox.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Region: {toolbox.region_slug}</p>
                  <p className="text-sm text-muted-foreground mb-1">Size: {toolbox.size_slug}</p>
                  {toolbox.public_ip_address && (
                    <p className="text-sm text-muted-foreground mb-1">
                      IP: {toolbox.public_ip_address}
                      {toolbox.status === 'active' && (
                          <a href={`http://${toolbox.public_ip_address}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center text-indigo-400 hover:text-indigo-300">
                              <ExternalLink size={14} />
                          </a>
                      )}
                    </p>
                  )}
                  {toolbox.status === 'active' && (
                    <p className="text-xs text-green-400 bg-green-900/20 p-2 rounded mb-2">
                      ✅ Server is healthy and ready for tool deployment
                    </p>
                  )}
                  {(toolbox.status === 'provisioning' || toolbox.status === 'pending_provision' || 
                    toolbox.status === 'creating' || toolbox.status === 'pending_creation') && (
                    <div className="text-xs text-blue-400 bg-blue-900/20 p-3 rounded-lg mb-2 border border-blue-800/30">
                      {(() => {
                        const display = getProvisioningDisplay(toolbox.status);
                        return (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="flex items-center">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Deploying...
                              </span>
                              <span className="text-blue-300 text-xs bg-blue-800/50 px-2 py-0.5 rounded">
                                Usually takes 3-5 minutes
                              </span>
                            </div>
                            <div className="bg-blue-800/30 rounded-full h-1.5 overflow-hidden mb-2">
                              <div className="bg-blue-400 h-full transition-all duration-1000" style={{ width: `${display.progress}%` }}></div>
                            </div>
                            <div className="text-xs text-blue-300/60">
                              {display.phase}
                            </div>
                            {isProvisioningTimedOut(toolbox.id) && (
                              <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs text-yellow-300">
                                <span className="text-yellow-300">⏱️</span> This is taking longer than usual. You can refresh the status to check progress.
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {toolbox.status === 'unresponsive' && (
                    <div className="text-xs text-blue-400 bg-blue-900/20 p-3 rounded-lg mb-2 border border-blue-800/30">
                      {(() => {
                        const display = getProvisioningDisplay(toolbox.status);
                        return (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="flex items-center">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Deploying...
                              </span>
                              <span className="text-blue-300 text-xs bg-blue-800/50 px-2 py-0.5 rounded">
                                Almost ready...
                              </span>
                            </div>
                            <div className="bg-blue-800/30 rounded-full h-1.5 overflow-hidden mb-2">
                              <div className="bg-blue-400 h-full animate-pulse" style={{ width: `${display.progress}%` }}></div>
                            </div>
                            <div className="text-xs text-blue-300/60">
                              {display.phase}
                            </div>
                            {isProvisioningTimedOut(toolbox.id) && (
                              <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs text-yellow-300">
                                <span className="text-yellow-300">⏱️</span> This is taking longer than usual. You can refresh the status to check progress.
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {toolbox.status.includes('error') && toolbox.provisioning_error_message && (
                      <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded my-2">Error: {toolbox.provisioning_error_message}</p>
                  )}
                  {/* Show action errors */}
                  {currentToolboxError && (
                    <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded my-2">Action Error: {currentToolboxError}</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                  {/* Left side - View Details button */}
                  <Link
                    to={`/admin/toolboxes/${toolbox.id}`}
                    className="flex items-center px-3 py-2 text-sm bg-indigo-600/80 hover:bg-indigo-500/80 text-white rounded-md transition-colors"
                    title="View detailed diagnostics and management options"
                  >
                    <Eye size={16} className="mr-1.5" />
                    View Details
                  </Link>
                  
                  {/* Right side - Action buttons */}
                  <div className="flex items-center space-x-2">
                    {/* Show refresh button for all toolboxes except those being deleted */}
                    {!toolbox.status.includes('deleting') && toolbox.status !== 'deprovisioned' && (
                      <button 
                        onClick={() => handleRefreshStatusUI(toolbox.id)}
                        className="p-2 text-sm bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-md transition-colors disabled:opacity-50"
                        disabled={isCurrentToolboxLoading}
                        title={
                          toolbox.status.includes('provisioning') || toolbox.status.includes('pending') || toolbox.status.includes('creating')
                            ? "Check if toolbox setup is complete"
                            : "Refresh Status"
                        }
                      >
                        {isCurrentToolboxLoading && (actionStates[toolbox.id]?.isLoading && !actionStates[toolbox.id]?.error) ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeprovisionUI(toolbox.id)}
                      className={`p-2 text-sm rounded-md transition-colors disabled:opacity-50 flex items-center bg-red-700/80 hover:bg-red-600/80 text-white'`}
                      disabled={isCurrentToolboxLoading || toolbox.status.includes('pending') || toolbox.status.includes('deleting') || toolbox.status === 'deprovisioned'}
                      title='Deprovision Toolbox'
                    >
                      {isCurrentToolboxLoading && (actionStates[toolbox.id]?.isLoading && !actionStates[toolbox.id]?.error) ? <Loader2 size={16} className="animate-spin mr-1.5"/> : <Power size={16} className="mr-1.5" />}
                      Deprovision
                    </button>
                  </div>
                </div>
              </div>
            )}
          )}
        </div>
      )}




    </div>
  );
}

// Remove default export if you are using named export for the page component with lazy loading
// export default MCPPage; // Old export