import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Server, Power, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { activateAgentToolEnvironment, deactivateAgentToolEnvironment, fetchAgentDropletStatus } from '../lib/api/toolEnvironments';

// Status type for droplet statuses
type DropletStatus = 'none' | 'pending_creation' | 'creating' | 'active' | 'error_creation' | 'pending_deletion' | 'deleting' | 'deleted' | 'error_deletion' | 'unresponsive';

export function MCP() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [dropletStatus, setDropletStatus] = useState<DropletStatus>('none');
  const [dropletDetails, setDropletDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's agents on component mount
  useEffect(() => {
    if (user) {
      fetchUserAgents();
    }
  }, [user]);

  // When selected agent changes, fetch its droplet status
  useEffect(() => {
    if (selectedAgent) {
      fetchDropletStatus(selectedAgent);
    } else {
      setDropletStatus('none');
      setDropletDetails(null);
    }
  }, [selectedAgent]);

  const fetchUserAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      setAgents(data || []);
      
      // Select the first agent by default if available
      if (data && data.length > 0) {
        setSelectedAgent(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching agents:', err);
      setError(`Failed to load agents: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropletStatus = async (agentId: string) => {
    try {
      setRefreshing(true);
      const data = await fetchAgentDropletStatus(agentId);
      
      if (data) {
        setDropletStatus(data.status as DropletStatus);
        setDropletDetails(data);
      } else {
        setDropletStatus('none');
        setDropletDetails(null);
      }
    } catch (err: any) {
      console.error('Error fetching droplet status:', err);
      setError(`Failed to load droplet status: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleDropletActivation = async () => {
    if (!selectedAgent) return;
    
    try {
      setActivating(true);
      setError(null);
      
      // Determine what action to take based on current status
      if (dropletStatus === 'none' || dropletStatus === 'deleted' || dropletStatus === 'error_deletion') {
        // Activate droplet
        await activateAgentToolEnvironment(selectedAgent);
        
        // Update local state
        setDropletStatus('pending_creation');
      } else if (['active', 'pending_creation', 'creating', 'error_creation'].includes(dropletStatus)) {
        // Deactivate droplet
        await deactivateAgentToolEnvironment(selectedAgent);
        
        // Update local state
        setDropletStatus('pending_deletion');
      }
      
      // Refresh status after a short delay
      setTimeout(() => fetchDropletStatus(selectedAgent), 2000);
      
    } catch (err: any) {
      console.error('Error managing droplet:', err);
      setError(`Failed to manage droplet: ${err.message}`);
    } finally {
      setActivating(false);
    }
  };

  // Helper function to get user-friendly status text
  const getStatusText = (status: DropletStatus): string => {
    switch (status) {
      case 'none': return 'Not Activated';
      case 'pending_creation': return 'Waiting for Creation';
      case 'creating': return 'Creating...';
      case 'active': return 'Active';
      case 'error_creation': return 'Creation Failed';
      case 'pending_deletion': return 'Waiting for Deletion';
      case 'deleting': return 'Deleting...';
      case 'deleted': return 'Deleted';
      case 'error_deletion': return 'Deletion Failed';
      case 'unresponsive': return 'Unresponsive';
      default: return 'Unknown Status';
    }
  };

  // Helper to determine if toggles should be disabled
  const isToggleDisabled = (): boolean => {
    return activating || 
           refreshing || 
           loading || 
           !selectedAgent || 
           ['creating', 'deleting', 'pending_creation', 'pending_deletion'].includes(dropletStatus);
  };

  // Helper to determine if the environment is active or in process of becoming active
  const isEnvironmentActive = (): boolean => {
    return ['active', 'creating', 'pending_creation'].includes(dropletStatus);
  };

  // Helper to determine if there's an error state
  const hasError = (): boolean => {
    return ['error_creation', 'error_deletion', 'unresponsive'].includes(dropletStatus);
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Model Context Processor (MCP)</h1>
        <button 
          onClick={() => selectedAgent && fetchDropletStatus(selectedAgent)}
          disabled={refreshing || !selectedAgent}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" /> 
            MCP Server Environment
          </h2>
          
          <p className="text-gray-400">
            Activate a dedicated server environment for your agent to run MCP tooling. 
            This provides a secure, isolated infrastructure for executing agent tools.
          </p>
          
          {error && (
            <div className="bg-red-900/30 border border-red-700 p-4 rounded-md text-red-300">
              <p className="flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                {error}
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400">Select Agent</label>
              <select
                value={selectedAgent || ''}
                onChange={(e) => setSelectedAgent(e.target.value || null)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || agents.length === 0}
              >
                {loading ? (
                  <option value="">Loading agents...</option>
                ) : agents.length === 0 ? (
                  <option value="">No agents available</option>
                ) : (
                  <>
                    <option value="">Select an agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            
            {selectedAgent && (
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Server Environment</h3>
                    <p className="text-sm text-gray-400">
                      {dropletStatus === 'none' 
                        ? 'Not activated yet. Toggle to provision a dedicated server.' 
                        : `Status: ${getStatusText(dropletStatus)}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${
                      dropletStatus === 'active' ? 'bg-green-500' :
                      ['creating', 'pending_creation', 'deleting', 'pending_deletion'].includes(dropletStatus) ? 'bg-yellow-500' :
                      hasError() ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isEnvironmentActive()}
                        onChange={toggleDropletActivation}
                        disabled={isToggleDisabled()}
                      />
                      <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer
                        peer-checked:after:translate-x-full 
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                        after:bg-white after:border-gray-300 after:border after:rounded-full 
                        after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600
                        ${isToggleDisabled() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      </div>
                    </label>
                  </div>
                </div>
                
                {activating && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      {dropletStatus === 'none' || dropletStatus === 'deleted' 
                        ? 'Activating environment...' 
                        : 'Deactivating environment...'}
                    </span>
                  </div>
                )}
                
                {dropletDetails && dropletStatus === 'active' && (
                  <div className="space-y-2 border-t border-gray-600 pt-4 mt-4">
                    <h4 className="text-sm font-medium">Environment Details</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-gray-400">IP Address</span>
                      <span>{dropletDetails.ip_address || 'Not assigned'}</span>
                      
                      <span className="text-gray-400">Region</span>
                      <span>{dropletDetails.region_slug}</span>
                      
                      <span className="text-gray-400">Size</span>
                      <span>{dropletDetails.size_slug}</span>
                      
                      <span className="text-gray-400">Last Heartbeat</span>
                      <span>
                        {dropletDetails.last_heartbeat_at 
                          ? new Date(dropletDetails.last_heartbeat_at).toLocaleString() 
                          : 'No heartbeat received yet'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Additional Tool Configuration Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">MCP Tools</h2>
        <p className="text-gray-400">Configure and manage available MCP tools for your agent. This feature will be available soon.</p>
        
        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="font-medium">Browser Tool</h3>
              <p className="text-sm text-gray-400">Allows your agent to browse the web</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}