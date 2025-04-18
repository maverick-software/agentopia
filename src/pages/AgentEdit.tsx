import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check, ChevronDown, ChevronUp, Plus, Edit, Trash2, Loader2, CheckCircle, AlertTriangle, X, Server, Settings, Link as LinkIcon } from 'lucide-react';
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent as AgentType, Datastore, AgentDiscordConnection } from '../types';
import { DiscordConnect } from '../components/DiscordConnect';
import { useAgentMcp } from '../hooks/useAgentMcp';
import { AgentMcpSection } from '../components/AgentMcpSection';
import { useDebouncedCallback } from 'use-debounce';
import { GuildSelectionModal } from '../components/GuildSelectionModal';

interface BotGuild {
  id: string;
  name: string;
}

interface EnabledGuildStatus {
  guild_id: string;
  is_enabled: boolean;
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function AgentEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
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
    agent_id: id,
    inactivity_timeout_minutes: 10,
    worker_status: 'inactive',
    discord_app_id: '',
    discord_public_key: '',
  });
  const [discordBotKey, setDiscordBotKey] = useState('');

  const [discordLoading, setDiscordLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  
  const [allGuilds, setAllGuilds] = useState<BotGuild[]>([]);
  const [enabledGuilds, setEnabledGuilds] = useState<EnabledGuildStatus[]>([]);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [guildsLoading, setGuildsLoading] = useState(false);

  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

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

  const fetchBotGuilds = useCallback(async () => {
    if (!id) {
      console.error("Cannot fetch guilds: Agent ID is missing.");
      return;
    }
    console.log(`Fetching Discord guilds for agent ${id}...`);
    setGuildsLoading(true);
    setError(null); 
    try {
      const functionName = 'discord-get-bot-guilds';
      const queryParams = new URLSearchParams({ agentId: id });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Supabase URL VITE_SUPABASE_URL missing');
      const invokeUrl = `${supabaseUrl}/functions/v1/${functionName}?${queryParams.toString()}`;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('User not authenticated');

      const response = await fetch(invokeUrl, {
         method: 'GET',
         headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
         const errorBody = await response.text();
         let detail = `Status ${response.status}`; 
         try { detail = JSON.parse(errorBody).error || detail; } catch(e) {}
         throw new Error(`Failed to fetch Discord guilds: ${detail}`);
      }

      const data = await response.json();
      console.log('Discord guilds fetched successfully:', data?.length);
      setAllGuilds(data || []);
      
    } catch (err: any) {
      console.error('Discord guilds fetch error:', err);
      setError(`Error fetching Discord servers: ${err.message}. Ensure bot token is correct & saved, and bot is in servers.`); 
      setAllGuilds([]); 
    } finally {
      setGuildsLoading(false);
    }
  }, [id]);

  const fetchEnabledGuildStatus = useCallback(async () => {
    if (!id) return;
    console.log(`Fetching enabled guild status for agent ${id}...`);
    setGuildsLoading(true);
    try {
      const functionName = 'get-enabled-guilds';
      const queryParams = new URLSearchParams({ agentId: id });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Supabase URL VITE_SUPABASE_URL missing');
      const invokeUrl = `${supabaseUrl}/functions/v1/${functionName}?${queryParams.toString()}`;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('User not authenticated');

       const response = await fetch(invokeUrl, {
         method: 'GET',
         headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

       if (!response.ok) {
         const errorBody = await response.text();
         let detail = `Status ${response.status}`;
         try { detail = JSON.parse(errorBody).error || detail; } catch(e) {}
         throw new Error(`Failed to fetch enabled status: ${detail}`);
       }

      const data = await response.json();
      console.log('Enabled guild status fetched:', data?.length);
      setEnabledGuilds(data || []);
    } catch (err: any) {
      console.error('Enabled guilds fetch error:', err);
      setError(`Error fetching enabled server status: ${err.message}`);
      setEnabledGuilds([]);
    } finally {
      setGuildsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && discordBotKey) {
      fetchBotGuilds();
    }
  }, [id, discordBotKey, fetchBotGuilds]);

  useEffect(() => {
    if (id) {
      fetchEnabledGuildStatus();
    }
  }, [id, fetchEnabledGuildStatus]);
  
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
        .select('*, discord_bot_key')
        .eq('id', agentId)
        .eq('user_id', user.id)
        .single();

      console.log(`[fetchAgent] Received agent data from Supabase:`, agentData);

      if (agentError) throw new Error(agentError.message);
      if (!agentData) throw new Error('Agent not found or access denied');

      setAgentFormData({
        ...agentData,
        system_instructions: agentData.system_instructions || '',
        assistant_instructions: agentData.assistant_instructions || '',
        active: agentData.active,
      });
      setDiscordBotKey(agentData.discord_bot_key || '');

      // Fetch ALL connection records for the agent
      const { data: allConnections, error: connectionError } = await supabase
        .from('agent_discord_connections')
        .select('id, inactivity_timeout_minutes, worker_status, discord_app_id, discord_public_key')
        .eq('agent_id', agentId);

      console.log(`[fetchAgent] Received all connection records for ${agentId}:`, allConnections);

      if (connectionError) throw new Error(connectionError.message);

      // Determine representative status and details
      let representativeStatus: AgentDiscordConnection['worker_status'] = 'inactive';
      let representativeConnection: Partial<AgentDiscordConnection> | null = null;

      if (allConnections && allConnections.length > 0) {
        // Prioritize showing 'active' if any connection is active
        const activeConnection = allConnections.find(c => c.worker_status === 'active');
        if (activeConnection) {
          representativeStatus = 'active';
          representativeConnection = activeConnection;
          console.log(`[fetchAgent] Found active connection (ID: ${activeConnection.id})`);
        } else {
          // If none are active, check for 'activating'
          const activatingConnection = allConnections.find(c => c.worker_status === 'activating');
          if (activatingConnection) {
            representativeStatus = 'activating';
            representativeConnection = activatingConnection;
            console.log(`[fetchAgent] Found activating connection (ID: ${activatingConnection.id})`);
          } else {
             // If none active/activating, check for 'stopping'
            const stoppingConnection = allConnections.find(c => c.worker_status === 'stopping');
            if (stoppingConnection) {
                representativeStatus = 'stopping';
                representativeConnection = stoppingConnection;
                console.log(`[fetchAgent] Found stopping connection (ID: ${stoppingConnection.id})`);
            } else {
                // If none active/activating/stopping, check for 'error'
                 const errorConnection = allConnections.find(c => c.worker_status === 'error');
                 if (errorConnection) {
                    representativeStatus = 'error';
                    representativeConnection = errorConnection;
                    console.log(`[fetchAgent] Found error connection (ID: ${errorConnection.id})`);
                 } else {
                    // Otherwise, use the first record found as representative for details (status is inactive)
                    representativeConnection = allConnections[0];
                    representativeStatus = representativeConnection.worker_status || 'inactive'; // Default to inactive
                    console.log(`[fetchAgent] No active/activating/stopping/error connections. Using first record (ID: ${representativeConnection.id}) status: ${representativeStatus}`);
                 }
            }
          }
        }

        // Set state based on the representative connection found (or the first one)
        setDiscordConnectionData({
          id: representativeConnection.id, // Store the ID of the connection we used for status/details
          agent_id: agentId,
          inactivity_timeout_minutes: representativeConnection.inactivity_timeout_minutes ?? 10,
          worker_status: representativeStatus, // Use the derived representative status
          discord_app_id: representativeConnection.discord_app_id || '',
          discord_public_key: representativeConnection.discord_public_key || '',
        });

      } else {
        // No connection records found, set defaults
        console.log(`[fetchAgent] No connection records found for agent ${agentId}. Setting defaults.`);
        setDiscordConnectionData({
          id: undefined,
          agent_id: agentId,
          inactivity_timeout_minutes: 10,
          worker_status: 'inactive',
          discord_app_id: '',
          discord_public_key: '',
        });
      }

      const { data: agentDatastores, error: dsError } = await supabase
        .from('agent_datastores')
        .select('datastore_id, datastores(type)')
        .eq('agent_id', agentId);
      
      if (dsError) throw dsError;

      const initialSelected: { vector?: string; knowledge?: string } = {};
      agentDatastores?.forEach(ad => {
          if (ad.datastores && Array.isArray(ad.datastores)) {
             const ds = ad.datastores[0];
             if (ds && ds.type === 'vector') {
                 initialSelected.vector = ad.datastore_id;
             }
             if (ds && ds.type === 'knowledge') {
                 initialSelected.knowledge = ad.datastore_id;
             }
          }
      });
      setSelectedDatastores(initialSelected);
      console.log(`[fetchAgent] Fetched selected datastores for ${agentId}.`);

      fetchAgentAttempts.current = 0;
      setLoading(false);

    } catch (err: any) {
      console.error(`[fetchAgent] Error fetching agent ${agentId} (Attempt ${currentAttempt}): ${err.message}`, { error: err });
      fetchAgentAttempts.current = currentAttempt;
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        setTimeout(() => fetchAgent(agentId), 1000 * currentAttempt);
      } else {
      setError(`Failed to load agent data: ${err.message}`);
      setLoading(false);
    }
    }
  }, [user?.id]);

  const fetchDatastores = useCallback(async () => {
    if (!user?.id) return;

    let currentAttempt = fetchDatastoresAttempts.current + 1;
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

    } catch (err: any) {
      console.error('Error fetching datastores list:', err);
      if (currentAttempt < MAX_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchDatastores(), delay);
        setError(`Failed to load datastore list. Retrying... (${currentAttempt}/${MAX_FETCH_ATTEMPTS})`);
      } else {
        setError(`Failed to load datastore list after ${MAX_FETCH_ATTEMPTS} attempts.`);
        console.error('Max fetch attempts reached for datastore list after error.');
        setLoadingDatastores(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (isEditing && id) {
      fetchAgent(id);
      fetchDatastores(); 
    } else {
      setAgentFormData({ name: '', description: '', personality: '', system_instructions: '', assistant_instructions: '', active: true });
      setDiscordConnectionData({ inactivity_timeout_minutes: 10, worker_status: 'inactive', discord_app_id: '', discord_public_key: '' });
      setDiscordBotKey('');
      setSelectedDatastores({});
      setAllGuilds([]);
      setEnabledGuilds([]);
    }
  }, [id, isEditing, fetchAgent, fetchDatastores]);

  const handleAgentFormChange = (field: keyof AgentType, value: any) => {
    setAgentFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConnectionChange = (field: keyof AgentDiscordConnection, value: any) => {
    let processedValue = value;
    if (field === 'inactivity_timeout_minutes') {
      processedValue = parseInt(value, 10) || 0;
    }
    setDiscordConnectionData(prev => ({ ...prev, [field]: processedValue }));
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

  const handleOpenGuildModal = () => {
    fetchBotGuilds(); 
    fetchEnabledGuildStatus();
    setIsGuildModalOpen(true);
  };

  const handleCloseGuildModal = () => {
    setIsGuildModalOpen(false);
  };

  const handleSaveEnabledGuilds = async (updatedEnabledList: EnabledGuildStatus[]) => {
    if (!id) return;
    console.log(`Saving enabled guilds for agent ${id}...`);
    setGuildsLoading(true);
      setError(null);
    try {
       const payloadList = updatedEnabledList.map(g => ({
           ...g,
           discord_app_id: discordConnectionData.discord_app_id || '',
           discord_public_key: discordConnectionData.discord_public_key || '',
           inactivity_timeout_minutes: discordConnectionData.inactivity_timeout_minutes ?? 10, 
       }));

      const { error: invokeError } = await supabase.functions.invoke('update-enabled-guilds', {
        body: {
          agentId: id,
          enabledGuilds: payloadList
        }
      });
      if (invokeError) throw invokeError;

      console.log(`Enabled guilds saved successfully for agent ${id}.`);
      setEnabledGuilds(updatedEnabledList);
      handleCloseGuildModal();

    } catch (err: any) {
      console.error(`Error saving enabled guilds for agent ${id}: ${err.message}`, { error: err });
      setError(`Failed to save server enablement status: ${err.message}`);
    } finally {
      setGuildsLoading(false);
    }
  };

  const handleGenerateInviteLink = () => {
    if (!discordConnectionData.discord_app_id) {
      setError('Discord Application ID is required to generate an invite link.');
          return;
      }
    console.log(`Generating invite link for App ID: ${discordConnectionData.discord_app_id}`);
    setIsGeneratingInvite(true);
      setError(null); 
    
    const appId = discordConnectionData.discord_app_id;
    const permissions = 274877975552;
    const scopes = 'bot applications.commands';
    
    const url = `https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=${permissions}&scope=${scopes.replace(/ /g, '%20')}`;
    
    window.open(url, '_blank');
    
    setTimeout(() => setIsGeneratingInvite(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    console.log(`Form submitted. ${isEditing ? 'Updating' : 'Creating'} agent...`);

    // Use setTimeout to ensure state is fully updated before proceeding
    setTimeout(async () => {
      try {
        const agentPayload: Partial<AgentType> & { user_id: string } = {
      name: agentFormData.name,
      description: agentFormData.description,
      personality: agentFormData.personality,
      system_instructions: agentFormData.system_instructions,
      assistant_instructions: agentFormData.assistant_instructions,
      active: agentFormData.active,
          user_id: user.id,
          discord_bot_key: discordBotKey || undefined,
        };

        const connectionPayload: Partial<AgentDiscordConnection> = {
          discord_app_id: discordConnectionData.discord_app_id,
          discord_public_key: discordConnectionData.discord_public_key,
          inactivity_timeout_minutes: discordConnectionData.inactivity_timeout_minutes,
        };
          
      let agentId = id;
      if (isEditing && agentId) {
          console.log(`Updating agent ${agentId}`);
          const { error: updateAgentError } = await supabase
          .from('agents')
            .update(agentPayload)
            .eq('id', agentId);
          if (updateAgentError) throw updateAgentError;
          console.log(`Agent ${agentId} updated successfully.`);

          if (discordConnectionData.id) {
            console.log(`Updating connection record ${discordConnectionData.id}`);
            const { error: updateConnectionError } = await supabase
              .from('agent_discord_connections')
              .update(connectionPayload)
              .eq('id', discordConnectionData.id);
            if (updateConnectionError) {
              console.warn(`Failed to update main connection record ${discordConnectionData.id}: ${updateConnectionError.message}`);
            }
      } else {
            console.warn(`No existing connection record ID found for agent ${agentId} to update main settings.`);
          }
        } else {
          console.log('Creating new agent');
          const { data: newAgent, error: createAgentError } = await supabase
          .from('agents')
            .insert(agentPayload)
            .select()
          .single();
          if (createAgentError) throw createAgentError;
          if (!newAgent) throw new Error('Failed to create agent.');
        agentId = newAgent.id;
          console.log(`Agent created successfully with ID: ${agentId}.`);
          
          const initialConnectionPayload = {
            ...connectionPayload,
            agent_id: agentId,
            worker_status: 'inactive',
            guild_id: null
          };
          console.log(`Creating initial connection record for agent ${agentId}`);
          const { error: createConnectionError } = await supabase
            .from('agent_discord_connections')
            .insert(initialConnectionPayload);
          if (createConnectionError) {
            console.warn(`Failed to create initial connection record for agent ${agentId}: ${createConnectionError.message}`);
          }

          navigate(`/agent/${agentId}`);
        }

        await handleConnectDatastores(); 
      
      setSaveSuccess(true);
        console.log(`Agent ${isEditing ? 'update' : 'create'} process completed successfully for ID: ${agentId}`);
    } catch (err: any) {
        console.error(`Error saving agent: ${err.message}`, { error: err });
        setError(`Failed to save agent: ${err.message}`);
    } finally {
      setSaving(false);
    }
    }, 100); // Small delay to ensure state synchronization
  };

  const handleActivateAgent = async () => {
    if (!id || !discordConnectionData.id) {
      setError('Agent or Connection ID is missing, cannot activate.');
      return;
    }
    if (!discordConnectionData.discord_app_id || !discordConnectionData.discord_public_key || !discordBotKey) {
        setError('Discord credentials (App ID, Public Key, Bot Token) must be saved before activating.');
        return;
    }
    if (!enabledGuilds.some(g => g.is_enabled)) {
        setError('No servers are enabled for this agent. Please enable at least one server in "Manage Servers" before activating.');
      return;
    }
    
    console.log(`Activating agent ${id}...`);
    setIsActivating(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
        body: { 
          action: 'start',
          agentId: id,
          connectionDbId: discordConnectionData.id,
          botToken: discordBotKey,
          inactivityTimeout: discordConnectionData.inactivity_timeout_minutes,
          agentName: agentFormData.name,
          systemPrompt: agentFormData.system_instructions,
          agentInstructions: agentFormData.assistant_instructions,
        }
      });
      if (invokeError) throw invokeError;
  
      console.log(`Agent ${id} activation request sent successfully.`);
      setDiscordConnectionData(prev => ({ ...prev, worker_status: 'activating' })); 

      // Add a delay then refetch agent status to update UI
      setTimeout(() => {
        if (id) {
          console.log('Refetching agent status after activation attempt...');
          fetchAgent(id);
        }
      }, 5000); // Refetch after 5 seconds
      
    } catch (err: any) {
      console.error(`Error activating agent ${id}: ${err.message}`, { error: err });
      setError(`Activation failed: ${err.message}`);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivateAgent = async () => {
    if (!id || !discordConnectionData.id) {
      setError('Agent or Connection ID is missing, cannot deactivate.');
      return;
    }
    console.log(`Deactivating agent ${id}...`);
    setIsDeactivating(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
        body: { 
          action: 'stop',
          agentId: id,
          connectionDbId: discordConnectionData.id
        }
      });
      if (invokeError) throw invokeError;
  
      console.log(`Agent ${id} deactivation request sent successfully.`);
      setDiscordConnectionData(prev => ({ ...prev, worker_status: 'stopping' }));

      // Add a delay then refetch agent status to update UI
      setTimeout(() => {
        if (id) {
          console.log('Refetching agent status after deactivation attempt...');
          fetchAgent(id);
        }
      }, 5000); // Refetch after 5 seconds
      
    } catch (err: any) {
      console.error(`Error deactivating agent ${id}: ${err.message}`, { error: err });
      setError(`Deactivation failed: ${err.message}`);
    } finally {
      setIsDeactivating(false);
    }
  };

  const generateInteractionEndpointUrl = (): string => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${supabaseUrl}/functions/v1/discord-interaction-handler`;
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

  const interactionEndpointUrl = generateInteractionEndpointUrl();

  const isFullyConnected = !!(discordBotKey && discordConnectionData.discord_app_id && discordConnectionData.discord_public_key);

  const selectedGuildName = allGuilds.find(g => g.id === discordConnectionData.guild_id)?.name;

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
                  connection={discordConnectionData}
                  botKey={discordBotKey}
                  onBotKeyChange={setDiscordBotKey}
                  onConnectionChange={handleConnectionChange}
                  discord_app_id={discordConnectionData.discord_app_id}
                  onManageServers={handleOpenGuildModal}
                  onGenerateInviteLink={handleGenerateInviteLink}
                  isGeneratingInvite={isGeneratingInvite}
                  workerStatus={discordConnectionData.worker_status}
                  onActivate={handleActivateAgent}
                  onDeactivate={handleDeactivateAgent}
                  isActivating={isActivating}
                  isDeactivating={isDeactivating}
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

      {isGuildModalOpen && (
          <GuildSelectionModal
              isOpen={isGuildModalOpen}
              onClose={handleCloseGuildModal}
              onSave={handleSaveEnabledGuilds}
              allGuilds={allGuilds}
              enabledGuilds={enabledGuilds}
              loading={guildsLoading}
              isSaving={guildsLoading}
          />
      )}
    </div>
  );
}