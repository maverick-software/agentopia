import React, { useState, useEffect, useCallback } from 'react';
// import { supabase } from '../lib/supabase'; // Supabase client is now used via the API module
import { useAuth } from '../contexts/AuthContext';
import { Server, Power, Loader2, CheckCircle, XCircle, RefreshCw, ServerOff, PlusCircle, ExternalLink } from 'lucide-react';
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

  // Friendly animal names for toolboxes
  const animalNames = [
    'dolphin', 'eagle', 'tiger', 'wolf', 'lion', 'bear', 'fox', 'hawk', 'shark', 'whale',
    'falcon', 'panther', 'lynx', 'jaguar', 'cheetah', 'leopard', 'cobra', 'viper', 'python',
    'raven', 'owl', 'phoenix', 'dragon', 'griffin', 'pegasus', 'unicorn', 'kraken', 'hydra'
  ];

  // Generate automatic toolbox configuration with friendly names
  const generateToolboxConfig = (): ProvisionToolboxPayload => {
    const now = new Date();
    
    // Generate friendly name: animal + random number
    const randomAnimal = animalNames[Math.floor(Math.random() * animalNames.length)];
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    const name = `${randomAnimal}-${randomNumber}`;
    
    const description = `${randomAnimal.charAt(0).toUpperCase() + randomAnimal.slice(1)} toolbox created on ${now.toLocaleDateString()}`;
    
    return {
      name,
      description,
      regionSlug: 'nyc1', // Primary region (nyc2 as fallback handled in backend)
      sizeSlug: 's-1vcpu-512mb-10gb' // $4.00/month plan
    };
  };

  const handleProvisionToolbox = async (payload: ProvisionToolboxPayload) => {
    setProvisioningError(null);
    
    try {
      // Start the provisioning process
      await provisionToolbox(payload);
      
      // Refresh the list and start monitoring
      fetchUserToolboxes();
      startProvisioningStatusCheck(payload.name);
      
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

  // Function to periodically check provisioning status
  const startProvisioningStatusCheck = (toolboxName: string) => {
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
            setProvisioningTimers(prev => {
              const updated = { ...prev };
              delete updated[toolboxName];
              return updated;
            });
            // No need for page-wide success message - the card status will show it's active
          } else if (newToolbox.status.includes('error')) {
            // Provisioning failed
            clearInterval(checkInterval);
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
    }, 10000); // Check every 10 seconds

    // Stop checking after 10 minutes (in case something goes wrong)
    setTimeout(() => {
      clearInterval(checkInterval);
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
              if (window.confirm('Create a new toolbox? This will set up a new server environment with a randomly generated name.')) {
                handleCreateToolbox();
              }
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            disabled={isCreatingToolbox}
        >
          {isCreatingToolbox && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <PlusCircle className="mr-2 h-4 w-4" /> {isCreatingToolbox ? 'Creating...' : 'New Toolbox'}
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
            <h3 className="mt-2 text-lg font-medium text-gray-300">No Toolboxes Found</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-4">
                Create your first Toolbox to start managing your AI server environments.
            </p>
            <button 
                onClick={() => {
                  if (window.confirm('Create a new toolbox? This will set up a new server environment with a randomly generated name.')) {
                    handleCreateToolbox();
                  }
                }}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors mt-2"
                disabled={isCreatingToolbox}
            >
                {isCreatingToolbox && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" /> {isCreatingToolbox ? 'Creating...' : 'Create New Toolbox'}
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
                    <div className="text-xs text-blue-400 bg-blue-900/20 p-3 rounded-lg mb-2 border border-blue-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          🚀 Building your server...
                        </span>
                        <span className="text-blue-300 font-mono bg-blue-800/50 px-2 py-0.5 rounded">
                          {(() => {
                            const timer = toolbox.name ? provisioningTimers[toolbox.name] : null;
                            if (timer && timer.remainingSeconds > 0) {
                              return `⏱️ ${formatTime(timer.remainingSeconds)}`;
                            }
                            return "⏱️ Almost ready...";
                          })()}
                        </span>
                      </div>
                      <div className="bg-blue-800/30 rounded-full h-2 overflow-hidden mb-2">
                        {(() => {
                          const timer = toolbox.name ? provisioningTimers[toolbox.name] : null;
                          const progressPercentage = timer ? getProgressPercentage(timer.remainingSeconds) : 45;
                          return <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>;
                        })()}
                      </div>
                      <div className="text-xs text-blue-300/80">
                        {(() => {
                          const timer = toolbox.name ? provisioningTimers[toolbox.name] : null;
                          if (timer && timer.remainingSeconds > 120) {
                            return "🐳 Installing Docker and security updates...";
                          } else if (timer && timer.remainingSeconds > 60) {
                            return "⚙️ Configuring DTMA container...";
                          } else {
                            return "🔗 Establishing secure connection...";
                          }
                        })()}
                      </div>
                    </div>
                  )}
                  {(toolbox.status.includes('pending') || toolbox.status.includes('awaiting')) && (
                    <div className="text-xs text-yellow-400 bg-yellow-900/20 p-3 rounded-lg mb-2 border border-yellow-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ⏳ Finalizing setup...
                        </span>
                        <span className="text-yellow-300 font-mono bg-yellow-800/50 px-2 py-0.5 rounded">
                          ~1 min
                        </span>
                      </div>
                      <div className="bg-yellow-800/30 rounded-full h-2 overflow-hidden mb-2">
                        <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-full animate-pulse" style={{ width: '85%' }}></div>
                      </div>
                      <div className="text-xs text-yellow-300/80">
                        🔗 Establishing connection and verifying health...
                      </div>
                    </div>
                  )}
                  {toolbox.status.includes('error') && toolbox.provisioning_error_message && (
                      <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded my-2">Error: {toolbox.provisioning_error_message}</p>
                  )}
                  {/* Only show action errors if not actively provisioning or if provisioning timer has expired */}
                  {currentToolboxError && !toolbox.status.includes('provisioning') && !toolbox.status.includes('pending') && !toolbox.status.includes('awaiting') && (
                    <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded my-2">Action Error: {currentToolboxError}</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-end space-x-2">
                  {/* Only show refresh button when toolbox is active or has an error (not during provisioning) */}
                  {(toolbox.status === 'active' || toolbox.status.includes('error')) && (
                    <button 
                      onClick={() => handleRefreshStatusUI(toolbox.id)}
                      className="p-2 text-sm bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-md transition-colors disabled:opacity-50"
                      disabled={isCurrentToolboxLoading}
                      title="Refresh Status"
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
            )}
          )}
        </div>
      )}




    </div>
  );
}

// Remove default export if you are using named export for the page component with lazy loading
// export default MCPPage; // Old export