import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check, ChevronDown, ChevronUp, Plus, Edit, Trash2, Loader2, CheckCircle, AlertTriangle, X, Server, Settings, Link as LinkIcon, Bot } from 'lucide-react';
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent as AgentType, Datastore, AgentDiscordConnection } from '../types';
import { DiscordConnect, DiscordStatusToggle } from '../components/DiscordConnect';
import { useAgentMcp } from '../hooks/useAgentMcp';
import { AgentMcpSection } from '../components/AgentMcpSection';
import { useDebouncedCallback } from 'use-debounce';
import { FaDiscord } from 'react-icons/fa';

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

export function AgentEditPage() {
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

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef(0);

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
      let userErrorMessage = `Error fetching Discord servers: ${err.message}.`;
      if (err.message.includes('Too Many Requests') || err.message.includes('429')) {
        userErrorMessage += ' Discord API rate limit hit. Please wait a minute and try refreshing the server list (if available) or the page.';
      } else {
         userErrorMessage += ' Ensure bot token is correct & saved, and bot is in servers.';
      }
      setError(userErrorMessage); 
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
    if (id && discordBotKey && allGuilds.length === 0) { 
      fetchBotGuilds();
    }
  }, [id, discordBotKey, fetchBotGuilds, allGuilds.length]);

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
        .select('id, guild_id, inactivity_timeout_minutes, worker_status, discord_app_id, discord_public_key')
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
          guild_id: representativeConnection.guild_id ?? undefined,
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

      // Ensure polling is stopped if agent is fetched manually
      if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          pollAttemptsRef.current = 0;
          console.log("[fetchAgent] Cleared any active worker status polling.");
      }

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

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log("[Unmount] Cleared worker status polling interval.");
      }
    };
  }, []);

  const handleAgentFormChange = useCallback((field: keyof AgentType, value: any) => {
    setAgentFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleConnectionChange = useCallback((
    field: keyof Omit<AgentDiscordConnection, 'guild_id'> | 'guild_id', // Explicitly add guild_id
    value: any
  ) => {
    let processedValue = value;
    // Find the actual DB column name if it differs from 'guild_id' in the state
    // Assuming the state directly uses 'guild_id' based on previous analysis
    const stateField = field as keyof AgentDiscordConnection;

    if (stateField === 'inactivity_timeout_minutes') {
      processedValue = parseInt(value, 10) || 0;
    }
    // Update the state, including the potentially new guild_id field
    setDiscordConnectionData(prev => ({ ...prev, [stateField]: processedValue }));
  }, []);

  const handleConnectDatastores = useCallback(async () => {
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
  }, [id, selectedDatastores.knowledge, selectedDatastores.vector]);

  const handleGenerateInviteLink = useCallback(() => {
    if (!discordConnectionData.discord_app_id) {
      setError("Discord Application ID is missing. Please save it first.");
        return;
    }
    setIsGeneratingInvite(true);
    const permissions = '277025400896';
    const scope = 'bot%20applications.commands';
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${discordConnectionData.discord_app_id}&permissions=${permissions}&scope=${scope}`;
    
    navigator.clipboard.writeText(inviteLink).then(() => {
      console.log('Invite link copied to clipboard:', inviteLink);
      setTimeout(() => setIsGeneratingInvite(false), 1500);
    }).catch(err => {
      console.error('Failed to copy invite link:', err);
      setError("Failed to copy invite link to clipboard.");
      setIsGeneratingInvite(false);
    });
  }, [discordConnectionData.discord_app_id]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    console.log(`Form submitted. ${isEditing ? 'Updating' : 'Creating'} agent...`);

    // Get the selected guild_id from state
    const selectedGuildId = discordConnectionData.guild_id; 

    // Define timeout function here to use selectedGuildId
    const saveOperation = async () => {
      try {
        const agentPayload: Partial<AgentType> & { user_id: string; discord_bot_key?: string } = {
          ...agentFormData,
          user_id: user.id,
        };
        if (discordBotKey) {
          agentPayload.discord_bot_key = discordBotKey;
        }

        let savedAgentId = id;
        if (isEditing && savedAgentId) {
          // Update Agent
          console.log("[handleSubmit] Updating agent:", savedAgentId, agentPayload);
          const { error: updateAgentError } = await supabase
            .from('agents')
            .update(agentPayload)
            .eq('id', savedAgentId);
          if (updateAgentError) throw new Error(`Agent update failed: ${updateAgentError.message}`);
          console.log("[handleSubmit] Agent updated successfully.");

        } else {
          // Create Agent
          console.log("[handleSubmit] Creating new agent:", agentPayload);
          const { data: newAgent, error: createAgentError } = await supabase
            .from('agents')
            .insert(agentPayload)
            .select('id')
            .single();
          if (createAgentError) throw new Error(`Agent creation failed: ${createAgentError.message}`);
          if (!newAgent?.id) throw new Error('Failed to get new agent ID after creation.');
          savedAgentId = newAgent.id;
          console.log("[handleSubmit] Agent created successfully with ID:", savedAgentId);
          // Navigate to edit page after creation
          navigate(`/agents/${savedAgentId}`, { replace: true }); 
        }

        // --- Upsert Discord Connection --- 
        const connectionPayload: Partial<AgentDiscordConnection> = {
          agent_id: savedAgentId,
          discord_app_id: discordConnectionData.discord_app_id,
          discord_public_key: discordConnectionData.discord_public_key,
          inactivity_timeout_minutes: discordConnectionData.inactivity_timeout_minutes,
          guild_id: discordConnectionData.guild_id,
          // worker_status should likely NOT be saved here - it's managed by the worker
        };

        // ADDED: Log the exact payload before upserting
        console.log(`[handleSubmit] Payload for connection upsert:`, JSON.stringify(connectionPayload, null, 2));

        // Since we now enforce ONE connection per agent_id via DB constraint,
        // we can use upsert with agent_id as the conflict target.
        const { error: connectionError } = await supabase
          .from('agent_discord_connections')
          .upsert(connectionPayload, { onConflict: 'agent_id' });

        if (connectionError) {
          // Handle potential unique constraint violation if upsert fails unexpectedly
          if (connectionError.code === '23505') { // PostgreSQL unique violation code
            console.error("Upsert failed due to potential constraint issue, attempting update:", connectionError);
             // As a fallback, try updating the existing record explicitly
             const { error: updateError } = await supabase
               .from('agent_discord_connections')
               .update(connectionPayload)
               .eq('agent_id', savedAgentId);
            if (updateError) throw new Error(`Discord Connection update failed: ${updateError.message}`);
          } else {
            throw new Error(`Discord Connection upsert failed: ${connectionError.message}`);
          }
        }
        console.log("[handleSubmit] Discord connection upserted successfully.");

        // Refresh agent data after save to get latest connection ID/status
        if (savedAgentId) {
            console.log("[handleSubmit] Refreshing agent data after save.");
            await fetchAgent(savedAgentId); 
        }

        setSaveSuccess(true);
        console.log("[handleSubmit] Agent save operation complete.");

      } catch (err: any) {
        console.error("[handleSubmit] Error saving agent:", err);
        setError(`Save failed: ${err.message}`);
      } finally {
        setSaving(false);
      }
    };

    // Use setTimeout to allow UI to update before potentially long save operation
    setTimeout(saveOperation, 50); 

  }, [user?.id, agentFormData, discordBotKey, isEditing, id, navigate, supabase, discordConnectionData, fetchAgent]);

  const debouncedSave = useDebouncedCallback(handleSubmit, 1500);

  // --- Comment out this useEffect block to disable auto-save ---
  // useEffect(() => {
  //   // Check if any relevant field has been touched or changed
  //   // This condition might need refinement depending on desired auto-save trigger
  //   const hasChanges = agentFormData.name || agentFormData.description || 
  //                      agentFormData.personality || agentFormData.system_instructions || 
  //                      agentFormData.assistant_instructions || 
  //                      discordConnectionData.discord_app_id || 
  //                      discordConnectionData.discord_public_key || 
  //                      discordConnectionData.inactivity_timeout_minutes || 
  //                      (isEditing && discordConnectionData.guild_id); // Only trigger on guild_id change if editing

  //   // Only trigger if editing an existing agent or if creating a new one and fields have values
  //   if ((isEditing || hasChanges) && !loading && !saving) {
  //     console.log("[Debounce] Change detected, scheduling save...");
  //     debouncedSave();
  //   }
  // }, [agentFormData, discordConnectionData, isEditing, debouncedSave, loading, saving]);
  // --- End of commented out block ---

  const pollWorkerStatus = useCallback(async (connectionId: string, targetStatus: AgentDiscordConnection['worker_status']) => {
      console.log(`[Poll] Checking status for connection ${connectionId}, target: ${targetStatus}`);
      pollAttemptsRef.current += 1;
      const MAX_POLL_ATTEMPTS = 15; // e.g., 15 attempts * 3 seconds = 45 seconds timeout
      const POLL_INTERVAL_MS = 3000;
      
      try {
          const { data, error } = await supabase
              .from('agent_discord_connections')
              .select('worker_status')
              .eq('id', connectionId)
              .single();

          if (error) throw error;
          
          const currentStatus = data?.worker_status;
          console.log(`[Poll] Current status for ${connectionId}: ${currentStatus}`);

          if (currentStatus === targetStatus || currentStatus === 'error' || currentStatus === 'inactive') { // Reached final state or error/inactive
              console.log(`[Poll] Reached final status (${currentStatus}) for ${connectionId}. Stopping poll.`);
              if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
              }
              pollAttemptsRef.current = 0;
              // Update state with the final fetched status
              setDiscordConnectionData(prev => ({
                  ...prev,
                  worker_status: currentStatus || 'error' // Default to error if null/undefined
              }));
              setIsActivating(false); // Ensure loading states are off
              setIsDeactivating(false);
          } else if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
              console.warn(`[Poll] Max poll attempts (${MAX_POLL_ATTEMPTS}) reached for ${connectionId}. Stopping poll.`);
              if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
              }
              pollAttemptsRef.current = 0;
              setError(`Worker status update timed out. Current status: ${currentStatus}. Please refresh manually.`);
              setDiscordConnectionData(prev => ({ ...prev, worker_status: 'error' })); // Set to error on timeout
              setIsActivating(false); 
              setIsDeactivating(false);
          } else {
             // Continue polling - interval should already be running
             console.log(`[Poll] Status (${currentStatus}) not final yet for ${connectionId}. Continuing poll.`);
          }

      } catch (err: any) {
          console.error(`[Poll] Error polling status for ${connectionId}: ${err.message}`);
          if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
          }
          pollAttemptsRef.current = 0;
          setError(`Error checking worker status: ${err.message}`);
          setDiscordConnectionData(prev => ({ ...prev, worker_status: 'error' })); // Set to error on poll failure
          setIsActivating(false);
          setIsDeactivating(false);
      }
  }, []);

  const handleActivateAgent = useCallback(async () => {
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
    
    const connectionIdToPoll = discordConnectionData.id;
    console.log(`Activating agent ${id}, connection ${connectionIdToPoll}...`);
    setIsActivating(true);
    setDiscordConnectionData(prev => ({ ...prev, worker_status: 'activating' }));
    setError(null);

    // Clear any existing poll before starting a new one
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollAttemptsRef.current = 0;
    
    try {
      const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
        body: { 
          action: 'start',
          agentId: id,
          connectionDbId: connectionIdToPoll,
          botToken: discordBotKey,
          inactivityTimeout: discordConnectionData.inactivity_timeout_minutes,
          agentName: agentFormData.name,
          systemPrompt: agentFormData.system_instructions,
          agentInstructions: agentFormData.assistant_instructions,
        }
      });
      if (invokeError) throw invokeError;
  
      console.log(`Agent ${id} activation request sent successfully. Starting status poll for ${connectionIdToPoll}.`);
      
      // Start polling immediately and repeat
      pollingIntervalRef.current = setInterval(() => {
        pollWorkerStatus(connectionIdToPoll, 'active'); 
      }, 3000); // Poll every 3 seconds
      pollWorkerStatus(connectionIdToPoll, 'active'); // Initial check immediately
      
    } catch (err: any) {
      console.error(`Error activating agent ${id}: ${err.message}`, { error: err });
      setError(`Activation failed: ${err.message}`);
      setIsActivating(false);
      setDiscordConnectionData(prev => ({ ...prev, worker_status: 'error' }));
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    }
  }, [id, discordConnectionData, discordBotKey, agentFormData.name, agentFormData.system_instructions, agentFormData.assistant_instructions, enabledGuilds, pollWorkerStatus]);

  const handleDeactivateAgent = useCallback(async () => {
    if (!id || !discordConnectionData.id) {
      setError('Agent or Connection ID is missing, cannot deactivate.');
      return;
    }

    const connectionIdToPoll = discordConnectionData.id;
    console.log(`Deactivating agent ${id}, connection ${connectionIdToPoll}...`);
    setIsDeactivating(true);
    setDiscordConnectionData(prev => ({ ...prev, worker_status: 'stopping' }));
    setError(null);

    // Clear any existing poll before starting a new one
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollAttemptsRef.current = 0;

    try {
      const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
        body: { action: 'stop', agentId: id, connectionDbId: connectionIdToPoll }
      });
      if (invokeError) throw invokeError;
  
      console.log(`Agent ${id} deactivation request sent successfully. Starting status poll for ${connectionIdToPoll}.`);
      
      // Start polling immediately and repeat
      pollingIntervalRef.current = setInterval(() => {
        pollWorkerStatus(connectionIdToPoll, 'inactive'); 
      }, 3000); // Poll every 3 seconds
      pollWorkerStatus(connectionIdToPoll, 'inactive'); // Initial check immediately
      
    } catch (err: any) {
      console.error(`Error deactivating agent ${id}: ${err.message}`, { error: err });
      setError(`Deactivation failed: ${err.message}`);
      setIsDeactivating(false);
      setDiscordConnectionData(prev => ({ ...prev, worker_status: 'error' }));
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    }
  }, [id, discordConnectionData.id, pollWorkerStatus]);

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

  const interactionEndpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`;
  const isFullyConnected = !!(discordBotKey || discordConnectionData.discord_app_id || discordConnectionData.discord_public_key);

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
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold">
                {isEditing ? 'Edit Agent' : 'Create New Agent'}
              </h1>
            </div>
            
            {isEditing && selectedGuildName && (
              <div className="mt-2 flex items-center space-x-2">
                <FaDiscord className="text-[#5865F2]" size={14} />
                <span className="text-sm text-gray-300">Connected to: <strong>{selectedGuildName}</strong></span>
              </div>
            )}
          </div>
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
                  onChange={(e) => handleAgentFormChange('name', e.target.value)}
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
                  onChange={(e) => handleAgentFormChange('description', e.target.value)}
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
                  onChange={(e) => handleAgentFormChange('personality', e.target.value)}
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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Discord Configuration</h2>
                  <AgentStatusToggle
                    workerStatus={discordConnectionData.worker_status || 'inactive'}
                    isWorkerBusy={isActivating || isDeactivating}
                    canActivate={!!(discordConnectionData.discord_app_id && discordConnectionData.discord_public_key && discordBotKey && discordConnectionData.guild_id)}
                    onActivate={handleActivateAgent}
                    onDeactivate={handleDeactivateAgent}
                    isActivating={isActivating}
                    isDeactivating={isDeactivating}
                  />
                </div>
                <DiscordConnect
                  connection={discordConnectionData}
                  botKey={discordBotKey}
                  onBotKeyChange={setDiscordBotKey}
                  onConnectionChange={handleConnectionChange}
                  discord_app_id={discordConnectionData.discord_app_id}
                  onGenerateInviteLink={handleGenerateInviteLink}
                  isGeneratingInvite={isGeneratingInvite}
                  workerStatus={discordConnectionData.worker_status}
                  onActivate={handleActivateAgent}
                  onDeactivate={handleDeactivateAgent}
                  isActivating={isActivating}
                  isDeactivating={isDeactivating}
                  allGuilds={allGuilds}
                  currentGuildId={discordConnectionData.guild_id}
                  className="mt-6"
                  showStatusToggle={false}
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
                    type="button"
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
                type="button"
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
                onChange={(value) => handleAgentFormChange('system_instructions', value)}
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
                type="button"
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
                type="button"
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
                onChange={(value) => handleAgentFormChange('assistant_instructions', value)}
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
                type="button"
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

// Replace the existing AgentStatusToggle function (around line 1240) with this updated version:
function AgentStatusToggle({ 
  workerStatus, 
  onActivate, 
  onDeactivate, 
  isActivating, 
  isDeactivating,
  isWorkerBusy,
  canActivate
}: { 
  workerStatus: string; 
  onActivate: () => void; 
  onDeactivate: () => void;
  isActivating: boolean;
  isDeactivating: boolean;
  isWorkerBusy: boolean;
  canActivate: boolean;
}) {
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (workerStatus === 'active') {
      onDeactivate();
    } else if (canActivate) {
      onActivate();
    }
  };

  const isActive = workerStatus === 'active';
  const isTransitioning = isActivating || isDeactivating || workerStatus === 'activating' || workerStatus === 'stopping';
  
  // No longer needed: console.log(...)
  
  return (
    <button
      type="button"
      onClick={handleToggle}
      // Disable if transitioning, or if inactive and cannot be activated
      disabled={isWorkerBusy || (!isActive && !canActivate)}
      className={`
        flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all duration-200
        border border-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500
        ${isActive 
          ? 'bg-indigo-600 text-white shadow-inner' // Active state: Indigo background, white text
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600' // Inactive state: Gray background, lighter gray text
        }
        ${isTransitioning ? 'opacity-80' : 'opacity-100'} // Dim slightly when transitioning
        ${(!isActive && !canActivate) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} // Gray out if cannot activate
      `}
    >
      {/* Status indicator dot */}
      <div 
        className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
          isTransitioning ? 'animate-pulse' : '' // Pulse during transitions
        } ${
          isActive ? 'bg-white' : 'bg-gray-400' // White dot when active, gray when inactive
        }`}
      />
      {/* Status text */}
      <span className="text-xs font-medium">
        {isActivating ? 'Activating...' : 
         isDeactivating ? 'Stopping...' : 
         isActive ? 'Active' : 'Inactive'}
      </span>
      {/* Loading spinner during transitions */}
      {isTransitioning && <Loader2 size={12} className="animate-spin ml-1" />}
    </button>
  );
}