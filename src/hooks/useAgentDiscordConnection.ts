import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AgentDiscordConnection } from '../types';
import type { BotGuild } from '../components/DiscordTypes'; // Corrected import path
import { PostgrestError } from '@supabase/supabase-js';

// Define the return type for the hook
interface UseAgentDiscordConnectionReturn {
  connection: Partial<AgentDiscordConnection> | null;
  // botKey: string | null; // Removed - Don't store/fetch actual key in frontend
  hasCredentials: boolean; // New state to indicate if setup seems complete
  workerStatus: AgentDiscordConnection['worker_status'] | null;
  allGuilds: BotGuild[];
  isActivating: boolean;
  isDeactivating: boolean;
  isGeneratingInvite: boolean;
  loading: boolean;
  error: string | null; // Using string for simplicity here
  fetchConnectionDetails: () => Promise<void>;
  updateConnectionField: (field: keyof AgentDiscordConnection, value: any) => void;
  // updateBotKey: (key: string) => void; // Removed - Needs secure backend implementation for saving
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  generateInviteLink: () => Promise<string | null>; // Returns the link or null
}

export function useAgentDiscordConnection(agentId: string | undefined): UseAgentDiscordConnectionReturn {
  const [connection, setConnection] = useState<Partial<AgentDiscordConnection> | null>(null);
  // const [botKey, setBotKey] = useState<string | null>(null); // Removed
  const [hasCredentials, setHasCredentials] = useState(false); // New state
  const [workerStatus, setWorkerStatus] = useState<AgentDiscordConnection['worker_status'] | null>(null);
  const [allGuilds, setAllGuilds] = useState<BotGuild[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchConnectionDetails = useCallback(async () => {
    if (!agentId) {
        setHasCredentials(false); // Ensure reset if no agentId
        return;
    }
    console.log(`[useAgentDiscordConnection] Fetching connection for agent ${agentId}`);
    setLoading(true);
    setError(null);
    setHasCredentials(false); // Reset credentials status at start of fetch
    setAllGuilds([]); // Reset guilds
    try {
      // Fetch core connection details (App ID, Public Key, etc.)
      const { data: connectionData, error: fetchError } = await supabase
        .from('agent_discord_connections')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setConnection(connectionData);
      setWorkerStatus(connectionData?.worker_status || 'inactive');

      // Assume no credentials until proven otherwise
      let fetchedGuildsSuccessfully = false;

      // If connection record exists, attempt to fetch guilds
      // Success implies the backend function accessed and used a valid bot key
      if (connectionData) {
        try {
          console.log(`[useAgentDiscordConnection] Connection record found, fetching guilds...`);
          const { data: guildsData, error: guildsError } = await supabase.functions.invoke('discord-get-bot-guilds', {
            body: { agentId: agentId }
          });

          if (guildsError) {
              // Log specific guild fetch error, but don't necessarily throw and stop everything
              console.error(`[useAgentDiscordConnection] Failed to fetch guilds (backend function error): ${guildsError.message}`);
              setError(prev => prev ? `${prev}\nFailed to fetch guilds: ${guildsError.message}` : `Failed to fetch guilds: ${guildsError.message}`);
          } else if (guildsData && Array.isArray(guildsData)) {
              console.log(`[useAgentDiscordConnection] Successfully fetched ${guildsData.length} guilds.`);
              setAllGuilds(guildsData as BotGuild[]);
              fetchedGuildsSuccessfully = true; // Mark guilds as fetched
          } else {
              console.warn("[useAgentDiscordConnection] Guilds data received in unexpected format or is not an array:", guildsData);
              setError(prev => prev ? `${prev}\nGuild data format unexpected.` : `Guild data format unexpected.`);
          }
        } catch (guildsErr: any) {
            console.error("[useAgentDiscordConnection] Error invoking/processing discord-get-bot-guilds function:", guildsErr);
            setError(prev => prev ? `${prev}\n${guildsErr.message}` : guildsErr.message);
        }
      } else {
          console.log(`[useAgentDiscordConnection] No connection record found for agent ${agentId}.`);
      }

      // Determine 'hasCredentials' status - MODIFY THIS SECTION
      // Instead of requiring guild fetch success, just require app ID and public key
      const credentialsPresent = !!connectionData?.discord_app_id && 
                                 !!connectionData?.discord_public_key;
      
      console.log(`[useAgentDiscordConnection] Credentials Check: AppID=${!!connectionData?.discord_app_id}, PubKey=${!!connectionData?.discord_public_key}, Guilds Fetched=${fetchedGuildsSuccessfully} => hasCredentials=${credentialsPresent}`);
      setHasCredentials(credentialsPresent);

    } catch (err: any) {
      console.error("Error fetching connection details:", err);
      setError(err.message || "Failed to load Discord connection details.");
      setConnection(null);
      setWorkerStatus(null);
      setAllGuilds([]);
      setHasCredentials(false); // Ensure reset on error
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Initial fetch
  useEffect(() => {
    fetchConnectionDetails();
  }, [fetchConnectionDetails]);

  // --- Handlers ---

  const updateConnectionField = useCallback(async (field: keyof AgentDiscordConnection, value: any) => {
    if (!agentId || !connection) return;

    const updatedConnection = { ...connection, [field]: value };
    setConnection(updatedConnection);
    setError(null);

    // Persist change to DB
    try {
        const { error: updateError } = await supabase
            .from('agent_discord_connections')
            .update({ [field]: value })
            .eq('agent_id', agentId);
        if (updateError) throw updateError;
        console.log(`[useAgentDiscordConnection] Updated field ${field} for agent ${agentId}`);

        // Re-check credentials status if App ID or Public Key changed
        if (field === 'discord_app_id' || field === 'discord_public_key') {
            console.log(`[useAgentDiscordConnection] App ID or Public Key updated, re-evaluating credentials status.`);
            // Note: This doesn't re-fetch guilds, assumes bot key validity remains until next full fetch
            const credentialsPresent = !!updatedConnection.discord_app_id &&
                                     !!updatedConnection.discord_public_key &&
                                     hasCredentials; // Keep existing guild fetch status
            setHasCredentials(credentialsPresent);
        }

    } catch (err: any) {
        console.error(`Error updating connection field ${field}:`, err);
        setError(err.message || `Failed to update ${field}.`);
        // Optionally revert state change by re-fetching everything
        // fetchConnectionDetails();
    }
  }, [agentId, connection, hasCredentials]); // Added hasCredentials dependency

  /*
  // Placeholder for secure bot key saving - requires backend function
  const secureUpdateBotKey = useCallback(async (key: string) => {
      if (!agentId) return;
      console.log("[useAgentDiscordConnection] secureUpdateBotKey called (secure persistence TODO)", key ? 'key received' : 'key cleared');
      // TODO: Implement call to Supabase edge function (e.g., 'update-agent-discord-token')
      // This function should handle secure storage (encryption/Vault).
      // Example:
      // try {
      //   setSavingKey(true); // Add loading state if needed
      //   const { error } = await supabase.functions.invoke('update-agent-discord-token', {
      //     body: { agentId, botToken: key } // Send the raw key securely
      //   });
      //   if (error) throw error;
      //   // On success, refetch connection details to update 'hasCredentials' status
      //   await fetchConnectionDetails();
      // } catch (err) {
      //   console.error("Error saving bot key:", err);
      //   setError("Failed to save bot key securely.");
      // } finally {
      //   setSavingKey(false);
      // }
  }, [agentId, fetchConnectionDetails]);
  */

  const activate = useCallback(async () => {
    // Activation requires App ID, Public Key (checked via hasCredentials implicitly) AND a selected Guild
    if (!agentId || !connection?.guild_id || !hasCredentials) {
        setError("Missing Agent ID, Server ID, or incomplete credentials to activate.");
        console.warn(`Activation blocked: agentId=${!!agentId}, guildId=${!!connection?.guild_id}, hasCredentials=${hasCredentials}`);
        return;
    }
    console.log(`[useAgentDiscordConnection] Activating agent ${agentId} on server ${connection.guild_id}`);
    setIsActivating(true);
    setWorkerStatus('activating'); // Optimistic UI update
    setError(null);
    try {
       const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
         body: {
           action: 'start',
           agentId,
           guildId: connection.guild_id
           // botKey is intentionally omitted - backend retrieves it securely
         }
       });

       if (invokeError) throw invokeError;

       console.log(`[useAgentDiscordConnection] Activation request successful for agent ${agentId}`);
       // Fetch details again to get the definitive status from DB
       await fetchConnectionDetails();

    } catch (err: any) {
      console.error("Error activating agent via Supabase function:", err);
      setError(err.message || "Failed to activate agent.");
      // Revert optimistic update or fetch status again
      await fetchConnectionDetails();
    } finally {
      setIsActivating(false);
    }
  }, [agentId, connection, fetchConnectionDetails, hasCredentials]); // Added hasCredentials dependency

  const deactivate = useCallback(async () => {
    if (!agentId) {
        setError("Missing Agent ID to deactivate.");
        return;
    }
     console.log(`[useAgentDiscordConnection] Deactivating agent ${agentId}`);
    setIsDeactivating(true);
    setWorkerStatus('stopping'); // Optimistic UI update
    setError(null);
    try {
        const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
           body: {
             action: 'stop',
             agentId
           }
         });

       if (invokeError) throw invokeError;

       console.log(`[useAgentDiscordConnection] Deactivation request successful for agent ${agentId}`);
       // Fetch details again to get the definitive status from DB
       await fetchConnectionDetails();

    } catch (err: any) {
      console.error("Error deactivating agent via Supabase function:", err);
      setError(err.message || "Failed to deactivate agent.");
      // Revert optimistic update or fetch status again
      await fetchConnectionDetails();
    } finally {
      setIsDeactivating(false);
    }
  }, [agentId, fetchConnectionDetails]);

  const generateInviteLink = useCallback(async (): Promise<string | null> => {
    // Keeping client-side generation for now as per investigation
    if (!connection?.discord_app_id) {
        setError("Missing Discord App ID to generate invite link.");
        return null;
    }
     console.log(`[useAgentDiscordConnection] Generating client-side invite link for app ${connection.discord_app_id}`);
    setIsGeneratingInvite(true);
    setError(null);
    try {
        // TODO: Ideally call backend function/Discord API to generate link for better permission control.
        // Using client-side generation based on current implementation findings.
        const permissions = 8; // Administrator permissions for example - consider reducing scope
        const invite = `https://discord.com/api/oauth2/authorize?client_id=${connection.discord_app_id}&permissions=${permissions}&scope=bot%20applications.commands`;

        // Simulate slight delay and copy to clipboard
        await new Promise(res => setTimeout(res, 500));
        await navigator.clipboard.writeText(invite);
        console.log(`[useAgentDiscordConnection] Invite link generated and copied (client-side)`);

        // Return the link (though the primary action is copying)
        return invite;
    } catch (err: any) {
        console.error("Error generating/copying invite link:", err);
        setError(err.message || "Failed to generate or copy invite link.");
        return null;
    } finally {
        setIsGeneratingInvite(false); // Reset state after copy/error
        // Set a brief timeout to show "Copied!" state in UI if needed elsewhere
        setTimeout(() => setIsGeneratingInvite(false), 1500);
    }
  }, [connection?.discord_app_id]);

  return {
    connection,
    // botKey, // Removed
    hasCredentials, // Added
    workerStatus,
    allGuilds,
    isActivating,
    isDeactivating,
    isGeneratingInvite,
    loading,
    error,
    fetchConnectionDetails,
    updateConnectionField,
    // updateBotKey, // Removed - See secureUpdateBotKey placeholder
    activate,
    deactivate,
    generateInviteLink,
  };
} 