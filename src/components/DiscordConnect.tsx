import { useState, useEffect } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Save } from 'lucide-react';
import type { AgentDiscordConnection, Agent } from '../types';

interface DiscordConnectProps {
  agentId: string;
  connectionStage: 'initial' | 'enter_credentials' | 'select_server' | 'connected';
  onDisconnect: () => void;
  onConnectToken: (token: string) => Promise<void>;
  onSaveCredentials: (appId: string, publicKey: string) => Promise<void>;
  onSelectServer: (guildId: string | null) => Promise<void>;
  onSelectChannel: (channelId: string | null) => Promise<void>;
  className?: string;
  loading?: boolean;
  disconnecting?: boolean;
  guilds?: any[];
  channels?: any[];
  connection: Partial<AgentDiscordConnection>;
  onActivate: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  onConnectionChange?: (field: keyof AgentDiscordConnection, value: any) => void;
}

export function DiscordConnect({ 
  agentId, 
  connectionStage,
  onDisconnect,
  onConnectToken,
  onSaveCredentials,
  onSelectServer,
  onSelectChannel,
  onActivate,
  onDeactivate,
  onConnectionChange,
  className = '',
  loading: externalLoading,
  disconnecting: externalDisconnecting,
  guilds = [],
  channels = [],
  connection,
}: DiscordConnectProps) {
  
  const [botTokenInput, setBotTokenInput] = useState(''); 
  const [appIdInput, setAppIdInput] = useState('');
  const [publicKeyInput, setPublicKeyInput] = useState('');
  
  const [loading, setLoading] = useState(externalLoading || false);
  const [disconnecting, setDisconnecting] = useState(externalDisconnecting || false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [localTimeout, setLocalTimeout] = useState(connection?.inactivity_timeout_minutes ?? 60);

  // --- State for masked inputs ---
  const MASK_CHAR = '•'; // Use a circle character
  const [localAppId, setLocalAppId] = useState('');
  const [localPublicKey, setLocalPublicKey] = useState('');
  const [isAppIdVisible, setIsAppIdVisible] = useState(false);
  const [isPublicKeyVisible, setIsPublicKeyVisible] = useState(false);

  const [regenerating, setRegenerating] = useState(false);

  // Helper to generate mask string
  const generateMask = (length: number) => MASK_CHAR.repeat(length || 10); // Repeat mask char, default 10 if length 0

  // Sync local display state based on props 
  useEffect(() => {
    setLocalTimeout(connection?.inactivity_timeout_minutes ?? 60);
    // Remove AppId/PublicKey sync - These lines were incorrectly re-added/modified by the previous edit
    // setLocalAppId(discordGuilds?.find(g => g.is_primary)?.app_id || ''); 
    // setLocalPublicKey(discordGuilds?.find(g => g.is_primary)?.public_key || ''); 
    // setIsAppIdVisible(false); 
    // setIsPublicKeyVisible(false); 
  // Correct dependency array
  }, [connection?.inactivity_timeout_minutes]); 

  useEffect(() => {
    // Sync loading states
    if (externalLoading !== undefined) setLoading(externalLoading);
    if (externalDisconnecting !== undefined) setDisconnecting(externalDisconnecting);
  }, [externalLoading, externalDisconnecting]); // Removed externalFetchingGuilds dependency

  // NEW: Sync AppID/Key inputs when connection data changes (e.g., after fetch)
  useEffect(() => {
    setAppIdInput(connection?.discord_app_id || '');
    setPublicKeyInput(connection?.discord_public_key || '');
  }, [connection?.discord_app_id, connection?.discord_public_key]);

  const handleConnectClick = async () => {
    if (!botTokenInput.trim()) {
      setError('Bot token is required.');
      return;
    }
    setError(null);
    try {
      await onConnectToken(botTokenInput);
      setBotTokenInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to connect using token.');
      console.error("Connect error:", err);
    }
  };

  const handleDisconnectBot = async () => {
    console.log("[DiscordConnect] Disconnect button clicked!");
    onDisconnect();
  };

  // NEW: Handler for the "Save Credentials" button
  const handleSaveCredentialsClick = () => {
      if (!appIdInput.trim() || !publicKeyInput.trim()) {
          // Should ideally have inline validation, but alert for now
          alert("Application ID and Public Key cannot be empty.");
          return;
      }
      onSaveCredentials(appIdInput, publicKeyInput);
  };

  // NEW: Handler for server selection change
  const handleServerSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const guildId = event.target.value || null;
      onSelectServer(guildId);
  };

  // NEW: Handler for channel selection change
  const handleChannelSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const channelId = event.target.value || null;
      onSelectChannel(channelId);
  };

  // *** NEW: Restore handleInputChange for timeout ***
  const handleInputChange = (field: keyof AgentDiscordConnection, value: any) => {
    console.log(`[DiscordConnect] InputChange: field=${String(field)}, value=${value}`);
    if (field === 'inactivity_timeout_minutes') {
       const numericValue = parseInt(value, 10);
       // Check if parsing failed (NaN) or if value is not a number we expect
       if (isNaN(numericValue)) {
           console.warn(`[DiscordConnect] Invalid timeout value received: ${value}`);
           return; // Don't update state with invalid input
       }
       setLocalTimeout(numericValue); 
       // Only call onConnectionChange if it exists
       if (onConnectionChange) {
           onConnectionChange(field, numericValue); 
       } 
    } else {
      console.warn(`[DiscordConnect] handleInputChange called for unhandled field: ${String(field)}`);
    }
  };

  // --- NEW: Prepare channels array and find selected channel name ---
  const channelsArray = Array.isArray(channels) ? channels : [];
  const selectedChannelName = channelsArray.find(c => c.id === connection.channel_id)?.name;
  // --- End NEW ---

  // Restore renderWorkerStatus 
  const renderWorkerStatus = () => {
    const status = connection?.worker_status || 'inactive'; 
    let color = 'text-gray-400';
    let text = 'Inactive';
    switch (status) {
      case 'active': color = 'text-green-400'; text = 'Active'; break;
      case 'activating': color = 'text-yellow-400'; text = 'Activating...'; break;
      case 'stopping': color = 'text-yellow-400'; text = 'Stopping...'; break;
      case 'error': color = 'text-red-400'; text = 'Error'; break;
    }
    return <span className={`font-medium ${color}`}>{text}</span>;
  };

  // *** NEW: Calculate status badge class dynamically ***
  let statusBadgeClass = 'bg-gray-600 text-gray-300'; // Default
  if (connection.worker_status === 'active') {
    statusBadgeClass = 'bg-green-900/50 text-green-300';
  } else if (connection.worker_status === 'activating' || connection.worker_status === 'stopping') {
    statusBadgeClass = 'bg-yellow-900/50 text-yellow-300';
  } else if (connection.worker_status === 'error') {
    statusBadgeClass = 'bg-red-900/50 text-red-300';
  }

  return (
    <div className={`space-y-4 ${className}`}>
      
      {/* Stage 1: Initial - Enter Token */} 
      {connectionStage === 'initial' && (
        <div className="flex items-end space-x-2">
          <div className="flex-grow">
            <label htmlFor="botToken" className="block text-sm font-medium text-gray-300 mb-1">Discord Bot Token</label>
              <input
                type="password"
                id="botToken"
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
                placeholder="Enter your bot token"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
          </div>
          <button 
            type="button"
            onClick={handleConnectClick} // Triggers token save and stage change
            disabled={loading || !botTokenInput.trim()}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Bot size={18} className="mr-2" />}
            Connect Token
          </button>
        </div>
      )}

      {/* Stage 2: Enter Credentials */} 
      {connectionStage === 'enter_credentials' && (
        <div className="space-y-4 pt-4 border-t border-gray-600">
            {/* Keep Bot Token Displayed (Readonly/Disabled) */} 
            <div>
                 <label className="block text-sm font-medium text-gray-400 mb-1">Discord Bot Token</label>
                 <div className="flex items-center space-x-2 bg-gray-700 p-3 rounded-md">
                    <Bot className="text-green-400" size={20} />
                    <span className="text-white font-medium flex-grow">Bot Token Connected</span> 
                    <Check className="text-green-400" size={16} />
                 </div>
            </div>
            {/* App ID Input */} 
            <div>
              <label htmlFor="appIdCred" className="block text-sm font-medium text-gray-300 mb-1">Application ID *</label>
              <input
                type="text" id="appIdCred" required value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)} disabled={loading}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder="Paste Application ID here"
              />
            </div>
            {/* Public Key Input */} 
            <div>
              <label htmlFor="publicKeyCred" className="block text-sm font-medium text-gray-300 mb-1">Public Key *</label>
              <input
                type="text" id="publicKeyCred" required value={publicKeyInput}
                onChange={(e) => setPublicKeyInput(e.target.value)} disabled={loading}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder="Paste Public Key here"
              />
             <p className="mt-1 text-xs text-gray-400">
              Find these in the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Discord Developer Portal</a>.
             </p>
            </div>
             {/* Save Credentials Button */} 
             <button 
                type="button"
                onClick={handleSaveCredentialsClick} 
                disabled={loading || !appIdInput.trim() || !publicKeyInput.trim()}
                // Use standard button styling 
                className="w-full flex justify-center items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
                Save Credentials & Select Server
             </button>
        </div>
      )}

      {/* Stage 3 & 4: Select Server / Connected */} 
      {(connectionStage === 'select_server' || connectionStage === 'connected') && (
        <div className="space-y-4">
             {/* Combined Connected Status */} 
             <div className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
               <div className="flex items-center space-x-2">
                 <Check className="text-green-400" size={20} />
                 <span className="text-white font-medium">Discord Connected</span>
               </div>
               <button
                 type="button"
                 onClick={onDisconnect} // Use direct prop
                 disabled={disconnecting}
                 className="flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {disconnecting ? <Loader2 className="animate-spin mr-1" size={16} /> : <X size={16} className="mr-1"/>}
                 Disconnect
               </button>
            </div>
            
            {/* Server Selection Dropdown */} 
            <div className="pt-4 border-t border-gray-600">
                <label htmlFor="guildSelect" className="block text-sm font-medium text-gray-300 mb-1">Selected Server</label>
                <select
                    id="guildSelect"
                    value={connection.guild_id ?? ''} 
                    onChange={handleServerSelectChange} // Saves selection on change
                    disabled={loading || disconnecting || guilds.length === 0}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                 >
                    <option value="">
                      {loading ? 'Loading Servers...' : (guilds.length === 0 ? 'No Servers Found' : '-- Select a Server --')}
                    </option>
                    {guilds.map(guild => (
                      <option key={guild.id} value={guild.id}>
                        {guild.name}
                      </option>
                    ))}
                 </select>
                 {/* Channel Selection Dropdown */} 
                 <div className="mt-4">
                   <label htmlFor="channelSelect" className="block text-sm font-medium text-gray-300 mb-1">Selected Channel (Optional)</label>
                   <select
                       id="channelSelect"
                       value={connection.channel_id ?? ''} 
                       onChange={handleChannelSelectChange} // Saves selection on change
                       disabled={loading || disconnecting || !connection.guild_id || channelsArray.length === 0}
                       className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                   >
                       <option value="">{channelsArray.length === 0 ? 'No channels found' : '-- Select a Channel --'}</option>
                       {channelsArray.map(channel => (
                         <option key={channel.id} value={channel.id}>
                           {channel.name}
                         </option>
                       ))}
                   </select>
                 </div>
            </div>

            {/* *** NEW: Restore Inactivity Timeout Section with new options *** */}
            <div className="mt-4">
              <label htmlFor="inactivityTimeout" className="block text-sm font-medium text-gray-300 mb-1">Inactivity Timeout</label>
              <select
                id="inactivityTimeout"
                // Use localTimeout state, default to 60 if undefined/null
                value={localTimeout ?? 60}
                onChange={(e) => handleInputChange('inactivity_timeout_minutes', e.target.value)}
                disabled={loading || disconnecting}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value={10}>10 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={0}>Never</option> {/* Use value="0" for Never */}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Automatically disconnect the bot after this period of inactivity.
              </p>
            </div>

            {/* Connection Status (Keep) */} 
             <div>
               <p className="text-sm text-gray-300">Worker Status: {renderWorkerStatus()}</p>
             </div>

            {/* Worker Status & Activate/Deactivate Button */} 
            <div className="pt-4 border-t border-gray-600">
               <label className="block text-sm font-medium text-gray-300 mb-1">Agent Status</label>
               <div className="flex items-center justify-between space-x-4">
                 <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass}`}> 
                     {connection.worker_status ? connection.worker_status.charAt(0).toUpperCase() + connection.worker_status.slice(1) : 'Unknown'}
                 </span>

                 {connection.worker_status === 'active' || connection.worker_status === 'stopping' ? ( // Show Deactivate if active or stopping
                     <button
                         type="button"
                         onClick={onDeactivate}
                         disabled={loading || disconnecting || connection.worker_status === 'stopping'}
                         className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                         {loading || connection.worker_status === 'stopping' ? <Loader2 className="animate-spin mr-2" size={16} /> : <X className="mr-2" size={16}/>}
                         {connection.worker_status === 'stopping' ? 'Stopping...' : 'Deactivate'}
                     </button>
                 ) : ( // Otherwise show Activate (inactive, error, activating, or unknown)
                     <button
                         type="button"
                         onClick={onActivate}
                         // Disable activate if activating, no server selected, or disconnecting
                         disabled={loading || disconnecting || connection.worker_status === 'activating' || !connection.guild_id}
                         className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                         title={!connection.guild_id ? "Select a server first" : "Activate Agent"} // Add title
                     >
                         {loading || connection.worker_status === 'activating' ? <Loader2 className="animate-spin mr-2" size={16} /> : <Bot className="mr-2" size={16}/>}
                         {connection.worker_status === 'activating' ? 'Activating...' : 'Activate Agent'}
                     </button>
                 )}
               </div>
            </div>

        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

    </div>
  );
}