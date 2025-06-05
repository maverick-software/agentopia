import React, { useState, useEffect, useCallback } from 'react';
// import { supabase } from '../lib/supabase'; // Supabase client is now used via the API module
import { useAuth } from '../contexts/AuthContext';
import { Server, Power, Loader2, CheckCircle, XCircle, RefreshCw, ServerOff, PlusCircle, ExternalLink } from 'lucide-react';
import ToolboxModal, { ProvisionToolboxPayload } from '../components/ToolboxModal';
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningSuccess, setProvisioningSuccess] = useState<string | null>(null);
  const [activeProvisioningToolboxes, setActiveProvisioningToolboxes] = useState<Set<string>>(new Set());
  const [provisioningTimers, setProvisioningTimers] = useState<Record<string, { startTime: Date; remainingSeconds: number }>>({}); 
  
  // State for per-toolbox actions
  const [actionStates, setActionStates] = useState<Record<string, { isLoading: boolean; error: string | null }>>({});

  const pageTitle = "My Toolboxes";

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

  // Update countdown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setProvisioningTimers(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(toolboxName => {
          const timer = updated[toolboxName];
          const elapsedSeconds = Math.floor((new Date().getTime() - timer.startTime.getTime()) / 1000);
          const newRemainingSeconds = Math.max(0, 180 - elapsedSeconds);
          
          if (newRemainingSeconds !== timer.remainingSeconds) {
            updated[toolboxName] = { ...timer, remainingSeconds: newRemainingSeconds };
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper function to format seconds as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to get progress percentage
  const getProgressPercentage = (remainingSeconds: number): number => {
    return Math.max(0, Math.min(100, ((180 - remainingSeconds) / 180) * 100));
  };

  const handleProvisionToolbox = async (payload: ProvisionToolboxPayload) => {
    setProvisioningError(null);
    setProvisioningSuccess(null);
    
    try {
      // Start the provisioning process
      await provisionToolbox(payload);
      
      // After successful API call, let modal handle the success display and closing
      // Just refresh the list and start monitoring
      fetchUserToolboxes();
      startProvisioningStatusCheck(payload.name);
      
    } catch (err: any) {
      console.error('Error starting toolbox provisioning:', err);
      setProvisioningError(err.message || 'Failed to start toolbox provisioning.');
      // Don't close modal on error so user can see the error and retry
      throw err; // Re-throw to let the modal handle the error display
    }
  };

  // Function to periodically check provisioning status
  const startProvisioningStatusCheck = (toolboxName: string) => {
    // Add to active provisioning set
    setActiveProvisioningToolboxes(prev => new Set([...prev, toolboxName]));
    
    // Start countdown timer (3 minutes = 180 seconds)
    const startTime = new Date();
    setProvisioningTimers(prev => ({
      ...prev,
      [toolboxName]: { startTime, remainingSeconds: 180 }
    }));
    
    const checkInterval = setInterval(async () => {
      try {
        await fetchUserToolboxes();
        
        // Find the toolbox we're waiting for
        const currentToolboxes = await listToolboxes();
        const newToolbox = currentToolboxes?.find(t => t.name === toolboxName);
        
        if (newToolbox) {
          if (newToolbox.status === 'active') {
            // Provisioning completed successfully
            clearInterval(checkInterval);
            setActiveProvisioningToolboxes(prev => {
              const updated = new Set(prev);
              updated.delete(toolboxName);
              return updated;
            });
            setProvisioningTimers(prev => {
              const updated = { ...prev };
              delete updated[toolboxName];
              return updated;
            });
            setProvisioningSuccess(`Toolbox "${toolboxName}" has been provisioned successfully and is now active!`);
            setTimeout(() => setProvisioningSuccess(null), 8000);
          } else if (newToolbox.status.includes('error')) {
            // Provisioning failed
            clearInterval(checkInterval);
            setActiveProvisioningToolboxes(prev => {
              const updated = new Set(prev);
              updated.delete(toolboxName);
              return updated;
            });
            setProvisioningTimers(prev => {
              const updated = { ...prev };
              delete updated[toolboxName];
              return updated;
            });
            setProvisioningError(`Toolbox "${toolboxName}" provisioning failed: ${newToolbox.status}`);
          }
          // If still provisioning, continue checking
        }
      } catch (err) {
        console.error('Error checking provisioning status:', err);
      }
    }, 5000); // Check every 5 seconds

    // Stop checking after 10 minutes (in case something goes wrong)
    setTimeout(() => {
      clearInterval(checkInterval);
      setActiveProvisioningToolboxes(prev => {
        const updated = new Set(prev);
        updated.delete(toolboxName);
        return updated;
      });
      setProvisioningTimers(prev => {
        const updated = { ...prev };
        delete updated[toolboxName];
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
      // TODO: Ideally, refreshToolboxStatus would return the updated toolbox record,
      // and we would update only that item in the local state.
    } catch (err: any) {
      console.error(`Error refreshing status for ${toolboxId}:`, err);
      setActionStates(prev => ({ ...prev, [toolboxId]: { isLoading: false, error: err.message || 'Refresh failed' } }));
    } finally {
      // Ensure isLoading is set to false even if it was successful but we re-fetched
      // If not re-fetching, this would just be: setActionStates(prev => ({ ...prev, [toolboxId]: { ...prev[toolboxId], isLoading: false } }));
      setTimeout(() => setActionStates(prev => ({ ...prev, [toolboxId]: { ...prev[toolboxId], isLoading: false } })), 500); // give time for list refresh to reflect
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
              setProvisioningError(null); 
              setProvisioningSuccess(null); 
              setIsModalOpen(true); 
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> New Toolbox
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

      {/* Display active provisioning status */}
      {activeProvisioningToolboxes.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 text-blue-300 p-4 rounded-md mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              <h3 className="font-semibold">Provisioning in Progress</h3>
            </div>
            <div className="text-xs bg-blue-800/50 px-2 py-1 rounded font-mono">
              {(() => {
                const firstToolbox = Array.from(activeProvisioningToolboxes)[0];
                const timer = provisioningTimers[firstToolbox];
                if (timer && timer.remainingSeconds > 0) {
                  return `⏱️ ${formatTime(timer.remainingSeconds)}`;
                }
                return "⏱️ Finishing up...";
              })()}
            </div>
          </div>
          <p className="mt-1 text-sm">
            {activeProvisioningToolboxes.size === 1 
              ? `Creating and configuring server for: ${Array.from(activeProvisioningToolboxes)[0]}`
              : `Creating ${activeProvisioningToolboxes.size} toolboxes: ${Array.from(activeProvisioningToolboxes).join(', ')}`
            }
          </p>
          <div className="mt-3 bg-blue-800/30 rounded-full h-2 overflow-hidden">
            {(() => {
              const firstToolbox = Array.from(activeProvisioningToolboxes)[0];
              const timer = provisioningTimers[firstToolbox];
              const progressPercentage = timer ? getProgressPercentage(timer.remainingSeconds) : 60;
              return <div className="bg-blue-400 h-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>;
            })()}
          </div>
          <p className="mt-2 text-xs text-blue-200">
            Installing Docker, pulling DTMA container, and establishing connection...
          </p>
        </div>
      )}

      {/* Display provisioning success message */}
      {provisioningSuccess && (
        <div className="bg-green-900/30 border border-green-700 text-green-300 p-4 rounded-md mb-6">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h3 className="font-semibold">Success</h3>
          </div>
          <p className="mt-1 text-sm">{provisioningSuccess}</p>
        </div>
      )}

      {/* Display provisioning error if any, outside the modal as a general feedback for the page action */}
      {provisioningError && !isModalOpen && ( 
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-4 rounded-md mb-6">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Provisioning Error</h3>
          </div>
          <p className="mt-1 text-sm">{provisioningError}</p>
        </div>
      )}

      {!loading && !error && toolboxes.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg bg-card flex flex-col items-center">
            <ServerOff className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium text-gray-300">No Toolboxes Found</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-4">
                Create your first Toolbox to start managing your AI server environments.
            </p>
            <button 
                onClick={() => { 
                  setProvisioningError(null); 
                  setProvisioningSuccess(null); 
                  setIsModalOpen(true); 
                }}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors mt-2"
            >
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Toolbox
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
                    <h2 className="text-xl font-semibold text-primary truncate" title={toolbox.name || 'Unnamed Toolbox'}>
                      {toolbox.name || 'Unnamed Toolbox'}
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
                  {toolbox.status === 'provisioning' && (
                    <div className="text-xs text-blue-400 bg-blue-900/20 p-2 rounded mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span>🔄 Setting up your server...</span>
                        <span className="text-blue-300 font-mono">
                          {(() => {
                            const timer = toolbox.name ? provisioningTimers[toolbox.name] : null;
                            if (timer && timer.remainingSeconds > 0) {
                              return formatTime(timer.remainingSeconds);
                            }
                            return "Finishing...";
                          })()}
                        </span>
                      </div>
                      <div className="bg-blue-800/30 rounded-full h-1 overflow-hidden">
                        {(() => {
                          const timer = toolbox.name ? provisioningTimers[toolbox.name] : null;
                          const progressPercentage = timer ? getProgressPercentage(timer.remainingSeconds) : 45;
                          return <div className="bg-blue-400 h-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>;
                        })()}
                      </div>
                      <div className="mt-1 text-xs text-blue-300">
                        Installing Docker, configuring DTMA...
                      </div>
                    </div>
                  )}
                  {(toolbox.status.includes('pending') || toolbox.status.includes('awaiting')) && (
                    <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span>⏳ Finalizing setup...</span>
                        <span className="text-yellow-300">~1 min</span>
                      </div>
                      <div className="bg-yellow-800/30 rounded-full h-1 overflow-hidden">
                        <div className="bg-yellow-400 h-full animate-pulse" style={{ width: '80%' }}></div>
                      </div>
                      <div className="mt-1 text-xs text-yellow-300">
                        Establishing connection and verifying health...
                      </div>
                    </div>
                  )}
                  {toolbox.status.includes('error') && toolbox.provisioning_error_message && (
                      <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded my-2">Error: {toolbox.provisioning_error_message}</p>
                  )}
                  {currentToolboxError && (
                    <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded my-2">Action Error: {currentToolboxError}</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-end space-x-2">
                  <button 
                    onClick={() => handleRefreshStatusUI(toolbox.id)}
                    className="p-2 text-sm bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-md transition-colors disabled:opacity-50"
                    disabled={isCurrentToolboxLoading || toolbox.status.includes('pending') || toolbox.status.includes('creating') || toolbox.status.includes('deleting') || toolbox.status === 'deprovisioned'}
                    title="Refresh Status"
                  >
                    {isCurrentToolboxLoading && (actionStates[toolbox.id]?.isLoading && !actionStates[toolbox.id]?.error) ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                  </button>
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
            )}
          )}
        </div>
      )}

      <ToolboxModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          // Clear any provisioning error from parent when modal is closed
          setProvisioningError(null);
        }}
        onProvision={handleProvisionToolbox} 
      />


    </div>
  );
}

// Remove default export if you are using named export for the page component with lazy loading
// export default MCPPage; // Old export