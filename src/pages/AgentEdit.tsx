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
import { AppIdPublicKeyModal } from '../components/AppIdPublicKeyModal';
import { ServerChannelSelectModal } from '../components/ServerChannelSelectModal';

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
  });
  const [discordBotKey, setDiscordBotKey] = useState('');

  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false);
  const [discordGuilds, setDiscordGuilds] = useState<any[]>([]);
  const [fetchingGuilds, setFetchingGuilds] = useState(false);
  const [discordChannels, setDiscordChannels] = useState<any[]>([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);

  // --- NEW: Connection Stage State ---
  type DiscordStage = 'initial' | 'enter_credentials' | 'select_server' | 'connected';
  const [discordConnectionStage, setDiscordConnectionStage] = useState<DiscordStage>('initial');
  // --- End NEW State ---

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

  const fetchDiscordGuildsLogic = async () => {
    // Ensure agentId is available
    const agentId = id; 
    if (!agentId) {
      console.error("Cannot fetch guilds: Agent ID is missing.");
      setError("Cannot fetch guilds: Agent ID is missing.");
      return;
    }
    
    console.log(`Fetching Discord guilds for agent ${agentId}...`);
    setFetchingGuilds(true);
    setError(null); // Clear previous errors specific to guild fetching
    try {
      const functionName = 'discord-get-bot-guilds';
      const queryParams = new URLSearchParams({ agentId: agentId }); // Use agentId variable
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
         // Attempt to parse error JSON from Supabase Edge Function
         let detail = errorBody;
         try {
            const parsedError = JSON.parse(errorBody);
            detail = parsedError.error || errorBody;
         } catch(e) { /* Ignore parsing error, use raw text */ }
         throw new Error(`Failed to fetch Discord guilds (${response.status}): ${detail}`);
      }

      const data = await response.json();
      console.log('Discord guilds fetched successfully:', data);
      setDiscordGuilds(data || []);
      
    } catch (err: any) {
      console.error('Discord guilds fetch error:', err);
      // Display a more user-friendly error
      setError(`Error fetching Discord servers: ${err.message}. Please ensure the bot token is correct and the bot is in some servers.`); 
      setDiscordGuilds([]); // Clear guilds on error
    } finally {
      setFetchingGuilds(false);
    }
  };

  // Debounced version - might not be needed if triggered manually now
  // const debouncedFetchDiscordGuilds = useDebouncedCallback(fetchDiscordGuildsLogic, 2000);
  
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
        .select('id, guild_id, channel_id, inactivity_timeout_minutes, worker_status, discord_app_id, discord_public_key')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (connectionError) throw new Error(connectionError.message);

      if (connectionData) {
        setDiscordConnectionData({
          id: connectionData.id,
          agent_id: agentId,
          guild_id: connectionData.guild_id,
          channel_id: connectionData.channel_id,
          inactivity_timeout_minutes: connectionData.inactivity_timeout_minutes ?? 60,
          worker_status: connectionData.worker_status || 'inactive',
          discord_app_id: connectionData.discord_app_id || '',
          discord_public_key: connectionData.discord_public_key || '',
        });
      } else {
        setDiscordConnectionData({
          id: undefined,
          agent_id: agentId,
          guild_id: undefined,
          channel_id: undefined,
          inactivity_timeout_minutes: 60,
          worker_status: 'inactive',
          discord_app_id: '',
          discord_public_key: '',
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

  // *** NEW: Handler to update connection state from DiscordConnect ***
  const handleConnectionChange = (field: keyof AgentDiscordConnection, value: any) => {
    console.log(`[AgentEdit] Updating connection state: ${String(field)} = ${value}`);
    setDiscordConnectionData(prev => ({
      ...prev,
      [field]: value
    }));
    // Note: This only updates local state. 
    // The value needs to be persisted during SaveCredentials, SelectServer, or SelectChannel.
  };

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

  // Determine initial stage AND fetch guilds/channels if needed
  useEffect(() => {
      let stage: DiscordStage = 'initial';
      let shouldFetchGuilds = false;
      let shouldFetchChannels = false;
      let guildToFetchChannels: string | null | undefined = null;

      // Determine stage based on available data
      if (discordBotKey && discordConnectionData.discord_app_id && discordConnectionData.discord_public_key && discordConnectionData.guild_id) {
          stage = 'connected';
          // *** MODIFIED: Always need guilds if app_id/key are present ***
          shouldFetchGuilds = true; 
          guildToFetchChannels = discordConnectionData.guild_id; 
      } else if (discordBotKey && discordConnectionData.discord_app_id && discordConnectionData.discord_public_key) {
          stage = 'select_server';
          shouldFetchGuilds = true; 
      } else if (discordBotKey) {
          stage = 'enter_credentials';
      }

      setDiscordConnectionStage(stage);
      console.log(`[AgentEdit Stage Effect] Stage set to: ${stage}. Guild data present: ${!!discordConnectionData.guild_id}. Bot Key: ${!!discordBotKey}, App ID: ${!!discordConnectionData.discord_app_id}`);

      // Trigger fetches ONLY if necessary and not already loading
      if (shouldFetchGuilds && discordGuilds.length === 0 && !fetchingGuilds) {
         console.log("[AgentEdit Stage Effect] Triggering fetch guilds.");
         fetchDiscordGuildsLogic();
      }
      // Fetch channels ONLY if stage is connected and guild ID exists
      if (stage === 'connected' && guildToFetchChannels && discordChannels.length === 0 && !fetchingChannels) { 
         console.log(`[AgentEdit Stage Effect] Triggering fetch channels for guild ${guildToFetchChannels} because stage is 'connected'.`);
         fetchDiscordChannelsLogic(guildToFetchChannels);
      }

  // Dependencies: include everything used to determine stage + fetch status flags
  }, [
      discordBotKey, 
      discordConnectionData.discord_app_id, 
      discordConnectionData.discord_public_key, 
      discordConnectionData.guild_id, 
      fetchingGuilds, // Trigger re-check when fetchingGuilds changes
      fetchingChannels, // Trigger re-check when fetchingChannels changes
      // *** REMOVED length dependencies to avoid potential loops ***
      // discordGuilds.length, 
      // discordChannels.length 
  ]);

  // *** RESTORED: Modify server selection handler to fetch channels ***
  const handleSelectServer = async (guildId: string | null) => {
    const agentId = id;
    const connectionId = discordConnectionData.id;

    if (!agentId || (!connectionId && !agentId)) { 
        setError("Cannot save guild selection: Agent or Connection ID missing.");
        return;
    }
    
    setSaving(true); 
    setError(null);
    setDiscordChannels([]); // Clear channels when server changes

    const updateData = { 
        guild_id: guildId || null,
        channel_id: null // Reset channel ID when server changes
    };

    try {
        console.log(`[AgentEdit] Updating connection for agent ${agentId} with guild ${guildId}`);
        let query = supabase.from('agent_discord_connections').update(updateData);
        if (connectionId) query = query.eq('id', connectionId);
        else query = query.eq('agent_id', agentId); 

        const { error: updateError } = await query;
        if (updateError) throw new Error(`Guild selection save error: ${updateError.message}`);

        // Update local state 
        setDiscordConnectionData(prev => ({ ...prev, guild_id: guildId || undefined, channel_id: undefined }));
        
        if (guildId) {
            // Fetch channels for the new guild AND update stage
            await fetchDiscordChannelsLogic(guildId);
            setDiscordConnectionStage('select_server'); 
        } else {
            // If no guild selected, move to connected (or maybe back to select_server?)
            setDiscordConnectionStage('connected'); // Treat no server as 'connected' but incomplete
        }
        console.log("[AgentEdit] Guild selection saved.");

    } catch (err: any) {
        console.error("[AgentEdit] Error saving Guild selection:", err);
        setError(`Failed to save Discord server selection: ${err.message}`);
    } finally {
        setSaving(false);
    }
  };

  // *** RESTORED: Handler for saving Channel Selection ***
  const handleSelectChannel = async (channelId: string | null) => {
      const agentId = id;
      const connectionId = discordConnectionData.id;
      if (!agentId || !connectionId) { // Require connection ID for channel update
          setError("Cannot save channel selection: Connection ID missing.");
          return;
      }
      setSaving(true); // Reuse saving state maybe?
      setError(null);
      const updateData = { channel_id: channelId || null };
      try {
          console.log(`[AgentEdit] Updating connection ${connectionId} with channel ${channelId}`);
          const { error: updateError } = await supabase
              .from('agent_discord_connections')
              .update(updateData)
              .eq('id', connectionId);
              
          if (updateError) throw new Error(`Channel selection save error: ${updateError.message}`);

          // Update local state and stage (remain connected)
          setDiscordConnectionData(prev => ({ ...prev, channel_id: channelId || undefined }));
          setDiscordConnectionStage('connected'); // Stay connected
          console.log("[AgentEdit] Channel selection saved.");

      } catch (err: any) {
          console.error("[AgentEdit] Error saving Channel selection:", err);
          setError(`Failed to save Discord channel selection: ${err.message}`);
      } finally {
          setSaving(false);
      }
  };

  // Update connectDiscordBot to change stage
  const connectDiscordBot = async (token: string) => {
    const agentId = id; 
    if (!agentId || !token.trim()) {
      setError('Agent ID and bot token are required');
      return;
    }
    setDiscordLoading(true);
    setError(null);
    try {
      console.log(`[AgentEdit] Invoking function to update token for agent ${agentId}`);
      await supabase.functions.invoke('update-agent-discord-token', { 
          body: { agentId: agentId, token: token.trim() } 
      });
      console.log('[AgentEdit] Token function invoked successfully.');
      // On successful token save, update state and change stage
      setDiscordBotKey(token.trim()); 
      setDiscordConnectionStage('enter_credentials'); // <-- Change stage
    } catch (err: any) {
      console.error("[AgentEdit] Error connecting bot (saving token):", err);
      let detailedMessage = err.message;
      if (err.context?.error_details) detailedMessage = `${err.message} - ${err.context.error_details}`;
      else if (err.details) detailedMessage = `${err.message} - ${err.details}`;
      setError(`Failed to save bot token: ${detailedMessage}`);
      // Reset stage if token save fails?
      // setDiscordConnectionStage('initial'); 
    } finally {
      setDiscordLoading(false);
    }
  };

  // Renamed handler for saving credentials
  const handleSaveCredentials = async (appId: string, publicKey: string) => {
    const agentId = id;
    if (!agentId || !appId || !publicKey) {
      setError("Agent ID, Application ID, and Public Key are required.");
      return;
    }
    setSaving(true); 
    setError(null);

    const upsertData = {
      agent_id: agentId,
      discord_app_id: appId.trim(),
      discord_public_key: publicKey.trim(),
      guild_id: discordConnectionData.guild_id ?? null, 
      channel_id: discordConnectionData.channel_id ?? null, 
      inactivity_timeout_minutes: discordConnectionData.inactivity_timeout_minutes || 10,
    };

    try {
      console.log("[AgentEdit] Upserting App ID/Public Key:", upsertData);
      const { error: connectionSaveError } = await supabase
        .from('agent_discord_connections')
        .upsert(upsertData, { onConflict: 'agent_id' });

      if (connectionSaveError) throw new Error(`Discord connection save error: ${connectionSaveError.message}`);

      // --- NEW: Fetch the connection ID after upsert ---
      console.log("[AgentEdit] Fetching connection ID after upsert...");
      const { data: idData, error: idError } = await supabase
        .from('agent_discord_connections')
        .select('id')
        .eq('agent_id', agentId)
        .single(); // Expect exactly one row now

      if (idError || !idData?.id) {
        console.error("[AgentEdit] Failed to fetch connection ID after upsert:", idError);
        // Throw error? Or just warn and proceed without ID?
        // Throwing is safer as channel select will fail later.
        throw new Error("Failed to retrieve connection details after saving credentials.");
      }
      const connectionId = idData.id;
      console.log(`[AgentEdit] Fetched connection ID: ${connectionId}`);
      // --- End Fetch ID ---

      // Update local state (including the fetched ID)
      setDiscordConnectionData(prev => ({ 
          ...prev, // Keep existing status etc. 
          ...upsertData, // Saved credentials
          id: connectionId, // <<< Add the fetched ID
          guild_id: upsertData.guild_id ?? undefined,
          channel_id: upsertData.channel_id ?? undefined,
       }));

      // Fetch guilds and change stage
      await fetchDiscordGuildsLogic(); 
      setDiscordConnectionStage('select_server'); // <-- Change stage

    } catch (err: any) {
       console.error("[AgentEdit] Error saving App ID/Public Key:", err);
       setError(`Failed to save Discord App ID/Public Key: ${err.message}`);
       // Should we revert stage? Maybe not, user can retry save.
    } finally {
       setSaving(false);
    }
  };

  // NEW: Function to fetch channels for a selected guild
  const fetchDiscordChannelsLogic = async (selectedGuildId: string) => {
      const agentId = id;
      if (!agentId || !selectedGuildId) {
          console.error("[AgentEdit] Cannot fetch channels: Agent ID or Guild ID missing.");
          setError("Cannot fetch channels: Agent ID or Guild ID missing.");
          setDiscordChannels([]);
          return;
      }
      console.log(`[AgentEdit] Fetching channels for guild ${selectedGuildId}...`);
      setFetchingChannels(true);
      setError(null); 
      try {
          const functionName = 'discord-get-guild-channels'; // Assumes this function exists
          const queryParams = new URLSearchParams({ agentId, guildId: selectedGuildId });
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) throw new Error('Supabase URL not configured.');
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
              let detail = errorBody;
              try { detail = JSON.parse(errorBody).error || errorBody; } catch(e) {}
              throw new Error(`Failed to fetch channels (${response.status}): ${detail}`);
          }

          const data = await response.json();
          console.log('[AgentEdit] Discord channels fetched successfully:', data);
          setDiscordChannels(data || []); // Assuming data is the array of channels

      } catch (err: any) {
          console.error('[AgentEdit] Discord channels fetch error:', err);
          setError(`Error fetching channels: ${err.message}`);
          setDiscordChannels([]); // Clear channels on error
      } finally {
          setFetchingChannels(false);
      }
  };

  // Update disconnect to clear channels
  const disconnectDiscordBot = async () => {
    // *** ADDED LOGGING ***
    console.log(`[disconnectDiscordBot] Function called for agent ${id}. Call stack trace:`, new Error().stack); 
    // *** END ADDED LOGGING ***

    // Ensure modals are closed (no longer relevant, but keep for safety)
    // setShowAppIdModal(false);
    // setShowServerSelectModal(false);

    const agentId = id; 
    if (!agentId) {
        console.error("[disconnectDiscordBot] Agent ID missing, cannot disconnect.");
        setError("Cannot disconnect: Agent ID is missing.");
        return;
    }
    
    console.log(`[disconnectDiscordBot] Starting disconnect for agent ${agentId}...`);
    setDiscordDisconnecting(true);
    setError(null);
    
    try {
      // 1. Clear token in agents table
      console.log(`[disconnectDiscordBot] Invoking function to clear token for agent ${agentId}`);
      const { error: fnError } = await supabase.functions.invoke('update-agent-discord-token', 
          { body: { agentId: agentId, token: null } } 
      );
      if (fnError) console.error("[disconnectDiscordBot] Error invoking clear token function (proceeding anyway):", fnError);
      else console.log('[disconnectDiscordBot] Clear token function invoked.');

      // 2. Delete connection details
      // *** ADDED LOGGING ***
      console.log(`[disconnectDiscordBot] Preparing to DELETE discord connection details for agent: ${agentId}`); 
      // *** END ADDED LOGGING ***
      const { error: delError } = await supabase
        .from('agent_discord_connections')
        .delete()
        .eq('agent_id', agentId); 
      if (delError) console.error("[disconnectDiscordBot] Error deleting connection details from DB (proceeding anyway):", delError);
      else console.log("[disconnectDiscordBot] Connection details deleted (or none existed).");

    } catch (err: any) { // Catch potential errors during invoke/delete
      console.error("[disconnectDiscordBot] Error during disconnect process:", err);
      // Don't set main error state here, rely on finally block's state reset
    } finally {
       console.log("[disconnectDiscordBot] Entering finally block. Resetting state.");
       // Always reset state after disconnect attempt
       setDiscordBotKey('');
       setDiscordGuilds([]);
       setDiscordChannels([]); // <-- Clear channels
       setDiscordConnectionData({}); 
       setDiscordConnectionStage('initial'); // <-- Reset stage
       setDiscordDisconnecting(false);
       setError(null); // Clear any lingering errors from the disconnect process
       console.log("[disconnectDiscordBot] Disconnect process finished, state reset.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    // Agent details are still saved here
    const agentUpdateData: Partial<AgentType> = {
      name: agentFormData.name,
      description: agentFormData.description,
      personality: agentFormData.personality,
      system_instructions: agentFormData.system_instructions,
      assistant_instructions: agentFormData.assistant_instructions,
      active: agentFormData.active,
    };

    // --- REMOVE Discord connection details from main save ---
    // const connectionUpdateData: Partial<AgentDiscordConnection> = { ... }; 
    // --- End REMOVE ---
      
    try {
      let agentId = id;

      // 1. Save/Update Agent Core Details (Name, Instructions etc.)
      if (isEditing && agentId) {
        // ... (existing agent update logic) ...
         const { error: agentSaveError } = await supabase
          .from('agents')
          .update(agentUpdateData)
          .eq('id', agentId)
          .eq('user_id', user.id);
        if (agentSaveError) throw new Error(`Agent save error: ${agentSaveError.message}`);
      } else {
        // ... (existing agent create logic) ...
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
      
      // --- REMOVE Discord connection upsert from here ---
      // if (connectionUpdateData.agent_id ...) { ... }
      // --- End REMOVE ---
      
      // --- REMOVE Command Registration Trigger ---
      // const appId = connectionUpdateData.discord_app_id; ... if (agentId && appId && botKey) { ... }
      // --- End REMOVE ---
      
      setSaveSuccess(true);
      // Navigate only if creating new, otherwise stay
      if (!isEditing && agentId) { 
        navigate(`/agents/${agentId}/edit`); 
      } else if (agentId) {
        // Re-fetch agent data after save? Only if needed.
        // fetchAgent(agentId); 
      }

    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save agent data');
    } finally {
      setSaving(false);
    }
  };

  // --- NEW: Handler for Activating Agent Worker ---
  const handleActivateAgent = async () => {
    console.log(`%c[AgentEdit] handleActivateAgent CALLED! Agent: ${id}, Current Status in State: ${discordConnectionData?.worker_status}`, "color: red; font-weight: bold;");

    if (!id || !discordConnectionData.guild_id) {
      setError("Cannot activate: Agent ID or selected server is missing.");
      return;
    }
    
    setDiscordLoading(true);
    setError(null);
    
    try {
      // --- REFACTORED: Call manager and wait for confirmation --- 
      console.log(`[AgentEdit] Invoking manage-discord-worker (start) for agent ${id} and awaiting confirmation...`);
      // Assuming 'manage-discord-worker' calls the manager's /start-worker endpoint which now polls
      const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
        body: { 
          action: 'start',
          agentId: id,
          guildId: discordConnectionData.guild_id // Pass guildId if needed by function/manager
          // Add connectionDbId and botToken if the function requires them directly
          // connectionDbId: discordConnectionData.id, 
          // botToken: discordBotKey 
        }
      });

      if (invokeError) {
        // Error response from manager (e.g., polling timeout)
        throw invokeError;
      }
      
      // --- Manager confirmed worker is active --- 
      console.log("[AgentEdit] Manager confirmed agent activation successful.");
      setDiscordConnectionData(prev => ({ ...(prev || {}), worker_status: 'active' } as Partial<AgentDiscordConnection>)); 
      
    } catch (err: any) {
      console.error("[AgentEdit] Error activating agent:", err);
      const errorMessage = err.context?.function_error // Supabase specific error structure
                         || err.message 
                         || err.details 
                         || 'Activation failed. Check manager logs.';
      setError(`Failed to activate agent: ${errorMessage}`);
      // Reset status if activation failed?
      // setDiscordConnectionData(prev => ({ ...(prev || {}), worker_status: 'inactive' } as Partial<AgentDiscordConnection>));
    } finally {
      setDiscordLoading(false);
    }
  };
  // --- End Activate Handler --- 

  // --- REFACTORED: Handler for Deactivating Agent Worker --- 
  const handleDeactivateAgent = async () => {
    if (!id) return;
    console.log(`%c[UI DEACTIVATE START] Deactivating agent ${id}...`, 'color: orange; font-weight: bold;');
    setDiscordLoading(true); 
    setError(null);

    try {
      // --- REFACTORED: Call manager and wait for confirmation --- 
      console.log(`[AgentEdit] Invoking manage-discord-worker (stop) for agent ${id} and awaiting confirmation...`);
       // Assuming 'manage-discord-worker' calls the manager's /stop-worker endpoint which now polls
      const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
        body: { 
          action: 'stop',
          agentId: id
          // Add guildId if needed by stop function/manager?
          // guildId: discordConnectionData.guild_id 
        }
      });

      if (invokeError) {
         // Error response from manager (e.g., polling timeout)
        throw invokeError;
      }

      // --- Manager confirmed worker is inactive --- 
      console.log("[AgentEdit] Manager confirmed agent deactivation successful.");
      setDiscordConnectionData(prev => ({ ...(prev || {}), worker_status: 'inactive' } as Partial<AgentDiscordConnection>));
      
      // --- REMOVED UI Polling Logic --- 
      
    } catch (err: any) {
      console.error("[UI DEACTIVATE ERR] Error during deactivation:", err);
      const errorMessage = err.context?.function_error // Supabase specific error structure
                         || err.message 
                         || err.details 
                         || 'Deactivation failed. Check manager logs.';
      setError(`Deactivation Error: ${errorMessage}`);
      // Maybe re-fetch agent data here to get actual DB state on error?
      // fetchAgent(id);
    } finally {
      setDiscordLoading(false);
    }
  };
  // --- End Deactivate Handler --- 

  // *** ADDED LOGGING ***
  console.log(`[AgentEdit RENDER] Rendering component. discordConnectionData.worker_status =`, discordConnectionData?.worker_status);
  // *** END ADDED LOGGING ***

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

  const generateInteractionEndpointUrl = (): string => {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`;
      return baseUrl; 
  };
  const interactionEndpointUrl = generateInteractionEndpointUrl();

  const isFullyConnected = !!(discordBotKey && discordConnectionData.discord_app_id && discordConnectionData.discord_public_key);

  // --- NEW: Find selected guild name ---
  const selectedGuildName = discordGuilds.find(g => g.id === discordConnectionData.guild_id)?.name;
  // --- End NEW ---

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
                  // Pass stage and relevant data/handlers
                  connectionStage={discordConnectionStage}
                  connection={discordConnectionData}
                  guilds={discordGuilds} 
                  channels={discordChannels} 
                  onConnectToken={connectDiscordBot} 
                  onSaveCredentials={handleSaveCredentials} 
                  onSelectServer={handleSelectServer} 
                  onSelectChannel={handleSelectChannel} 
                  onDisconnect={disconnectDiscordBot}
                  onActivate={handleActivateAgent} // Pass activate handler
                  onDeactivate={handleDeactivateAgent} // Pass deactivate handler
                  onConnectionChange={handleConnectionChange} // Pass connection change handler
                  loading={discordLoading || saving || fetchingGuilds || fetchingChannels} // Combine loading states
                  disconnecting={discordDisconnecting}
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