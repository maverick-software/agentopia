import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MCPServerConfig, MCPServerCapabilities } from '../lib/mcp/types';
import { useAuth } from '../contexts/AuthContext'; // Needed for user ID

// Types moved from AgentEdit
interface TestConnectionResult {
    success: boolean;
    message: string;
    capabilities?: MCPServerCapabilities | null;
}

// Constants moved from AgentEdit
const DEFAULT_NEW_SERVER_CONFIG: Partial<MCPServerConfig> = {
  name: '',
  endpoint_url: '',
  vault_api_key_id: null,
  timeout_ms: 5000,
  max_retries: 3,
  retry_backoff_ms: 1000,
  priority: 0,
  is_active: true,
};

export const useAgentMcp = (agentId: string | undefined) => {
  const { user } = useAuth(); // Get user for filtering/permissions

  // MCP State
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [mcpConfigId, setMcpConfigId] = useState<number | null>(null); // Store the ID of the parent mcp_configurations record
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal/Form related state might be better handled in the component using the modal, 
  // but we can provide helpers or manage it here if simple enough.
  // For now, let's keep modal visibility state in the component.
  // We will need functions to interact with servers (add, update, delete, test).

  // --- Data Fetching ---

  const fetchMcpConfigurations = useCallback(async () => {
    if (!agentId || !user?.id) {
      setMcpServers([]); // Clear servers if no agentId or user
      setMcpConfigId(null);
      return;
    }
    console.log(`[useAgentMcp:${agentId}] Fetching MCP configurations...`);
    setLoading(true); 
    setError(null);
    try {
      // Step 1: Fetch the parent MCP configuration record for this agent
      const { data: configData, error: configError } = await supabase
        .from('mcp_configurations') 
        .select('id')    
        .eq('agent_id', agentId)       
        .maybeSingle(); // Use maybeSingle as agent might not have a config yet

      // Assign error to broader type before checking properties
      const errorCheck: any = configError;
      if (errorCheck && errorCheck.code === 'PGRST116') { // Check code on the broader type
         console.log(`[useAgentMcp:${agentId}] No existing MCP config found.`);
         setMcpConfigId(null);
         setMcpServers([]);
         setLoading(false);
         return;
      } else if (configError) {
         throw configError; // Rethrow other errors
      }

      if (configData) {
        const currentConfigId = configData.id;
        setMcpConfigId(currentConfigId);
        console.log(`[useAgentMcp:${agentId}] Found MCP configuration (ID: ${currentConfigId}). Fetching servers...`);

        // Step 2: Fetch all servers associated with the found configuration ID
        const { data: serverData, error: serverError } = await supabase
          .from('mcp_servers')
          .select('*')
          .eq('config_id', currentConfigId); 

        if (serverError) throw serverError;

        // Define an intermediate type after filtering
        type FilteredServerData = {
          id: number;
          config_id: number;
          name: string; // Guaranteed by filter
          endpoint_url?: string;
          vault_api_key_id?: string | null;
          timeout_ms?: number;
          max_retries?: number;
          retry_backoff_ms?: number;
          priority?: number;
          is_active?: boolean;
          capabilities?: any; 
        };

        // Filter and assert the intermediate type
        const filteredServers = (
          (serverData || [])
            .map(server => ({ ...server, config_id: currentConfigId })) // Add config_id back explicitly
            .filter(s => s.name && typeof s.name === 'string') // Ensure name is a non-empty string
        ) as FilteredServerData[]; // Assert type after filter completes
            
        // Map the strictly typed filtered servers
        const validServers: MCPServerConfig[] = filteredServers.map((s): MCPServerConfig => ({ 
                id: s.id,
                config_id: s.config_id,
                name: s.name, // No assertion needed now
                endpoint_url: s.endpoint_url || '',
                vault_api_key_id: s.vault_api_key_id || null,
                timeout_ms: s.timeout_ms ?? 5000,
                max_retries: s.max_retries ?? 3,
                retry_backoff_ms: s.retry_backoff_ms ?? 1000,
                priority: s.priority ?? 0,
                is_active: s.is_active ?? true,
                capabilities: s.capabilities || null,
            }));
        
        setMcpServers(validServers);
        console.log(`[useAgentMcp:${agentId}] MCP Configurations and Servers loaded:`, validServers.length);
      } else {
        // Case where maybeSingle returns null (no config exists)
        console.log(`[useAgentMcp:${agentId}] No MCP configuration found for this agent.`);
        setMcpConfigId(null);
        setMcpServers([]);
      }

    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error fetching MCP config/servers:`, err);
      setError(`Failed to load MCP configurations: ${err.message || 'Unknown error'}`);
      setMcpServers([]);
      setMcpConfigId(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, user?.id]);

  // Effect to fetch data when agentId changes
  useEffect(() => {
    fetchMcpConfigurations();
  }, [fetchMcpConfigurations]);

  // --- Mutation Functions ---

  // Helper to get or create the parent mcp_configurations record ID
  const ensureMcpConfigExists = async (): Promise<number | null> => {
    if (mcpConfigId) return mcpConfigId;
    if (!agentId || !user?.id) {
        setError("Cannot create MCP configuration without Agent ID and User ID.");
        return null;
    }

    console.log(`[useAgentMcp:${agentId}] No config ID found, creating parent mcp_configurations record...`);
    try {
      const { data, error } = await supabase
        .from('mcp_configurations')
        .insert({ agent_id: agentId, user_id: user.id }) // Ensure user_id if needed by RLS/policy
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("Failed to retrieve ID after creating MCP configuration.");
      
      console.log(`[useAgentMcp:${agentId}] Created MCP configuration record with ID: ${data.id}`);
      setMcpConfigId(data.id); // Store the new ID
      return data.id;
    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error creating MCP configuration record:`, err);
      setError(`Failed to initialize MCP configuration: ${err.message}`);
      return null;
    }
  };

  // Add Server
  const addMcpServer = async (configData: Partial<Omit<MCPServerConfig, 'id' | 'config_id'>>) => {
    if (!agentId) return; // Or throw error
    
    setLoading(true);
    setError(null);
    
    try {
      const targetConfigId = await ensureMcpConfigExists();
      if (!targetConfigId) {
          // Error already set by ensureMcpConfigExists
          setLoading(false);
          return; 
      }
      
      console.log(`[useAgentMcp:${agentId}] Attempting to add MCP server:`, configData.name);

      // Remove potentially sensitive/read-only fields before insert
      const { capabilities, ...restOfData } = configData;
      
      const { data: newServer, error } = await supabase
        .from('mcp_servers')
        .insert({ 
            ...DEFAULT_NEW_SERVER_CONFIG, // Apply defaults first
            ...restOfData, // Apply provided data
            config_id: targetConfigId, // Link to parent config
            name: configData.name || 'Unnamed Server', // Ensure name is set
        })
        .select() // Select the newly created server record
        .single();

      if (error) throw error;
      if (!newServer) throw new Error("Server creation didn't return data.");
      
      console.log(`[useAgentMcp:${agentId}] Added MCP server successfully:`, newServer.id);
      
      // Add the new server to the local state
      setMcpServers(prev => [...prev, newServer as MCPServerConfig]); // Assuming returned data matches MCPServerConfig

    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error adding MCP server:`, err);
      setError(`Failed to add MCP server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update Server
  const updateMcpServer = async (serverId: number, configData: Partial<Omit<MCPServerConfig, 'id' | 'config_id'>>) => {
     if (!agentId || !mcpConfigId) {
         setError("Cannot update server without Agent ID and Config ID.");
         return;
     }
     
     setLoading(true);
     setError(null);
     
     try {
        console.log(`[useAgentMcp:${agentId}] Attempting to update MCP server ID:`, serverId);

        // Prepare data: Ensure config_id isn't accidentally updated, remove read-only fields
        const { capabilities, ...restOfData } = configData;

        const { data: updatedServer, error } = await supabase
            .from('mcp_servers')
            .update({
                ...restOfData, // Apply provided data
                name: configData.name || 'Unnamed Server', // Ensure name isn't empty
                // Ensure config_id is NOT included in the update payload unless intended
            })
            .eq('id', serverId)
            .eq('config_id', mcpConfigId) // Ensure we only update servers belonging to the current agent's config
            .select()
            .single();

        if (error) throw error;
        if (!updatedServer) throw new Error("Server update didn't return data.");
        
        console.log(`[useAgentMcp:${agentId}] Updated MCP server successfully:`, updatedServer.id);

        // Update the server in the local state
        setMcpServers(prev => prev.map(server => 
            server.id === serverId ? (updatedServer as MCPServerConfig) : server
        ));

     } catch (err: any) {
        console.error(`[useAgentMcp:${agentId}] Error updating MCP server:`, err);
        setError(`Failed to update MCP server: ${err.message}`);
     } finally {
        setLoading(false);
     }
  };

  // Delete Server (Renamed from deleteMcpConfiguration for clarity)
  const deleteMcpServer = async (serverId: number) => {
    if (!agentId || !mcpConfigId) {
         setError("Cannot delete server without Agent ID and Config ID.");
         return;
     }
     
     setLoading(true);
     setError(null);
     
     try {
        console.log(`[useAgentMcp:${agentId}] Attempting to delete MCP server ID:`, serverId);

        const { error } = await supabase
            .from('mcp_servers')
            .delete()
            .eq('id', serverId)
            .eq('config_id', mcpConfigId); // Ensure we only delete servers belonging to the current agent's config

        if (error) throw error;
        
        console.log(`[useAgentMcp:${agentId}] Deleted MCP server successfully:`, serverId);

        // Remove the server from the local state
        setMcpServers(prev => prev.filter(server => server.id !== serverId));
        
        // Optional: Check if this was the last server and delete the parent config?
        // Let's skip this for now to keep it simpler.

     } catch (err: any) {
        console.error(`[useAgentMcp:${agentId}] Error deleting MCP server:`, err);
        setError(`Failed to delete MCP server: ${err.message}`);
     } finally {
        setLoading(false);
     }
  };

  // Test Connection (Simplified - assumes endpoint is callable via fetch)
  const testMcpConnection = async (serverConfig: Partial<MCPServerConfig>): Promise<TestConnectionResult | null> => {
      if (!serverConfig?.endpoint_url) {
          return { success: false, message: "Endpoint URL is missing." };
      }
      
      console.log(`[useAgentMcp:${agentId}] Testing connection to: ${serverConfig.endpoint_url}`);
      
      // NOTE: This is a basic placeholder. Real MCP likely involves specific POST requests (e.g., /mcp/initialize)
      //       and handling API keys securely (e.g., fetching from vault).
      try {
          const response = await fetch(serverConfig.endpoint_url, { 
              method: 'POST', // Or GET /mcp/health or similar? Needs MCP spec knowledge.
              headers: { 'Content-Type': 'application/json' }, 
              // Body might be needed for /mcp/initialize
              // body: JSON.stringify({ host: {...}, client: {...} }), 
              signal: AbortSignal.timeout(serverConfig.timeout_ms || 5000) 
          });

          if (!response.ok) {
             throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
          }
          
          // Attempt to parse capabilities if response looks like MCP initialize response
          // This is highly speculative without knowing the actual test endpoint/method
          let capabilities: MCPServerCapabilities | null = null;
          try {
             const data = await response.json();
             if (data && typeof data === 'object' && 'capabilities' in data) {
                 capabilities = data.capabilities as MCPServerCapabilities;
                 console.log(`[useAgentMcp:${agentId}] Discovered capabilities:`, capabilities);
             }
          } catch (parseError) {
             console.warn(`[useAgentMcp:${agentId}] Could not parse JSON response during test.`);
          }

          return { success: true, message: "Connection successful.", capabilities };
          
      } catch (err: any) {
          console.error(`[useAgentMcp:${agentId}] Test connection failed:`, err);
          const message = err.name === 'TimeoutError' ? 'Request timed out' : err.message || 'Unknown error';
          return { success: false, message: `Connection failed: ${message}` };
      }
  };

  // --- Return Values ---
  return {
    mcpServers,
    loading,
    error,
    fetchMcpConfigurations, // Expose refetch if needed
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    testMcpConnection,
    DEFAULT_NEW_SERVER_CONFIG // Expose default config for modal form
  };
}; 