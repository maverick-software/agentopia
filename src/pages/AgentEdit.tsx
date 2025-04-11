import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check, ChevronDown, ChevronUp, Plus, Edit, Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent, Datastore } from '../types';
import { DiscordConnect } from '../components/DiscordConnect';
import { MCPServerConfig, MCPServerCapabilities } from '../lib/mcp/types';

interface Agent {
  id: string;
  name: string;
  description: string;
  personality: string;
  active: boolean;
  discord_channel?: string;
  discord_bot_key?: string;
  system_instructions?: string;
  assistant_instructions?: string;
  created_at?: string;
  updated_at?: string;
}

const personalityTemplates = [
  { id: 'disc-d', name: 'DISC - Dominant', description: 'Direct, results-oriented, strong-willed' },
  { id: 'disc-i', name: 'DISC - Influential', description: 'Outgoing, enthusiastic, optimistic' },
  { id: 'disc-s', name: 'DISC - Steady', description: 'Patient, stable, consistent' },
  { id: 'disc-c', name: 'DISC - Conscientious', description: 'Accurate, analytical, systematic' },
  { id: 'mbti-intj', name: 'MBTI - INTJ', description: 'Architect - Imaginative and strategic thinkers' },
  { id: 'mbti-enfp', name: 'MBTI - ENFP', description: 'Campaigner - Enthusiastic, creative, sociable' },
  { id: 'custom', name: 'Custom Template', description: 'Create your own personality template' },
];

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

interface TestConnectionResult {
    success: boolean;
    message: string;
    capabilities?: MCPServerCapabilities | null;
}

export function AgentEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Agent>>({
    name: '',
    description: '',
    personality: '',
    discord_channel: '',
    discord_bot_key: '',
    system_instructions: '',
    assistant_instructions: '',
    active: true
  });

  const [showDatastoreModal, setShowDatastoreModal] = useState(false);
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [selectedDatastores, setSelectedDatastores] = useState<{
    vector?: string;
    knowledge?: string;
  }>({});
  const [loadingDatastores, setLoadingDatastores] = useState(false);
  const [connectingDatastores, setConnectingDatastores] = useState(false);

  // NEW State for MCP Section
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpSectionExpanded, setMcpSectionExpanded] = useState(false);

  // NEW State for MCP Server Management
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [mcpFormData, setMcpFormData] = useState<Partial<MCPServerConfig>>(DEFAULT_NEW_SERVER_CONFIG);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<TestConnectionResult | null>(null);
  const [discoveredCapabilities, setDiscoveredCapabilities] = useState<MCPServerCapabilities | null>(null);

  const fetchAgentAttempts = useRef(0);
  const fetchDatastoresAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 5;

  // Reset success message after 3 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (saveSuccess) {
      timeout = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  // Fetch Agent Data Effect
  const fetchAgent = useCallback(async (agentId: string, isInitialCall = true) => {
    if (!user?.id) return;

    let currentAttempt = fetchAgentAttempts.current + 1;
    if (isInitialCall) { currentAttempt = 1; fetchAgentAttempts.current = 0; }
    fetchAgentAttempts.current = currentAttempt;

    if (currentAttempt > MAX_FETCH_ATTEMPTS) {
      console.warn(`Max fetch attempts (${MAX_FETCH_ATTEMPTS}) reached for agent ${agentId}. Aborting.`);
      setError(`Failed to load agent after ${MAX_FETCH_ATTEMPTS} attempts.`);
      setLoading(false);
      return;
    }
    console.log(`Fetching agent ${agentId}... Attempt ${currentAttempt}`);

    try {
      setLoading(true);
      setError(null);

      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user.id)
        .single();

      if (agentError) throw new Error(agentError.message);
      if (!agentData) throw new Error('Agent not found or access denied');

      setFormData(agentData);
      setLoading(false); // Stop loading on success

      // Fetch associated datastores (nested call, no separate retry for simplicity here)
      const { data: connections, error: connectionsError } = await supabase
        .from('agent_datastores')
        .select(`datastore_id, datastores:datastore_id (id, type)`)
        .eq('agent_id', agentId);
      
      if (connectionsError) throw new Error(connectionsError.message); // Or handle more gracefully

      if (connections) {
        const vectorStore = connections.find(c => c.datastores?.type === 'pinecone');
        const knowledgeStore = connections.find(c => c.datastores?.type === 'getzep');

        setSelectedDatastores({
          vector: vectorStore?.datastore_id,
          knowledge: knowledgeStore?.datastore_id
        });
      }

      // Reset attempts on SUCCESS
      if (isInitialCall) fetchAgentAttempts.current = 0;

    } catch (err: any) {
      console.error('Error fetching agent:', err);
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchAgent(agentId, false), delay); // Retry
        setError(`Failed to load agent. Retrying... (${currentAttempt}/${MAX_FETCH_ATTEMPTS})`);
      } else {
        setError(`Failed to load agent after ${MAX_FETCH_ATTEMPTS} attempts.`);
        console.error('Max fetch attempts reached for agent after error.');
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (isEditing && id) {
      fetchAgentAttempts.current = 0; // Reset before initial sequence
      fetchAgent(id, true);
    }
  }, [id, isEditing, user, fetchAgent]);

  // Fetch Datastores List Effect
  const fetchDatastores = useCallback(async (isInitialCall = true) => {
    if (!user?.id) return;

    let currentAttempt = fetchDatastoresAttempts.current + 1;
    if (isInitialCall) { currentAttempt = 1; fetchDatastoresAttempts.current = 0; }
    fetchDatastoresAttempts.current = currentAttempt;

    if (currentAttempt > MAX_FETCH_ATTEMPTS) {
       console.warn(`Max fetch attempts (${MAX_FETCH_ATTEMPTS}) reached for datastores list. Aborting.`);
       setError('Failed to load datastore list for selection.'); 
       setLoadingDatastores(false);
       return;
    }
    console.log(`Fetching datastores list... Attempt ${currentAttempt}`);

    try {
      setLoadingDatastores(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('datastores')
        .select('id, name, type')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      setDatastores(data || []);
      setLoadingDatastores(false); // Stop loading on success
      if (isInitialCall) fetchDatastoresAttempts.current = 0; // Reset on success

    } catch (err: any) {
      console.error('Error fetching datastores list:', err);
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchDatastores(false), delay); // Retry
        setError(`Failed to load datastore list. Retrying... (${currentAttempt}/${MAX_FETCH_ATTEMPTS})`);
      } else {
        setError(`Failed to load datastore list after ${MAX_FETCH_ATTEMPTS} attempts.`);
        console.error('Max fetch attempts reached for datastore list after error.');
        setLoadingDatastores(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (showDatastoreModal && datastores.length === 0 && !loadingDatastores) {
      fetchDatastoresAttempts.current = 0; // Reset before initial sequence
      fetchDatastores(true);
    }
  }, [showDatastoreModal, datastores.length, loadingDatastores, user, fetchDatastores]);

  // *** NEW MCP API Call Functions ***

  // Fetch existing MCP configurations for the agent
  const fetchMcpConfigurations = useCallback(async () => {
    if (!id || !user?.id) return;
    console.log(`[AgentEdit:${id}] Fetching MCP configurations...`);
    setLoading(true); // Use general loading state for now
    setError(null);
    try {
      // Fetch the MCP configuration record linked to this agent_id
      const { data: configData, error: configError } = await supabase
        .from('mcp_configurations') // Query the configurations table directly
        .select('id, is_enabled')    // Select the config ID and enabled status
        .eq('agent_id', id)        // Filter by the current agent's ID
        .maybeSingle();             // Use maybeSingle as an agent might not have a config yet

      if (configError) throw new Error(`Error fetching MCP configuration: ${configError.message}`);

      if (!configData) {
        // No configuration found for this agent
        console.log(`[AgentEdit:${id}] No MCP configuration found for this agent.`);
        setMcpEnabled(false);
        setMcpServers([]);
        setLoading(false);
        return; 
      }

      // We found a configuration record
      const configId = configData.id;
      setMcpEnabled(configData.is_enabled ?? false);
      console.log(`[AgentEdit:${id}] Found MCP configuration (ID: ${configId}, Enabled: ${configData.is_enabled}). Fetching servers...`);

      // Fetch the associated servers for this configuration ID
      const { data: serversData, error: serversError } = await supabase
        .from('mcp_servers')
        .select('*') // Select all fields for editing
        .eq('config_id', configId);

      if (serversError) throw new Error(`Error fetching MCP servers: ${serversError.message}`);

      // NOTE: We are selecting '*' which includes vault_api_key_id.
      // Ensure this ID is NEVER sent back to the server during update/test/discover
      // unless specifically intended for a secure backend operation.
      // The frontend should generally treat the key itself as opaque.
      console.log(`[AgentEdit:${id}] Fetched ${serversData?.length || 0} MCP servers.`);
      setMcpServers(serversData || []);

    } catch (err: any) {
      console.error('[AgentEdit] Error fetching MCP configurations:', err);
      setError(`Failed to load MCP configurations: ${err.message}`);
      setMcpEnabled(false);
      setMcpServers([]);
    } finally {
      setLoading(false);
    }
  }, [id, user]); // Removed supabase from deps as it's stable

  // Fetch MCP Configurations Effect
  useEffect(() => {
    if (id && user?.id) {
      fetchMcpConfigurations();
    }
  }, [id, user, fetchMcpConfigurations]); // Dependency fetchMcpConfigurations added

  // Add a new MCP Server and Configuration
  const addMcpServer = async (configData: Partial<MCPServerConfig>) => {
    if (!id || !user?.id) throw new Error("Agent ID or User ID missing");
    console.log(`[AgentEdit:${id}] Attempting to add MCP server:`, configData.name);
    setSaving(true);
    setError(null);
    try {
      // 1. Insert into mcp_servers
      console.log(`[AgentEdit:${id}] Inserting into mcp_servers...`);
      const { data: serverData, error: serverError } = await supabase
        .from('mcp_servers')
        .insert({
          endpoint_url: configData.endpoint_url,
          vault_api_key_id: configData.vault_api_key_id || null,
          // capabilities will be filled by discovery/test later
        })
        .select()
        .single();

      if (serverError) throw serverError;
      if (!serverData) throw new Error("Failed to create server entry.");
      console.log(`[AgentEdit:${id}] Server entry created (ID: ${serverData.id}). Inserting into mcp_configurations...`);

      // 2. Insert into mcp_configurations
      const { data: configEntry, error: configError } = await supabase
        .from('mcp_configurations')
        .insert({
          agent_id: id,
          user_id: user.id,
          server_id: serverData.id,
          name: configData.name,
          is_active: configData.is_active,
          priority: configData.priority,
          timeout_ms: configData.timeout_ms,
          max_retries: configData.max_retries,
          retry_backoff_ms: configData.retry_backoff_ms,
        })
        .select()
        .single();

      if (configError) throw configError;
      if (!configEntry) throw new Error("Failed to create configuration entry.");
      console.log(`[AgentEdit:${id}] Configuration entry created (ID: ${configEntry.id}). Updating local state.`);

      // Add to local state
      const newServer: MCPServerConfig = {
        ...DEFAULT_NEW_SERVER_CONFIG, // Apply defaults
        ...configData, // Apply form data
        id: serverData.id,
        config_id: configEntry.id,
        capabilities: null, // Initially null
      };
      setMcpServers(prev => [...prev, newServer]);
      setSaveSuccess(true);
      console.log(`[AgentEdit:${id}] Successfully added MCP server: ${configData.name}`);

    } catch (err: any) {
      console.error(`[AgentEdit:${id}] Error adding MCP server configuration:`, err);
      setError(`Failed to add MCP server: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Update an existing MCP Server Configuration
  const updateMcpServer = async (configId: number, serverId: number, configData: Partial<MCPServerConfig>) => {
    if (!id || !user?.id) throw new Error("Agent ID or User ID missing");
    console.log(`[AgentEdit:${id}] Attempting to update MCP config ID: ${configId} (Server ID: ${serverId})`);
    setSaving(true);
    setError(null);
    try {
      // 1. Update mcp_servers
      console.log(`[AgentEdit:${id}] Updating mcp_servers (ID: ${serverId})...`);
      const { error: serverError } = await supabase
        .from('mcp_servers')
        .update({
          endpoint_url: configData.endpoint_url,
          vault_api_key_id: configData.vault_api_key_id || null,
          // Note: capabilities are typically updated by discovery/test, not manually here
          updated_at: new Date().toISOString(),
        })
        .eq('id', serverId);

      if (serverError) throw serverError;
      console.log(`[AgentEdit:${id}] Server entry updated. Updating mcp_configurations (ID: ${configId})...`);

      // 2. Update mcp_configurations
      const { error: configError } = await supabase
        .from('mcp_configurations')
        .update({
          name: configData.name,
          is_active: configData.is_active,
          priority: configData.priority,
          timeout_ms: configData.timeout_ms,
          max_retries: configData.max_retries,
          retry_backoff_ms: configData.retry_backoff_ms,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId)
        .eq('agent_id', id); // Ensure ownership

      if (configError) throw configError;
      console.log(`[AgentEdit:${id}] Configuration entry updated. Updating local state.`);

      // Update local state
      setMcpServers(prev => prev.map(s => s.config_id === configId ? { ...s, ...configData, id: serverId } : s));
      setSaveSuccess(true);
      console.log(`[AgentEdit:${id}] Successfully updated MCP config ID: ${configId}`);

    } catch (err: any) {
      console.error(`[AgentEdit:${id}] Error updating MCP server configuration:`, err);
      setError(`Failed to update MCP server: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete an MCP Configuration
  const deleteMcpConfiguration = async (configId: number) => {
     if (!id || !user?.id) return;
    console.log(`[AgentEdit:${id}] Attempting to delete MCP config ID: ${configId}`);
    setSaving(true);
    setError(null);
    try {
        // We rely on RLS and potentially database cascade rules or triggers
        // to handle the deletion of the mcp_servers entry if it's no longer referenced.
        // Directly deleting from mcp_configurations based on configId and agent_id.
        const { error } = await supabase
            .from('mcp_configurations')
            .delete()
            .eq('id', configId)
            .eq('agent_id', id);

        if (error) throw error;

        setMcpServers(prev => prev.filter(s => s.config_id !== configId));
        setSaveSuccess(true);
        console.log(`[AgentEdit:${id}] Successfully deleted MCP config ID: ${configId}`);

    } catch (err: any) {
        console.error(`[AgentEdit:${id}] Error deleting MCP configuration:`, err);
        setError(`Failed to delete MCP configuration: ${err.message}`);
    } finally {
        setSaving(false);
    }
  };

  // Call the /test function
  const testMcpConnection = async (serverConfig: Partial<MCPServerConfig>): Promise<TestConnectionResult | null> => {
    console.log(`[AgentEdit:${id}] Attempting to test MCP connection for: ${serverConfig.endpoint_url}`);
    setIsTestingConnection(true);
    setTestConnectionResult(null);
    setError(null);
    try {
      console.log(`[AgentEdit:${id}] Invoking mcp-server-utils function (/test)...`);
      
      // IMPORTANT: Create a config object for the function call *without* sensitive IDs
      const configForTest = {
          id: serverConfig.id,
          config_id: serverConfig.config_id,
          name: serverConfig.name,
          endpoint_url: serverConfig.endpoint_url,
          timeout_ms: serverConfig.timeout_ms,
          max_retries: serverConfig.max_retries,
          retry_backoff_ms: serverConfig.retry_backoff_ms,
          priority: serverConfig.priority,
          // DO NOT SEND vault_api_key_id or api_key from frontend
      };

      const { data, error } = await supabase.functions.invoke('mcp-server-utils', {
        // Pass the cleaned config
        body: { serverConfig: configForTest }, 
      });

      if (error) throw error;
      if (!data) throw new Error("No response data from /test function.");
      console.log(`[AgentEdit:${id}] Received test connection result:`, data);

      setTestConnectionResult(data as TestConnectionResult);
      if (data.success && data.capabilities) {
        console.log(`[AgentEdit:${id}] Test successful, updating capabilities in state.`);
        setDiscoveredCapabilities(data.capabilities);
        if (serverConfig.id) {
          setMcpServers(prev => prev.map(s => s.id === serverConfig.id ? { ...s, capabilities: data.capabilities } : s));
        }
      }
      return data as TestConnectionResult;
    } catch (err: any) {
      console.error(`[AgentEdit:${id}] Error testing MCP connection:`, err);
      const errorMessage = `Failed to test connection: ${err.message || 'Unknown error'}`;
      setError(errorMessage);
      setTestConnectionResult({ success: false, message: errorMessage });
      return null;
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Call the /discover function
  const discoverMcpCapabilities = async (serverConfig: Partial<MCPServerConfig>) => {
    console.log(`[AgentEdit:${id}] Attempting to discover MCP capabilities for: ${serverConfig.endpoint_url}`);
    setIsTestingConnection(true);
    setDiscoveredCapabilities(null);
    setError(null);
    try {
      console.log(`[AgentEdit:${id}] Invoking mcp-server-utils function (/discover)...`);
      
      // IMPORTANT: Create a config object for the function call *without* sensitive IDs
      const configForDiscovery = {
          id: serverConfig.id,
          config_id: serverConfig.config_id,
          name: serverConfig.name,
          endpoint_url: serverConfig.endpoint_url,
          timeout_ms: serverConfig.timeout_ms,
          max_retries: serverConfig.max_retries,
          retry_backoff_ms: serverConfig.retry_backoff_ms,
          priority: serverConfig.priority,
          // DO NOT SEND vault_api_key_id or api_key from frontend
      };

      const { data, error } = await supabase.functions.invoke('mcp-server-utils/discover', {
         // Pass the cleaned config
        body: { serverConfig: configForDiscovery },
      });
      
      if (error) throw error;
      if (!data || !data.success || !data.capabilities) {
        throw new Error(data?.message || "Discovery failed or did not return capabilities.");
      }
      console.log(`[AgentEdit:${id}] Received discovered capabilities:`, data.capabilities);

      setDiscoveredCapabilities(data.capabilities);
      if (serverConfig.id) {
        console.log(`[AgentEdit:${id}] Updating capabilities in local server list state.`);
        setMcpServers(prev => prev.map(s => s.id === serverConfig.id ? { ...s, capabilities: data.capabilities } : s));
      }
      setError(null);

    } catch (err: any) {
      console.error(`[AgentEdit:${id}] Error discovering MCP capabilities:`, err);
      setError(`Failed to discover capabilities: ${err.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // *** End NEW MCP API Call Functions ***

  const handleConnectDatastores = async () => {
    if (!id || !user?.id) return;

    try {
      setConnectingDatastores(true);
      setError(null);

      // Remove existing connections
      const { error: deleteError } = await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', id);

      if (deleteError) throw deleteError;

      // Add new connections
      const connections = [];
      if (selectedDatastores.vector) {
        connections.push({
          agent_id: id,
          datastore_id: selectedDatastores.vector
        });
      }
      if (selectedDatastores.knowledge) {
        connections.push({
          agent_id: id,
          datastore_id: selectedDatastores.knowledge
        });
      }

      if (connections.length > 0) {
        const { error: insertError } = await supabase
          .from('agent_datastores')
          .insert(connections);

        if (insertError) throw insertError;
      }

      setShowDatastoreModal(false);
    } catch (err) {
      console.error('Error connecting datastores:', err);
      setError('Failed to connect datastores. Please try again.');
    } finally {
      setConnectingDatastores(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const agentData = {
        ...formData,
        user_id: user.id,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('agents')
          .update(agentData)
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { data, error: insertError } = await supabase
          .from('agents')
          .insert([agentData])
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        
        // If creating new agent, update the URL to edit mode
        if (data) {
          navigate(`/agents/${data.id}`, { replace: true });
        }
      }

      // Placeholder for MCP config save
      console.log("TODO: Save MCP Config - Enabled:", mcpEnabled);
      // Fetch/Upsert mcp_configurations record
      // Delete/Insert/Update mcp_servers records based on UI state

      setSaveSuccess(true);
    } catch (err) {
      console.error('Error saving agent:', err);
      setError('Failed to save agent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- MCP Modal Handlers ---
  const handleOpenMcpModal = (server: MCPServerConfig | null) => {
    if (server) {
      setEditingServer(server);
      setMcpFormData(server);
      setDiscoveredCapabilities(server.capabilities || null);
    } else {
      setEditingServer(null);
      setMcpFormData(DEFAULT_NEW_SERVER_CONFIG);
      setDiscoveredCapabilities(null);
    }
    setTestConnectionResult(null); // Clear previous test results
    setShowMcpModal(true);
  };

  const handleCloseMcpModal = () => {
    setShowMcpModal(false);
    setEditingServer(null);
    setMcpFormData(DEFAULT_NEW_SERVER_CONFIG);
    setTestConnectionResult(null);
    setDiscoveredCapabilities(null);
    setError(null); // Clear any modal-specific errors
  };

  const handleMcpFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setMcpFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value),
    }));
  };

  // UPDATED: Uses addMcpServer or updateMcpServer
  const handleSaveMcpServer = async () => {
    if (editingServer) {
      await updateMcpServer(editingServer.config_id!, editingServer.id!, mcpFormData);
    } else {
      await addMcpServer(mcpFormData);
    }
    // Close modal only if there wasn't an error during save
    if (!error) {
      handleCloseMcpModal();
    }
  };

  // UPDATED: Uses deleteMcpConfiguration
  const handleDeleteMcpServer = async (configId: number) => {
    if (window.confirm('Are you sure you want to delete this MCP configuration?')) {
      await deleteMcpConfiguration(configId);
    }
  };

  // UPDATED: Uses testMcpConnection
  const handleTestConnection = async () => {
    await testMcpConnection(mcpFormData);
    // Result and capabilities are set within testMcpConnection
  };

  // TODO: Potentially add a separate handler/button for discoverMcpCapabilities if needed
  // const handleDiscoverCapabilities = async () => {
  //   await discoverMcpCapabilities(mcpFormData);
  // };
  // --- End MCP Modal Handlers ---

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to manage agents.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading agent...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/agents')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Agent' : 'Create New Agent'}
          </h1>
        </div>
        <div className="flex space-x-4">
          {isEditing && (
            <button
              onClick={() => setShowDatastoreModal(true)}
              className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <Database className="w-5 h-5 mr-2" />
              Connect Datastores
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              saveSuccess
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Agent
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter agent name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter agent description"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Personality Template
              </label>
              <select
                required
                value={formData.personality}
                onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a template</option>
                {personalityTemplates.map(template => (
                  <option key={template.id} value={template.name}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Discord Configuration */}
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Discord Configuration</h2>
            
            <DiscordConnect
              agentId={id || ''}
              onChannelSelect={(channelId) => setFormData({ 
                ...formData, 
                discord_channel: channelId 
              })}
              isConnected={Boolean(formData.discord_bot_key && formData.discord_channel)}
            />
          </div>
        </div>

        {/* System Instructions */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">System Instructions</h2>
          <p className="text-sm text-gray-400 mb-4">
            Define the core behavior and capabilities of your AI agent. These instructions set the foundation for how the agent will interact and process information.
          </p>
          <div className="h-64 border border-gray-700 rounded-lg overflow-hidden">
            <MonacoEditor
              language="markdown"
              theme="vs-dark"
              value={formData.system_instructions}
              onChange={(value) => setFormData({ ...formData, system_instructions: value })}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Assistant Instructions */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Assistant Instructions</h2>
          <p className="text-sm text-gray-400 mb-4">
            Specify additional context and instructions for the assistant, including any relevant information from datastores or specific behavioral guidelines.
          </p>
          <div className="h-64 border border-gray-700 rounded-lg overflow-hidden">
            <MonacoEditor
              language="markdown"
              theme="vs-dark"
              value={formData.assistant_instructions}
              onChange={(value) => setFormData({ ...formData, assistant_instructions: value })}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* MCP Connections Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <button
            onClick={() => setMcpSectionExpanded(!mcpSectionExpanded)}
            className="flex justify-between items-center w-full text-left mb-4"
          >
            <h2 className="text-xl font-semibold">MCP Connections / External Tools</h2>
            {mcpSectionExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          {mcpSectionExpanded && (
            <div className="space-y-6 pt-4 border-t border-gray-700">
              {/* Master Enable Toggle */}
              <div className="flex items-center justify-between bg-gray-700 p-4 rounded-md">
                <label htmlFor="mcp-enabled" className="font-medium text-gray-200">
                  Enable MCP Client Functionality
                </label>
                <button
                  type="button"
                  onClick={() => setMcpEnabled(!mcpEnabled)}
                  className={`${mcpEnabled ? 'bg-indigo-600' : 'bg-gray-600'}
                    relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800`}
                  role="switch"
                  aria-checked={mcpEnabled}
                  id="mcp-enabled"
                >
                  <span
                    aria-hidden="true"
                    className={`${mcpEnabled ? 'translate-x-5' : 'translate-x-0'}
                      pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>

              {mcpEnabled ? (
                <div className="space-y-4">
                  {/* Server List Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-750">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Endpoint</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Active</th>
                          <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {mcpServers.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                              No MCP servers configured.
                            </td>
                          </tr>
                        )}
                        {mcpServers.map((server) => (
                          <tr key={server.id} className="hover:bg-gray-750">
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-200">{server.name}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs">{server.endpoint_url}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">{server.priority}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">
                              {server.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                                  Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                                  No
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                              <button
                                type="button"
                                onClick={() => handleOpenMcpModal(server)}
                                className="text-indigo-400 hover:text-indigo-300"
                                title="Edit Server"
                              >
                                <Edit className="h-4 w-4 inline" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMcpServer(server.config_id!)}
                                className="text-red-500 hover:text-red-400"
                                title="Delete Server"
                              >
                                <Trash2 className="h-4 w-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Add Server Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleOpenMcpModal(null)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    >
                      <Plus className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                      Add MCP Server
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Enable MCP Client functionality to configure server connections.
                </p>
              )}
            </div>
          )}
        </div>
        {/* End MCP Connections Section */}
      </form>

      {/* Datastore Connection Modal */}
      {showDatastoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Connect Datastores</h2>
            
            {loadingDatastores ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading datastores...</p>
              </div>
            ) : datastores.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No datastores found. Create a datastore first.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Vector Datastore Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vector Datastore (Pinecone)
                  </label>
                  <select
                    value={selectedDatastores.vector || ''}
                    onChange={(e) => setSelectedDatastores({
                      ...selectedDatastores,
                      vector: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a vector datastore</option>
                    {datastores
                      .filter(ds => ds.type === 'pinecone')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Knowledge Graph Datastore Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Knowledge Graph (GetZep)
                  </label>
                  <select
                    value={selectedDatastores.knowledge || ''}
                    onChange={(e) => setSelectedDatastores({
                      ...selectedDatastores,
                      knowledge: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a knowledge graph datastore</option>
                    {datastores
                      .filter(ds => ds.type === 'getzep')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowDatastoreModal(false)}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    disabled={connectingDatastores}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnectDatastores}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={connectingDatastores}
                  >
                    {connectingDatastores ? 'Connecting...' : 'Connect Datastores'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MCP Server Configuration Modal */}
      {showMcpModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75 transition-opacity duration-300">
          <div className="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay, show/hide based on modal state. */}
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-800 opacity-75"></div>
            </div>

            {/* This element is to trick the browser into centering the modal contents. */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel, show/hide based on modal state. */}
            <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-100 mb-4" id="modal-title">
                      {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
                    </h3>
                    <div className="mt-2 space-y-4">
                      {/* Form Fields */}
                      <div>
                        <label htmlFor="mcp-name" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                        <input
                          type="text"
                          name="name"
                          id="mcp-name"
                          value={mcpFormData.name || ''}
                          onChange={handleMcpFormChange}
                          required
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="mcp-endpoint" className="block text-sm font-medium text-gray-300 mb-1">Endpoint URL</label>
                        <input
                          type="url"
                          name="endpoint_url"
                          id="mcp-endpoint"
                          value={mcpFormData.endpoint_url || ''}
                          onChange={handleMcpFormChange}
                          required
                          placeholder="https://your-mcp-server.com/api"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="mcp-apikey" className="block text-sm font-medium text-gray-300 mb-1">API Key (Stored in Vault)</label>
                        <input
                          type="password" /* Use password type */
                          name="api_key_input" /* Use a different name for input to avoid direct state binding */
                          id="mcp-apikey"
                          placeholder={editingServer ? "Key set (********)" : "Enter key to store in Vault"} // Indicate if set
                          onChange={(e) => {
                             // TODO: Handle API Key input - likely store separately before vaulting
                             // For now, this input doesn't directly map to vault_api_key_id
                             console.log("API Key input changed (not saved directly):");
                          }}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                         <p className="mt-1 text-xs text-gray-400">Enter a new key to update the one stored securely in the Vault. Leave blank to keep existing key.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="mcp-timeout" className="block text-sm font-medium text-gray-300 mb-1">Timeout (ms)</label>
                            <input type="number" name="timeout_ms" id="mcp-timeout" value={mcpFormData.timeout_ms ?? 5000} onChange={handleMcpFormChange} min="0" required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                         <div>
                            <label htmlFor="mcp-maxretries" className="block text-sm font-medium text-gray-300 mb-1">Max Retries</label>
                            <input type="number" name="max_retries" id="mcp-maxretries" value={mcpFormData.max_retries ?? 3} onChange={handleMcpFormChange} min="0" required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                         <div>
                            <label htmlFor="mcp-backoff" className="block text-sm font-medium text-gray-300 mb-1">Backoff (ms)</label>
                            <input type="number" name="retry_backoff_ms" id="mcp-backoff" value={mcpFormData.retry_backoff_ms ?? 1000} onChange={handleMcpFormChange} min="0" required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                         <div>
                            <label htmlFor="mcp-priority" className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                            <input type="number" name="priority" id="mcp-priority" value={mcpFormData.priority ?? 0} onChange={handleMcpFormChange} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                       <div className="flex items-center">
                            <input id="mcp-active" name="is_active" type="checkbox" checked={mcpFormData.is_active ?? true} onChange={handleMcpFormChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 rounded bg-gray-700" />
                            <label htmlFor="mcp-active" className="ml-2 block text-sm text-gray-300">Active</label>
                        </div>

                      {/* Test Connection Result */}
                      {testConnectionResult && (
                        <div className={`flex items-center p-3 rounded-md text-sm ${testConnectionResult.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                            {testConnectionResult.success ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertTriangle className="h-5 w-5 mr-2" />}
                            {testConnectionResult.message}
                        </div>
                      )}

                      {/* Discovered Capabilities Display */}
                      {discoveredCapabilities && (
                          <div className="mt-4 p-3 bg-gray-700 rounded-md">
                              <h4 className="text-sm font-medium text-gray-300 mb-2">Discovered Server Capabilities:</h4>
                              <pre className="text-xs text-gray-400 whitespace-pre-wrap break-all bg-gray-800 p-2 rounded">
                                  {JSON.stringify(discoveredCapabilities, null, 2)}
                              </pre>
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse items-center">
                 <button
                  type="button"
                  onClick={handleSaveMcpServer}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Save Server
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-gray-200 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isTestingConnection ? (
                      <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Testing...</>
                  ) : (
                     'Test Connection'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCloseMcpModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}