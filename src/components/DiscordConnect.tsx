import React, { useState, useEffect, useMemo } from 'react';
import { Bot, Check, Loader2, X, Edit, Plus, Trash2 } from 'lucide-react';

// Define the structure for a single Discord connection - must match AgentEdit.tsx
// Consider moving this to a shared types file later
interface DiscordConnection {
  guildId: string;
  channelId: string;
  guildName?: string; 
  channelName?: string; 
}

interface DiscordGuild {
  id: string;
  name: string;
  channels: {
    id: string;
    name: string;
  }[];
}

interface DiscordConnectProps {
  agentId: string;
  isConnected: boolean; // Signifies if bot token is likely configured
  connections: DiscordConnection[]; // Array of current connections
  onAddChannel: (connection: DiscordConnection) => void; // Handler to add a channel
  onRemoveChannel: (channelId: string) => void; // Handler to remove a channel
  onRemoveGuild: (guildId: string) => void; // Handler to remove a guild
  onDisconnectBot: () => void; // Handler to disconnect the bot entirely
  onConnectSuccess: (token: string) => void; // Updated to accept token parameter
  className?: string;
  // New props for Edge Function integration
  guilds?: any[]; // Discord guilds fetched from API
  loading?: boolean; // Loading state for connecting
  disconnecting?: boolean; // Disconnecting state
  fetchingGuilds?: boolean; // Loading state for fetching guilds
  onFetchGuilds?: () => void; // Handler to fetch guilds
  botToken?: string; // Bot token input value
  onBotTokenChange?: (token: string) => void; // Handler for bot token input
}

/**
 * DiscordConnect component handles the integration with Discord.
 * Allows connecting a bot token and managing multiple channel connections.
 * 
 * @param {string} agentId - The ID of the agent.
 * @param {boolean} isConnected - Indicates if a bot token is configured.
 * @param {DiscordConnection[]} connections - Current channel connections.
 * @param {function} onAddChannel - Callback to add a channel connection.
 * @param {function} onRemoveChannel - Callback to remove a channel connection.
 * @param {function} onRemoveGuild - Callback to remove a guild connection.
 * @param {function} onDisconnectBot - Callback to disconnect the bot.
 * @param {function} onConnectSuccess - TEMPORARY callback for testing UI transition.
 * @param {string} [className] - Optional additional class names.
 * @returns {JSX.Element} The rendered component.
 */
export function DiscordConnect({ 
  agentId, 
  isConnected,
  connections, 
  onAddChannel, 
  onRemoveChannel, 
  onRemoveGuild,
  onDisconnectBot, 
  onConnectSuccess,
  className = '',
  guilds: externalGuilds,
  loading: externalLoading,
  disconnecting: externalDisconnecting,
  fetchingGuilds: externalFetchingGuilds,
  onFetchGuilds: externalOnFetchGuilds,
  botToken: externalBotToken,
  onBotTokenChange: externalOnBotTokenChange
}: DiscordConnectProps) {
  
  // --- State Variables --- 
  const [botToken, setBotToken] = useState(externalBotToken || ''); // For initial connection
  const [guilds, setGuilds] = useState<DiscordGuild[]>(externalGuilds || []); // All guilds bot can access
  const [selectedGuild, setSelectedGuild] = useState<string>(''); // For Add Server dropdown / Modal context
  const [selectedChannel, setSelectedChannel] = useState<string>(''); // For Add Channel dropdown in Modal
  
  const [loading, setLoading] = useState(externalLoading || false); // For initial bot connection
  const [disconnecting, setDisconnecting] = useState(externalDisconnecting || false); // For disconnecting bot
  const [loadingGuilds, setLoadingGuilds] = useState(externalFetchingGuilds || false); // For fetching guilds after connect or for adding
  const [error, setError] = useState<string | null>(null);

  // Checklist Step 2.2: Adjust state
  // const [isAdding, setIsAdding] = useState(false); // Removed
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalGuildId, setModalGuildId] = useState<string | null>(null);
  const [modalGuildName, setModalGuildName] = useState<string | null>(null);

  const [isAddingServer, setIsAddingServer] = useState(false); // Step 2.4.1: Add state

  // --- Hooks --- 
  // Keep useEffect to fetch guilds when connected
  useEffect(() => {
    // Use external guilds if provided
    if (externalGuilds?.length) {
      setGuilds(externalGuilds);
    }
    
    // Update local state based on external props
    if (externalLoading !== undefined) setLoading(externalLoading);
    if (externalDisconnecting !== undefined) setDisconnecting(externalDisconnecting);
    if (externalFetchingGuilds !== undefined) setLoadingGuilds(externalFetchingGuilds);
    if (externalBotToken !== undefined && externalBotToken !== botToken) setBotToken(externalBotToken);
    
    // Fetch guilds when connected but none loaded yet
    if (isConnected && (!guilds.length || !externalGuilds?.length) && !loadingGuilds && !externalFetchingGuilds) {
      if (externalOnFetchGuilds) {
        externalOnFetchGuilds();
      } else {
        fetchBotGuilds(); 
      }
    }
    
    if (!isConnected) {
      setIsModalOpen(false); // Ensure modal is closed if disconnected
      if (!externalGuilds?.length) setGuilds([]); 
    }
  }, [isConnected, externalGuilds, externalLoading, externalDisconnecting, externalFetchingGuilds, externalBotToken]); 

  // --- Functions (will be refactored) ---

  /**
   * Fetches the guild list for the connected bot token.
   * Needed for the "Add Channel" dropdowns.
   */
  const fetchBotGuilds = async () => { // Renamed from fetchGuildsAndCurrentSelection
    console.log(`Fetching bot guilds...`);
    if (!agentId) return; // Need agentId to get token on backend
    
    // If external fetch handler is provided, use it
    if (externalOnFetchGuilds) {
      externalOnFetchGuilds();
      return;
    }
    
    setLoadingGuilds(true);
    setError(null);
    try {
      // Placeholder for backend call to get guilds for the *connected bot*
      // This endpoint likely needs agentId to find the token
      // const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-get-bot-guilds?agentId=${agentId}`, { ... });
      // const data = await response.json();

      // --- MOCK DATA (REMOVE WHEN BACKEND IS READY) ---
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
      const mockGuilds = [
        { id: 'guild1', name: 'Mock Server Alpha', channels: [{id: 'chan1-a', name: 'general'}, {id: 'chan1-b', name: 'random'}] },
        { id: 'guild2', name: 'Mock Server Beta', channels: [{id: 'chan2-a', name: 'support'}, {id: 'chan2-b', name: 'dev-talk'}] },
        { id: 'guild3', name: 'Mock Server Gamma', channels: [{id: 'chan3-a', name: 'announcements'}] },
      ];
      const data = { guilds: mockGuilds };
      // --- END MOCK DATA ---

      setGuilds(data.guilds || []);
      // Reset selections whenever guilds are fetched
      setSelectedGuild('');
      setSelectedChannel('');

    } catch (err: any) {
      console.error('Error fetching bot guilds:', err);
      setError('Failed to load available servers/channels for adding.');
      setGuilds([]); // Clear guilds on error
    } finally {
      setLoadingGuilds(false);
    }
  };

  // --- handleConnect --- 
  // Needs update: On success, should trigger parent state update to set bot_key/isConnected
  // and call fetchBotGuilds 
  const handleConnect = async () => {
    if (!botToken.trim()) {
      setError('Please enter a bot token');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Pass the token to the parent component handler
      onConnectSuccess(botToken);
      
      // Clear the token input for security
      setBotToken('');
    } catch (err: any) {
      console.error('Discord connection error:', err);
      setError(err.message || 'Failed to connect to Discord');
      setLoading(false); // Only set loading to false here on error, parent handles success case
    }
  };

  // --- handleGuildSelect --- 
  // (Logic is mostly ok, selects guild for the 'add' dropdown)
  const handleGuildSelect = (guildId: string) => {
    setSelectedGuild(guildId);
    setSelectedChannel(''); // Reset channel when guild changes
  };

  // --- handleDisconnectBot --- 
  // Rename from handleDisconnect, update logic slightly
  const handleDisconnectBot = async () => {
    // Simply call parent's disconnect handler
    onDisconnectBot();
  };

  // --- NEW: Handler for Add Channel button --- 
  const handleAddChannelClick = () => {
    setIsModalOpen(true);
    // Fetch guilds if they haven't been loaded yet
    if (guilds.length === 0 && !loadingGuilds) {
      fetchBotGuilds();
    }
    // Reset selections
    setSelectedGuild('');
    setSelectedChannel('');
  };
  
  // --- NEW: Handler for Cancel Add --- 
  const handleCancelAdd = () => {
    setIsModalOpen(false);
    setError(null);
    setSelectedGuild('');
    setSelectedChannel('');
  };

  // Checklist Step 2.6.3: Create handler to open modal
  const handleOpenChannelModal = (guildId: string, guildName: string | undefined) => {
    setModalGuildId(guildId);
    setModalGuildName(guildName || guildId); // Use ID as fallback name
    setIsModalOpen(true);
    // Reset channel selection for the modal's add dropdown
    setSelectedChannel(''); 
  };

  const handleCloseChannelModal = () => {
    setIsModalOpen(false);
    setModalGuildId(null);
    setModalGuildName(null);
  };

  // Helper to group connections by guild
  const groupedConnections = useMemo(() => {
    return connections.reduce((acc, conn) => {
      const guildId = conn.guildId;
      if (!acc[guildId]) {
        // Try to find guild name from fetched guilds or use stored name
        const guildInfo = guilds.find(g => g.id === guildId);
        const name = conn.guildName || guildInfo?.name || guildId;
        acc[guildId] = { guildId: guildId, name: name, channels: [] };
      }
      acc[guildId].channels.push(conn);
      return acc;
    }, {} as Record<string, { guildId: string; name: string; channels: DiscordConnection[] }>);
  }, [connections, guilds]);

  // Step 2.4.2 / 2.4.3: Update Add Server handler & implement selection logic
  const handleAddServerClick = () => {
      // Toggle dropdown visibility
      setIsAddingServer(prev => !prev);
      // Fetch guilds if needed when opening dropdown
      if (!isAddingServer && guilds.length === 0 && !loadingGuilds) {
          fetchBotGuilds();
      }
      // Reset guild selection for the dropdown
      setSelectedGuild(''); 
  };

  const handleAddServerSelect = (selectedGuildId: string) => {
      if (!selectedGuildId) {
          setIsAddingServer(false); // Close dropdown if placeholder selected
          return;
      }
      
      const guild = guilds.find(g => g.id === selectedGuildId);
      if (!guild) return;

      // Find the first available channel in this guild that isn't already connected
      const firstAvailableChannel = guild.channels.find(
          ch => !connections.some(conn => conn.channelId === ch.id)
      );

      if (firstAvailableChannel) {
          onAddChannel({
              guildId: guild.id,
              channelId: firstAvailableChannel.id,
              guildName: guild.name,
              channelName: firstAvailableChannel.name
          });
      } else {
          // Optional: Handle case where a server exists but has NO available channels (all already added)
          // Maybe show a small notification? Or just do nothing.
          console.warn(`No available channels to automatically add for server: ${guild.name}`);
          // Alternatively, open the modal? 
          // handleOpenChannelModal(guild.id, guild.name);
      }

      setIsAddingServer(false); // Hide dropdown after selection
      setSelectedGuild(''); // Reset dropdown selection
  };

  // Checklist Step 2.3 / 2.5 / 2.4: Refactor UI Rendering & Add Modal Structure
  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* Header with Disconnect Bot button */} 
      <div className="flex items-center justify-between mb-6">
         {/* ... (Bot icon and title) ... */} 
        <div className="flex items-center space-x-3">
          <Bot className="w-6 h-6 text-indigo-500" />
          <h2 className="text-xl font-semibold">Discord Integration</h2>
        </div>
        {isConnected && (
           <button
              onClick={handleDisconnectBot}
              disabled={disconnecting}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
              title="Disconnect Bot and Remove All Channels"
            >
              {disconnecting ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Disconnecting...</>
              ) : (
                <><X className="w-4 h-4 mr-1" /> Disconnect Bot</>
              )}
            </button>
        )}
      </div>

      {/* Error Display */} 
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* --- UI Logic --- */} 
      {!isConnected ? (
        // --- Initial Connection Flow --- 
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Bot Token</label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your Discord bot token"
                disabled={loading}
              />
              <button
                onClick={handleConnect}
                disabled={loading || !botToken.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Connecting...</> : 'Connect Bot'}
              </button>
            </div>
             <p className="text-xs text-gray-400 mt-1">Connect your Discord bot to enable channel integration.</p>
          </div>
        </div>
      ) : (
        // --- Connected Flow (Server List, Add Button) --- 
        <div className="space-y-4">
          {/* --- List of Connected Servers --- */} 
          <h3 className="text-lg font-medium text-gray-300">Connected Servers</h3>
          {Object.keys(groupedConnections).length === 0 ? (
             <p className="text-sm text-gray-400">No servers connected yet. Click "Add Server" to start.</p>
          ) : (
            <ul className="space-y-2">
              {Object.values(groupedConnections).map((guild) => (
                <li key={guild.guildId} className="flex items-center justify-between bg-gray-700/50 p-3 rounded">
                  <div className='flex-grow mr-4 truncate'>
                     <span className="font-medium text-gray-100 block truncate" title={guild.name}>{guild.name}</span>
                     <span className='text-xs text-gray-400'>{guild.channels.length} channel(s) connected</span>
                  </div>
                  <div className='flex-shrink-0 space-x-2'>
                    <button 
                        onClick={() => handleOpenChannelModal(guild.guildId, guild.name)}
                        className="px-2 py-1 text-xs text-indigo-300 bg-indigo-800/50 hover:bg-indigo-800/80 rounded transition-colors"
                        title="Manage connected channels for this server"
                    >
                        Manage Channels
                    </button>
                    <button 
                        onClick={() => onRemoveGuild(guild.guildId)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove connection to this server and all its channels"
                    >
                        <Trash2 className="w-4 h-4" /> {/* Use Trash icon */} 
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* --- Add Server Button & Dropdown --- */} 
          <div className="mt-4 flex items-center space-x-2">
             <button
                onClick={handleAddServerClick}
                className={`px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors flex items-center text-sm disabled:opacity-50 ${isAddingServer ? 'bg-gray-500' : ''}`}
                disabled={loadingGuilds}
             >
                <Plus className="w-4 h-4 mr-2" />
                {isAddingServer ? 'Cancel Add' : 'Add Server Connection'}
             </button>

            {/* Step 2.4.4: Add Server Dropdown */} 
             {isAddingServer && (
                loadingGuilds ? (
                    <div className="flex items-center space-x-2 text-gray-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> 
                        <span>Loading servers...</span>
                    </div>
                ) : (
                    <select
                        value={selectedGuild} // Use state to control selection
                        onChange={(e) => handleAddServerSelect(e.target.value)}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                        <option value="">-- Select Server to Add --</option>
                        {guilds
                            .filter(g => !groupedConnections[g.id]) // Filter out already connected guilds
                            .map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))
                        }
                         {/* Message if no unconnected servers available */} 
                         {guilds.length > 0 && guilds.every(g => groupedConnections[g.id]) && (
                            <option value="" disabled>No more available servers</option>
                         )}
                    </select>
                )
             )}
          </div>
        </div>
      )}
      
      {/* --- Channel Management Modal (Step 2.5) --- */} 
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-out">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg shadow-xl transform transition-all duration-300 ease-out scale-95 opacity-0 animate-fade-scale-in">
            {/* Modal Header */} 
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage Channels: <span className='text-indigo-400'>{modalGuildName}</span></h2>
              <button
                onClick={handleCloseChannelModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Body - Step 2.5.3 */}
            <div className='min-h-[200px] space-y-6'>
              {/* List Connected Channels for this Guild */}
              <div>
                <h4 className="text-md font-medium text-gray-300 mb-2">Connected Channels</h4>
                {connections.filter(c => c.guildId === modalGuildId).length === 0 ? (
                   <p className="text-sm text-gray-500 italic">No channels connected for this server yet.</p>
                ) : (
                  <ul className="space-y-1 max-h-40 overflow-y-auto pr-2">
                    {connections
                      .filter(c => c.guildId === modalGuildId)
                      .map(conn => (
                        <li key={conn.channelId} className="flex items-center justify-between bg-gray-700/60 px-3 py-1.5 rounded">
                          <span className="text-sm text-gray-200 truncate">#{conn.channelName || conn.channelId}</span>
                          <button 
                            onClick={() => onRemoveChannel(conn.channelId)}
                            className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove Channel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {/* Add New Channel Dropdown */}
              <div>
                <h4 className="text-md font-medium text-gray-300 mb-2">Add Channel</h4>
                {(guilds.find(g => g.id === modalGuildId)?.channels ?? [])
                  .filter(ch => !connections.some(conn => conn.channelId === ch.id && conn.guildId === modalGuildId))
                  .length === 0 ? (
                     <p className="text-sm text-gray-500 italic">No more available channels to add in this server.</p>
                ) : (
                  <select
                    value={selectedChannel} // Use existing state for selection
                    // Need to update handleChannelSelect to pass the correct guildId/Name
                    onChange={(e) => {
                        const channelId = e.target.value;
                        if (!channelId) return; // Ignore placeholder selection
                        
                        // Find guild and channel details for onAddChannel
                        const guild = guilds.find(g => g.id === modalGuildId);
                        const channel = guild?.channels.find(c => c.id === channelId);
                        
                        // Call parent handler (will also close modal via old handleChannelSelect logic)
                        onAddChannel({
                            guildId: modalGuildId || '', // Should always have modalGuildId here
                            channelId: channelId,
                            guildName: guild?.name, 
                            channelName: channel?.name
                        });
                        // Manually close modal and reset local state
                        handleCloseChannelModal();
                        setSelectedChannel(''); // Reset dropdown
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    disabled={loadingGuilds} // Disable while loading initial guild list
                  >
                    <option value="">-- Select a channel to add --</option>
                    {(guilds.find(g => g.id === modalGuildId)?.channels ?? [])
                      .filter(ch => !connections.some(conn => conn.channelId === ch.id && conn.guildId === modalGuildId))
                      .map((channel) => (
                        <option key={channel.id} value={channel.id}>#{channel.name}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            {/* Modal Footer (Done button) */} 
            <div className="flex justify-end mt-6">
              <button
                onClick={handleCloseChannelModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
          {/* Add simple fade-in/scale animation */} 
          <style>{`
            @keyframes fade-scale-in {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            .animate-fade-scale-in { animation: fade-scale-in 0.3s ease-out forwards; }
          `}</style>
        </div>
      )}
    </div>
  );
}