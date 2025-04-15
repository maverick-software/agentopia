import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check, ChevronDown, ChevronUp, Plus, Edit, Trash2, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent as AgentType, Datastore, AgentDiscordConnection } from '../types';
import { DiscordConnect } from '../components/DiscordConnect';
import { useAgentMcp } from '../hooks/useAgentMcp';
import { AgentMcpSection } from '../components/AgentMcpSection';
import { useDebouncedCallback } from 'use-debounce';

interface DiscordConnection {
  guildId: string;
  channelId: string;
  guildName?: string;
  channelName?: string;
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

// Helper function for Base64URL encoding (browser compatible)
function bytesToBase64Url(bytes: Uint8Array): string {
  // Convert bytes to string, handling potential character code issues
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use btoa for standard Base64
  const base64 = btoa(binary);
  // Convert to Base64URL
  return base64
    .replace(/\+/g, '-') // Replace + with -
    .replace(/\//g, '_') // Replace / with _
    .replace(/=/g, '');   // Remove padding
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

  const [agentFormData, setAgentFormData] = useState<Partial<AgentType>>({
    name: '',
    description: '',
    personality: '',
    system_instructions: '',
    assistant_instructions: '',
    active: true,
  });

  const [discordConnectionData, setDiscordConnectionData] = useState<Partial<AgentDiscordConnection>>({
    id: undefined,
    agent_id: undefined,
    guild_id: undefined,
    inactivity_timeout_minutes: 10,
    worker_status: 'inactive',
    discord_app_id: '',
    discord_public_key: '',
    interaction_secret: undefined
  });
  const [discordBotKey, setDiscordBotKey] = useState('');

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

  // Comment out the entire function for now to stop guild fetching
  /*
  const fetchDiscordGuildsLogic = async () => {
    if (!id) return;
    
    setFetchingGuilds(true);
    try {
      const functionName = 'discord-get-bot-guilds';
      const queryParams = new URLSearchParams({ agentId: id });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Supabase URL not configured in environment variables.');
      const invokeUrl = `${supabaseUrl}/functions/v1/${functionName}?${queryParams.toString()}`;

      const response = await fetch(invokeUrl, {
         method: 'GET',
         headers: {
          'Authorization': `Bearer ${ (await supabase.auth.getSession()).data.session?.access_token }`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
         const errorBody = await response.text();
         throw new Error(`Failed to fetch Discord guilds (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      console.log('Discord guilds fetched successfully (debounced):', data);
      setDiscordGuilds(data || []);
      
    } catch (err: any) {
      console.error('Discord guilds fetch error (debounced):', err);
      if (err.message.includes('Failed to fetch Discord guilds')) {
        setError(err.message || 'Failed to fetch Discord guilds and channels');
      } else {
        console.error('Non-guild-fetch error during debounced fetch:', err);
      }
    } finally {
      setFetchingGuilds(false);
    }
  };
  */
  // Replace with a dummy function
  const fetchDiscordGuildsLogic = async () => { 
      console.log("Guild fetching currently disabled for debugging."); 
      return Promise.resolve(); 
  };

  // Debounced version also uses the dummy function
  const debouncedFetchDiscordGuilds = useDebouncedCallback(fetchDiscordGuildsLogic, 2000);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (saveSuccess) {
      timeout = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  const fetchAgent = useCallback(async (agentId: string) => {
    if (!user?.id) return;

    let currentAttempt = fetchAgentAttempts.current + 1;
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

      console.log('[fetchAgent] Received agent data from Supabase:', agentData);

      if (agentError) throw new Error(agentError.message);
      if (!agentData) throw new Error('Agent not found or access denied');

      setAgentFormData({
        ...agentData,
        system_instructions: agentData.system_instructions || '',
        assistant_instructions: agentData.assistant_instructions || '',
        active: agentData.active,
      });
      setDiscordBotKey(agentData.discord_bot_key || '');

      const { data: connectionData, error: connectionError } = await supabase
        .from('agent_discord_connections')
        .select('id, guild_id, inactivity_timeout_minutes, worker_status, discord_app_id, discord_public_key, interaction_secret')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (connectionError) throw new Error(connectionError.message);

      if (connectionData) {
        setDiscordConnectionData({
          id: connectionData.id,
          agent_id: agentId,
          guild_id: connectionData.guild_id,
          inactivity_timeout_minutes: connectionData.inactivity_timeout_minutes || 10,
          worker_status: connectionData.worker_status || 'inactive',
          discord_app_id: connectionData.discord_app_id || '',
          discord_public_key: connectionData.discord_public_key || '',
          interaction_secret: connectionData.interaction_secret || undefined
        });
      } else {
        setDiscordConnectionData({
          id: undefined,
          agent_id: agentId,
          guild_id: undefined,
          inactivity_timeout_minutes: 10,
          worker_status: 'inactive',
          discord_app_id: '',
          discord_public_key: '',
          interaction_secret: undefined
        });
      }

      setLoading(false);

    } catch (err: any) {
      console.error('Error fetching agent or connection:', err);
      setError(`Failed to load agent data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get stable user ID for the effect dependency
  const userId = user?.id;

  useEffect(() => {
    console.log("[AgentEdit] useEffect for fetchAgent running. Dependencies:", { id, isEditing, userId });
    // Use userId in the check as well
    if (isEditing && id && userId) { 
      fetchAgentAttempts.current = 0;
      fetchAgent(id);
    }
    // Use stable userId in dependency array instead of the whole user object
  }, [id, isEditing, userId]);

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
    disconnectDiscordBot();
  };

  const handleTempConnectSuccess = (token: string) => {
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

  const connectDiscordBot = async (token: string) => {
    if (!id || !token.trim()) {
      setError('Agent ID and bot token are required');
      return;
    }

    setDiscordLoading(true);
    setError(null);
    try {
      console.log(`Invoking function to update token for agent ${id}`);
      const { data: fnResponse, error: fnError } = await supabase.functions.invoke(
        'update-agent-discord-token',
        { body: { agentId: id, token: token.trim() } }
      );

      if (fnError) throw fnError;
      console.log('Function response:', fnResponse);

      setDiscordBotKey(token.trim());

    } catch (err: any) {
      console.error("Error connecting bot (calling function):", err);
      let detailedMessage = err.message;
      if (err.context?.error_details) {
          detailedMessage = `${err.message} - ${err.context.error_details}`;
      } else if (err.details) {
          detailedMessage = `${err.message} - ${err.details}`;
      }
      setError(`Failed to save bot token: ${detailedMessage}`);
    } finally {
      setDiscordLoading(false);
    }
  };

  const disconnectDiscordBot = async () => {
    if (!id) return;
    
    setDiscordDisconnecting(true);
    setError(null);
    
    try {
      console.log(`Invoking function to clear token for agent ${id}`);
      const { data: fnResponse, error: fnError } = await supabase.functions.invoke(
        'update-agent-discord-token', 
        { body: { agentId: id, token: null } }
      );
      if (fnError) throw fnError;
      console.log('Function response (disconnect):', fnResponse);

      console.log(`Attempting to delete discord connection details for agent: ${id}`);
      const { error: delError } = await supabase
        .from('agent_discord_connections')
        .delete()
        .eq('agent_id', id);
      if (delError) { 
        console.error("Error deleting connection details from DB:", delError);
        setError(prev => prev ? `${prev}\nFailed to delete connection details.` : 'Failed to delete connection details.');
      }

    } catch (err: any) {
      console.error("Error during disconnect (calling function or deleting connection):", err);
       let detailedMessage = err.message;
       if (err.context?.error_details) {
           detailedMessage = `${err.message} - ${err.context.error_details}`;
       } else if (err.details) {
           detailedMessage = `${err.message} - ${err.details}`;
       }
       setError(prev => prev ? `${prev}\nError updating token: ${detailedMessage}` : `Error updating token: ${detailedMessage}`);
    } finally {
       console.log("Re-fetching agent data after disconnect attempt...");
       if (id) { 
         await fetchAgent(id);
       } else {
          console.warn("Agent ID missing, clearing state manually.");
          setDiscordBotKey('');
          setDiscordGuilds([]);
          setDiscordConnectionData(prev => ({
            id: undefined, agent_id: undefined, guild_id: undefined,
            inactivity_timeout_minutes: 10, worker_status: 'inactive'
          }));
       }
       setDiscordDisconnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    const agentUpdateData: Partial<AgentType> = {
      name: agentFormData.name,
      description: agentFormData.description,
      personality: agentFormData.personality,
      system_instructions: agentFormData.system_instructions,
      assistant_instructions: agentFormData.assistant_instructions,
      active: agentFormData.active,
    };

    const connectionUpdateData: Partial<AgentDiscordConnection> = {
      agent_id: id,
      guild_id: discordConnectionData.guild_id,
      inactivity_timeout_minutes: discordConnectionData.inactivity_timeout_minutes,
      discord_app_id: discordConnectionData.discord_app_id,
      discord_public_key: discordConnectionData.discord_public_key,
      interaction_secret: discordConnectionData.interaction_secret
    };

    try {
      let agentId = id;

      if (isEditing && agentId) {
        const { error: agentSaveError } = await supabase
          .from('agents')
          .update(agentUpdateData)
          .eq('id', agentId)
          .eq('user_id', user.id);
        if (agentSaveError) throw new Error(`Agent save error: ${agentSaveError.message}`);
      } else {
        const { data: newAgent, error: agentCreateError } = await supabase
          .from('agents')
          .insert({ ...agentUpdateData, user_id: user.id })
          .select('id')
          .single();
        if (agentCreateError) throw new Error(`Agent create error: ${agentCreateError.message}`);
        if (!newAgent?.id) throw new Error('Failed to get ID for new agent.');
        agentId = newAgent.id;
      }

      if (!agentId) {
          throw new Error("Agent ID is missing after save/create.");
      }
      connectionUpdateData.agent_id = agentId;

      // 2. Save/Update Discord Connection Details
      
      // --- Add Logging --- 
      console.log("[handleSubmit] Checking connectionUpdateData before upsert condition:", connectionUpdateData);
      // --- End Logging ---
      
      // This condition checks if the necessary fields are present
      if (connectionUpdateData.agent_id 
          && connectionUpdateData.discord_app_id 
          && connectionUpdateData.discord_public_key) { 
           console.log("Preparing Discord connection details for upsert:", connectionUpdateData);

           // --- Generate Interaction Secret using Web Crypto API --- 
           let secretToSave: string | undefined = discordConnectionData.interaction_secret;
           if (!secretToSave) {
               console.log("Generating new interaction secret using Web Crypto...");
               const randomBytes = new Uint8Array(32);
               window.crypto.getRandomValues(randomBytes); // Use window.crypto
               secretToSave = bytesToBase64Url(randomBytes); // Encode as base64url
               console.log("Generated Secret (first 10 chars):", secretToSave.substring(0, 10));
           }
           // --- End Secret Generation ---

           const upsertData = {
               agent_id: connectionUpdateData.agent_id,
               guild_id: connectionUpdateData.guild_id || null, // Ensure null if undefined
               channel_id: connectionUpdateData.channel_id || null, // <<< Ensure null if undefined
               inactivity_timeout_minutes: connectionUpdateData.inactivity_timeout_minutes,
               discord_app_id: connectionUpdateData.discord_app_id,
               discord_public_key: connectionUpdateData.discord_public_key,
               interaction_secret: secretToSave // Add the secret to the upsert data (WBS 5.4)
           };

           console.log("Upserting data:", upsertData);
           
           const { error: connectionSaveError } = await supabase
             .from('agent_discord_connections')
             .upsert(upsertData, { 
                onConflict: 'agent_id', // Assumes one connection per agent 
                // ignoreDuplicates: false // Default is false, ensures update happens
             }); 

           if (connectionSaveError) throw new Error(`Discord connection save error: ${connectionSaveError.message}`);
           
           // --- Update local state with the saved secret if it was newly generated ---
           // Important for displaying the correct URL immediately after save
           if (secretToSave && secretToSave !== discordConnectionData.interaction_secret) {
               setDiscordConnectionData(prev => ({...prev, interaction_secret: secretToSave}));
           }
           // --- End state update ---
           
      } else {
           console.warn("Skipping Discord connection upsert: Missing agent_id, App ID, or Public Key.");
      }

      const appId = connectionUpdateData.discord_app_id;
      const botKey = discordBotKey;
      
      if (agentId && appId && botKey) { 
         console.log(`Attempting to trigger command registration for agent: ${agentId}`);
         try {
           const { data: fnResponse, error: fnError } = await supabase.functions.invoke(
             'register-agent-commands', 
             { body: { agentId: agentId } }
           );

           if (fnError) {
             console.error('Error invoking register-agent-commands function:', fnError);
             setError(prev => prev ? `${prev}\nFailed to register Discord commands: ${fnError.message}` : `Failed to register Discord commands: ${fnError.message}`);
           } else {
             console.log('Successfully invoked register-agent-commands:', fnResponse);
           }
         } catch (invokeErr: unknown) {
           console.error('Caught error during function invocation:', invokeErr);
           const message = invokeErr instanceof Error ? invokeErr.message : String(invokeErr);
           setError(prev => prev ? `${prev}\nError registering Discord commands: ${message}` : `Error registering Discord commands: ${message}`);
         }
      } else {
        console.warn("Skipping command registration: Missing agentId, App ID, or Bot Token.");
      }
      
      setSaveSuccess(true);
      if (!isEditing && agentId) {
        navigate(`/agents/${agentId}/edit`);
      } else if (agentId) {
        fetchAgent(agentId);
      }

    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save agent data');
    } finally {
      setSaving(false);
    }
  };

  // --- Handlers for DiscordConnect ---

  const handleDiscordConnectionChange = (field: keyof AgentDiscordConnection, value: any) => {
      console.log(`[AgentEdit] handleDiscordConnectionChange: field=${String(field)}, value=${value}`);
      if (field === 'inactivity_timeout_minutes') {
          value = parseInt(value, 10) || 10;
      }
      setDiscordConnectionData(prev => ({ ...prev, [field]: value }));
  };

  const handleDiscordBotKeyChange = useCallback((token: string) => {
    setDiscordBotKey(token);
  }, []);

  // Define a dummy handler if DiscordConnect requires the prop (now optional)
  const handleAgentDetailChangeDummy = useCallback(() => { /* No-op */ }, []);

  // --- Handler for Regenerating Secret ---
  const handleRegenerateSecret = async () => {
    if (!id || !discordConnectionData.id) { // Need agent ID and connection ID
      setError("Cannot regenerate secret: Agent or connection details missing.");
      return;
    }
    
    setSaving(true); // Reuse saving state for loading indicator
    setError(null);
    
    try {
      // 1. Generate new secret
      console.log("Regenerating interaction secret using Web Crypto...");
      const randomBytes = new Uint8Array(32);
      window.crypto.getRandomValues(randomBytes);
      const newSecret = bytesToBase64Url(randomBytes);
      console.log("New Secret (first 10 chars):", newSecret.substring(0, 10));

      // 2. Update database
      const { error: updateError } = await supabase
        .from('agent_discord_connections')
        .update({ interaction_secret: newSecret })
        .eq('id', discordConnectionData.id) // Update by connection primary key
        .eq('agent_id', id); // Extra check for safety, RLS should handle ownership

      if (updateError) {
        throw updateError;
      }

      // 3. Update local state
      setDiscordConnectionData(prev => ({ ...prev, interaction_secret: newSecret }));
      console.log("Successfully regenerated and saved new secret.");
      // Optionally show a temporary success message?

    } catch (err: any) {
      console.error("Error regenerating secret:", err);
      setError(`Failed to regenerate secret: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  // --- End Handler ---

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

  const generateInteractionEndpointUrl = (secret?: string): string => {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`;
      return secret ? `${baseUrl}/${secret}` : baseUrl; 
  };
  const interactionEndpointUrl = generateInteractionEndpointUrl(discordConnectionData.interaction_secret);

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
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
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
                  value={agentFormData.description}
                  onChange={(e) => setAgentFormData({ ...agentFormData, description: e.target.value })}
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
                  value={agentFormData.personality}
                  onChange={(e) => setAgentFormData({ ...agentFormData, personality: e.target.value })}
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
            {id ? (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Discord Configuration</h2>
                
                <DiscordConnect
                  agentId={id || ''}
                  isConnected={!!discordBotKey}
                  discordAppId={discordConnectionData.discord_app_id || ''}
                  discordPublicKey={discordConnectionData.discord_public_key || ''}
                  connection={discordConnectionData}
                  onConnectionChange={handleDiscordConnectionChange}
                  onAgentDetailChange={handleAgentDetailChangeDummy}
                  interactionEndpointUrl={interactionEndpointUrl}
                  onConnect={connectDiscordBot}
                  onDisconnect={disconnectDiscordBot}
                  loading={discordLoading}
                  disconnecting={discordDisconnecting}
                  fetchingGuilds={fetchingGuilds}
                  onRegenerateSecret={handleRegenerateSecret}
                  className="mt-4"
                />
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <h2 className="text-xl font-semibold mb-4 text-gray-500">Discord Configuration</h2>
                <p className="text-gray-400 mt-4">
                  Please save the agent before configuring the Discord connection.
                </p>
              </div>
            )}
            
            {id ? (
              <AgentMcpSection 
                mcpServers={mcpServers}
                onAddServer={addMcpServer}
                onUpdateServer={updateMcpServer}
                onDeleteServer={deleteMcpServer}
                onTestConnection={testMcpConnection}
                loading={mcpLoading}
                error={mcpError}
              />
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                 <h2 className="text-xl font-semibold mb-4 text-gray-500">Multi-Compute Protocol (MCP)</h2>
                 <p className="text-gray-400 mt-4">
                    Please save the agent before configuring MCP servers.
                 </p>
              </div>
            )}
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
                    Vector Datastore
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
                      .filter(ds => ds.type === 'vector')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Knowledge Graph
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
                      .filter(ds => ds.type === 'knowledge')
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
                value={agentFormData.system_instructions}
                onChange={(value) => setAgentFormData({ ...agentFormData, system_instructions: value })}
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
                value={agentFormData.assistant_instructions}
                onChange={(value) => setAgentFormData({ ...agentFormData, assistant_instructions: value })}
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