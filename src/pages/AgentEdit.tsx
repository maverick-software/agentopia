import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check, ChevronDown, ChevronUp, Plus, Edit, Trash2, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent as AgentType, Datastore } from '../types';
import { DiscordConnect } from '../components/DiscordConnect';
import { useAgentMcp } from '../hooks/useAgentMcp';
import { AgentMcpSection } from '../components/AgentMcpSection';

interface DiscordConnection {
  guildId: string;
  channelId: string;
  guildName?: string;
  channelName?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  personality: string;
  active: boolean;
  discord_connections?: DiscordConnection[];
  discord_bot_token_encrypted?: string;
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
    discord_connections: [],
    discord_bot_token_encrypted: '',
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

  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [showSystemModal, setShowSystemModal] = useState(false);

  // Discord state variables
  const [botToken, setBotToken] = useState('');
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false);
  const [discordGuilds, setDiscordGuilds] = useState<any[]>([]);
  const [fetchingGuilds, setFetchingGuilds] = useState(false);

  const fetchAgentAttempts = useRef(0);
  const fetchDatastoresAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 5;

  const {
    mcpServers, 
    loading: mcpLoading,
    error: mcpError,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    testMcpConnection 
  } = useAgentMcp(id);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (saveSuccess) {
      timeout = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

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

      // Fetch agent data
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user.id)
        .single();

      if (agentError) throw new Error(agentError.message);
      if (!agentData) throw new Error('Agent not found or access denied');

      // Fetch Discord connections for this agent
      const { data: discordConnections, error: discordError } = await supabase
        .from('agent_discord_connections')
        .select('guild_id, channel_id')
        .eq('agent_id', agentId);

      if (discordError) throw new Error(discordError.message);

      // Convert to DiscordConnection format
      const formattedConnections: DiscordConnection[] = (discordConnections || []).map(conn => ({
        guildId: conn.guild_id,
        channelId: conn.channel_id
      }));

      setFormData({
        ...agentData,
        discord_connections: formattedConnections || [],
      });

      // If we have a Discord token, fetch guilds to get names
      if (agentData.discord_bot_token_encrypted && formattedConnections.length > 0) {
        fetchDiscordGuilds();
      }

      setLoading(false);

    } catch (err: any) {
      console.error('Error fetching agent:', err);
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchAgent(agentId, false), delay);
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
      fetchAgentAttempts.current = 0;
      fetchAgent(id, true);
    }
  }, [id, isEditing, user, fetchAgent]);

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

      setDatastores((data || []) as Datastore[]);
      setLoadingDatastores(false);
      if (isInitialCall) fetchDatastoresAttempts.current = 0;

    } catch (err: any) {
      console.error('Error fetching datastores list:', err);
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchDatastores(false), delay);
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
      fetchDatastoresAttempts.current = 0;
      fetchDatastores(true);
    }
  }, [showDatastoreModal, datastores.length, loadingDatastores, user, fetchDatastores]);

  const handleDiscordDisconnectBot = () => {
    // Call the Edge Function to disconnect the bot
    disconnectDiscordBot();
  };

  const handleAddDiscordChannel = (connection: DiscordConnection) => {
    setFormData(prevData => {
      const exists = (prevData.discord_connections ?? []).some(
        (c) => c.channelId === connection.channelId
      );
      if (exists) return prevData;

      return {
        ...prevData,
        discord_connections: [...(prevData.discord_connections ?? []), connection],
      };
    });
  };

  const handleRemoveDiscordChannel = (channelIdToRemove: string) => {
    setFormData(prevData => ({
      ...prevData,
      discord_connections: (prevData.discord_connections ?? []).filter(
        (c) => c.channelId !== channelIdToRemove
      ),
    }));
  };

  // Checklist Step 1.9: Implement Remove Guild handler
  const handleRemoveDiscordGuild = (guildIdToRemove: string) => {
    setFormData(prevData => ({
      ...prevData,
      discord_connections: (prevData.discord_connections ?? []).filter(
        (c) => c.guildId !== guildIdToRemove
      ),
    }));
    // Note: This only removes frontend state. 
    // Actual persistence happens on main save.
    // No separate backend call needed here usually.
  };

  // Update temporary function to use our new method
  const handleTempConnectSuccess = (token: string) => {
    // Connect the Discord bot using our new Edge Function
    connectDiscordBot(token);
  };

  const handleConnectDatastores = async () => {
    if (!id || !user?.id) return;

    try {
      setConnectingDatastores(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', id);

      if (deleteError) throw deleteError;

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

  // Function to connect Discord bot token
  const connectDiscordBot = async (token: string) => {
    if (!id || !token.trim()) {
      setError('Agent ID and bot token are required');
      return;
    }

    setDiscordLoading(true);
    setError(null);
    try {
      // Call the discord-connect Edge Function
      const { data, error } = await supabase.functions.invoke('discord-connect', {
        body: { agentId: id, botToken: token },
      });
      
      if (error) throw new Error(error.message || 'Failed to connect Discord bot');
      
      console.log('Discord bot connected successfully');
      // Update local state
      setFormData(prevData => ({
        ...prevData,
        discord_token_encrypted: 'connected', // Just a placeholder to show it's connected
      }));
      
      // Fetch guilds and channels after successful connection
      await fetchDiscordGuilds();
      
    } catch (err: any) {
      console.error('Discord connection error:', err);
      setError(err.message || 'Failed to connect to Discord');
    } finally {
      setDiscordLoading(false);
      setBotToken(''); // Clear token for security
    }
  };

  // Function to disconnect Discord bot
  const disconnectDiscordBot = async () => {
    if (!id) return;
    
    setDiscordDisconnecting(true);
    setError(null);
    try {
      // Call the discord-disconnect Edge Function
      const { data, error } = await supabase.functions.invoke('discord-disconnect', {
        body: { agentId: id },
      });
      
      if (error) throw new Error(error.message || 'Failed to disconnect Discord bot');
      
      console.log('Discord bot disconnected successfully');
      // Update local state
      setFormData(prevData => ({
        ...prevData,
        discord_token_encrypted: '',
        discord_connections: [],
      }));
      
      // Clear guilds data
      setDiscordGuilds([]);
      
    } catch (err: any) {
      console.error('Discord disconnection error:', err);
      setError(err.message || 'Failed to disconnect Discord bot');
    } finally {
      setDiscordDisconnecting(false);
    }
  };

  // Function to fetch Discord guilds and channels
  const fetchDiscordGuilds = async () => {
    if (!id) return;
    
    setFetchingGuilds(true);
    setError(null);
    try {
      // Construct the function URL with the query parameter
      const functionName = 'discord-get-bot-guilds';
      const queryParams = new URLSearchParams({ agentId: id });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; // Get base URL from env
      if (!supabaseUrl) throw new Error('Supabase URL not configured in environment variables.');
      const invokeUrl = `${supabaseUrl}/functions/v1/${functionName}?${queryParams.toString()}`;

      // Call the discord-get-bot-guilds Edge Function using fetch
      // We need to use fetch directly to control the URL with query params
      // supabase.functions.invoke doesn't easily support adding query params
      const response = await fetch(invokeUrl, {
         method: 'GET', // Or POST if your function requires it, but GET seems appropriate
         headers: {
          // Include Authorization header if needed based on function/RLS setup
          'Authorization': `Bearer ${ (await supabase.auth.getSession()).data.session?.access_token }`, 
          'Content-Type': 'application/json' 
        }
      });

      if (!response.ok) {
         const errorBody = await response.text();
         throw new Error(`Failed to fetch Discord guilds (${response.status}): ${errorBody}`);
      }

      const data = await response.json();

      // Original invoke call - replaced by fetch
      // const { data, error } = await supabase.functions.invoke('discord-get-bot-guilds', {
      //   headers: {
      //     'agentId': id // This was incorrect
      //   }
      // });
      // if (error) throw new Error(error.message || 'Failed to fetch Discord guilds');
      
      console.log('Discord guilds fetched successfully:', data);
      setDiscordGuilds(data || []);
      
    } catch (err: any) {
      console.error('Discord guilds fetch error:', err);
      setError(err.message || 'Failed to fetch Discord guilds and channels');
    } finally {
      setFetchingGuilds(false);
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

      const { discord_connections, ...agentData } = formData;
      const agentSaveData = {
        ...agentData,
        user_id: user.id,
      };

      // Create or update the agent
      let agentId = id;
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('agents')
          .update(agentSaveData)
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { data, error: insertError } = await supabase
          .from('agents')
          .insert([agentSaveData])
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        
        if (data) {
          agentId = data.id;
          // Navigate to the edit page for the new agent
          navigate(`/agents/${data.id}`, { replace: true });
        }
      }

      // Only handle Discord connections if we have an agent ID
      if (agentId && discord_connections?.length) {
        // First, fetch existing connections
        const { data: existingConnections, error: fetchError } = await supabase
          .from('agent_discord_connections')
          .select('id, channel_id')
          .eq('agent_id', agentId);
        
        if (fetchError) throw new Error(fetchError.message);
        
        // Get the list of channel IDs we need to create
        const existingChannelIds = (existingConnections || []).map(conn => conn.channel_id);
        const selectedChannelIds = discord_connections.map(conn => conn.channelId);
        
        // Determine connections to create and delete
        const channelsToCreate = discord_connections.filter(
          conn => !existingChannelIds.includes(conn.channelId)
        );
        const connectionsToDelete = (existingConnections || []).filter(
          conn => !selectedChannelIds.includes(conn.channel_id)
        );
        
        // Create any new connections
        if (channelsToCreate.length > 0) {
          const newConnectionsData = channelsToCreate.map(conn => ({
            agent_id: agentId,
            guild_id: conn.guildId,
            channel_id: conn.channelId
          }));
          
          const { error: insertError } = await supabase
            .from('agent_discord_connections')
            .insert(newConnectionsData);
            
          if (insertError) throw new Error(insertError.message);
        }
        
        // Delete any removed connections
        if (connectionsToDelete.length > 0) {
          const idsToDelete = connectionsToDelete.map(conn => conn.id);
          
          const { error: deleteError } = await supabase
            .from('agent_discord_connections')
            .delete()
            .in('id', idsToDelete);
            
          if (deleteError) throw new Error(deleteError.message);
        }
      }

      setSaveSuccess(true);
    } catch (err) {
      console.error('Error saving agent:', err);
      setError('Failed to save agent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
    <div className="p-6 overflow-x-hidden">
      <div className="flex justify-between items-center mb-6">
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
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div className="space-y-4">
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

            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-200">Agent Instructions</h3>
              <p className="text-sm text-gray-400">
                Configure the agent's core behavior (System Instructions) and provide additional context or specific guidelines (Assistant Instructions) via the editors below.
              </p>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowSystemModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                >
                  <Edit className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                  Edit System Instructions
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssistantModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                >
                  <Edit className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                  Edit Assistant Instructions
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Discord Configuration</h2>
              
              <DiscordConnect
                agentId={id || ''}
                isConnected={Boolean(formData.discord_bot_token_encrypted)}
                connections={formData.discord_connections ?? []}
                onAddChannel={handleAddDiscordChannel}
                onRemoveChannel={handleRemoveDiscordChannel}
                onRemoveGuild={handleRemoveDiscordGuild}
                onDisconnectBot={handleDiscordDisconnectBot}
                onConnectSuccess={handleTempConnectSuccess}
                guilds={discordGuilds}
                loading={discordLoading}
                disconnecting={discordDisconnecting}
                fetchingGuilds={fetchingGuilds}
                onFetchGuilds={fetchDiscordGuilds}
                botToken={botToken}
                onBotTokenChange={(token: string) => setBotToken(token)}
              />
            </div>
            
            <AgentMcpSection 
              mcpServers={mcpServers}
              onAddServer={addMcpServer}
              onUpdateServer={updateMcpServer}
              onDeleteServer={deleteMcpServer}
              onTestConnection={testMcpConnection}
              loading={mcpLoading}
              error={mcpError}
            />
          </div>
        </div>
      </form>

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

      {showSystemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">System Instructions</h2>
              <button
                onClick={() => setShowSystemModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              Define the core behavior and capabilities of your AI agent. These instructions set the foundation for how the agent will interact and process information.
            </p>
            
            <div className="h-96 border border-gray-700 rounded-lg overflow-hidden mb-6">
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
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowSystemModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssistantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Assistant Instructions</h2>
              <button
                onClick={() => setShowAssistantModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              Specify additional context and instructions for the assistant, including any relevant information from datastores or specific behavioral guidelines.
            </p>
            
            <div className="h-96 border border-gray-700 rounded-lg overflow-hidden mb-6">
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
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowAssistantModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}