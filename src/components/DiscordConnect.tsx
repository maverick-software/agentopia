import { useState, useEffect } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw } from 'lucide-react';
import type { AgentDiscordConnection, Agent } from '../types';

interface DiscordConnectProps {
  agentId: string;
  isConnected: boolean;
  onDisconnect: () => void;
  onConnect: (token: string) => Promise<void>;
  className?: string;
  loading?: boolean;
  disconnecting?: boolean;
  fetchingGuilds?: boolean;
  onFetchGuilds?: () => void;
  connection: Partial<AgentDiscordConnection>;
  onConnectionChange: (field: keyof AgentDiscordConnection, value: any) => void;
  interactionEndpointUrl: string;
  discordGuilds?: any[];
  onAgentDetailChange?: (field: 'discord_app_id' | 'discord_public_key', value: string) => void;
  onRegenerateSecret?: () => Promise<void>;
}

export function DiscordConnect({ 
  agentId, 
  isConnected,
  onDisconnect,
  onConnect,
  className = '',
  loading: externalLoading,
  disconnecting: externalDisconnecting,
  fetchingGuilds: externalFetchingGuilds,
  onFetchGuilds: externalOnFetchGuilds,
  connection,
  onConnectionChange,
  interactionEndpointUrl,
  discordGuilds,
  onAgentDetailChange,
  onRegenerateSecret,
}: DiscordConnectProps) {
  
  const [botTokenInput, setBotTokenInput] = useState(''); 
  
  const [loading, setLoading] = useState(externalLoading || false);
  const [disconnecting, setDisconnecting] = useState(externalDisconnecting || false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [localTimeout, setLocalTimeout] = useState(10);

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
    setLocalTimeout(connection?.inactivity_timeout_minutes || 10);
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

  const handleConnectClick = async () => {
    if (!botTokenInput.trim()) {
      setError('Bot token is required.');
      return;
    }
    setError(null);
    try {
      await onConnect(botTokenInput);
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

  const handleInputChange = (field: keyof AgentDiscordConnection, value: any) => {
    console.log(`[DiscordConnect] InputChange: field=${String(field)}, value=${value}`);
    
    if (field === 'discord_app_id') {
       setLocalAppId(value); // Update local value directly
    } else if (field === 'discord_public_key') {
       setLocalPublicKey(value); // Update local value directly
    } else if (field === 'inactivity_timeout_minutes') {
       const numericValue = parseInt(value, 10) || 10;
       setLocalTimeout(numericValue); 
       value = numericValue; 
    }
    
    if (onConnectionChange) {
        onConnectionChange(field, value); // Propagate change up to AgentEdit
    } 
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(interactionEndpointUrl)
      .then(() => {
        console.log('Interaction URL copied!');
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
      });
  };

  const handleRegenerateClick = async () => {
    if (!onRegenerateSecret) return;
    setRegenerating(true);
    try {
      await onRegenerateSecret();
    } catch (e) {
      console.error("Regeneration failed (error caught in DiscordConnect)", e);
    } finally {
      setRegenerating(false);
    }
  };

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

  // Determine if the full connection (App ID, Key) is established based on props
  const isFullyConnected = !!(isConnected && connection.discord_app_id && connection.discord_public_key);

  // --- NEW: Find selected guild name ---
  // Ensure discordGuilds is treated as an array
  const guildsArray = Array.isArray(discordGuilds) ? discordGuilds : [];
  const selectedGuildName = guildsArray.find(g => g.id === connection.guild_id)?.name;
  // --- End NEW ---

  return (
    <div className={`space-y-4 ${className}`}>
      {isConnected ? (
        <div className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
          <div className="flex items-center space-x-2">
            <Bot className="text-green-400" size={20} />
            <span className="text-white font-medium">Bot Token Connected</span>
            <Check className="text-green-400" size={16} />
        </div>
           <button
            type="button"
              onClick={handleDisconnectBot}
              disabled={disconnecting}
            className="flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disconnecting ? <Loader2 className="animate-spin mr-1" size={16} /> : <X size={16} className="mr-1"/>}
            Disconnect
            </button>
        </div>
      ) : (
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
            onClick={handleConnectClick}
            disabled={loading || !botTokenInput.trim()}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Bot size={18} className="mr-2" />}
            Connect
             </button>
        </div>
      )}
      
      {isConnected && (
        <div className="space-y-4 pt-4 border-t border-gray-600">
          {isFullyConnected ? (
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-sm text-green-400 font-medium mb-2">Application Details Connected</p>
              {selectedGuildName ? (
                 <p className="text-xs text-gray-300">Connected Server: {selectedGuildName} <span className='text-gray-500'>(ID: {connection.guild_id})</span></p>
                 // TODO: Add Channel display if needed
              ) : connection.guild_id ? (
                 <p className="text-xs text-yellow-400">Connected Server ID: {connection.guild_id} (Name not found)</p>
              ) : (
                 <p className="text-xs text-yellow-400">Server not selected yet. (Check modal flow)</p>
              )}
            </div>
           ) : (
             <div className="bg-gray-900 p-3 rounded">
                <p className="text-sm text-yellow-400 font-medium">Application details needed.</p>
                <p className="text-xs text-gray-400">After connecting the token, follow the prompts to enter the Application ID and Public Key.</p>
             </div>
           )}
            
          <div className="bg-gray-900 p-3 rounded">
             <p className="text-sm text-gray-300 mb-2">
                For the <code className="bg-gray-700 px-1 py-0.5 rounded text-xs">/activate</code> command to work, you **must** set this URL in your Discord Application's 'Interaction Endpoint URL' setting:
             </p>
             <div className="flex items-center space-x-2 bg-gray-700 p-2 rounded">
                <input 
                    type="text" 
                    readOnly 
                    value={interactionEndpointUrl} 
                    className="flex-grow px-2 py-1 bg-gray-600 border border-gray-500 rounded text-gray-200 text-sm truncate"
                />
                          <button 
                    type="button" 
                    onClick={handleCopyUrl}
                    className={`p-1 rounded transition-colors duration-150 ${copied ? 'text-green-500 bg-green-900/50' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                    title={copied ? "Copied!" : "Copy URL"}
                    disabled={copied}
                 >
                    {copied ? <Check size={16}/> : <Copy size={16}/>}
                          </button>
             </div>
              </div>

              <div>
            <label htmlFor="inactivityTimeout" className="block text-sm font-medium text-gray-300 mb-1">Inactivity Timeout</label>
                  <select
              id="inactivityTimeout"
              value={localTimeout}
              onChange={(e) => handleInputChange('inactivity_timeout_minutes', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={10}>10 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
                  </select>
            <p className="mt-1 text-xs text-gray-400">Automatically disconnect the bot after this period of inactivity to save resources.</p>
            </div>

          <div>
            <p className="text-sm text-gray-300">Connection Status: {renderWorkerStatus()}</p>
          </div>
          
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

    </div>
  );
}