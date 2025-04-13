import { useState, useEffect } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink } from 'lucide-react';
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
  discordAppId?: string;
  discordPublicKey?: string;
  onAgentDetailChange: (field: 'discord_app_id' | 'discord_public_key', value: string) => void;
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
  discordAppId,
  discordPublicKey,
  onAgentDetailChange
}: DiscordConnectProps) {
  
  const [botTokenInput, setBotTokenInput] = useState(''); 
  
  const [loading, setLoading] = useState(externalLoading || false);
  const [disconnecting, setDisconnecting] = useState(externalDisconnecting || false);
  const [error, setError] = useState<string | null>(null);

  const [localTimeout, setLocalTimeout] = useState(10);

  // --- Local state for masked inputs ---
  const MASKED_VALUE = '**********';
  const [localAppId, setLocalAppId] = useState('');
  const [localPublicKey, setLocalPublicKey] = useState('');

  // Sync local display state based on props
  useEffect(() => {
    setLocalTimeout(connection?.inactivity_timeout_minutes || 10);
    // Set local display based on whether prop has value
    setLocalAppId(discordAppId ? MASKED_VALUE : '');
    setLocalPublicKey(discordPublicKey ? MASKED_VALUE : '');
  }, [connection, discordAppId, discordPublicKey]); // Re-run if props change

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
    onDisconnect();
  };

  const handleInputChange = (field: keyof AgentDiscordConnection | 'discord_app_id' | 'discord_public_key', value: any) => {
    console.log(`[DiscordConnect] InputChange: field=${String(field)}, value=${value}`);
    
    if (field === 'inactivity_timeout_minutes') {
      const numericValue = parseInt(value, 10);
      setLocalTimeout(numericValue);
      if (onConnectionChange) {
          onConnectionChange(field, numericValue);
      } 
    } else if (field === 'discord_app_id') {
       // Update local state directly with typed value
       setLocalAppId(value); 
       // Call parent handler with actual value
       if (onAgentDetailChange) {
          onAgentDetailChange(field, value);
       } 
    } else if (field === 'discord_public_key') {
       // Update local state directly with typed value
       setLocalPublicKey(value);
       // Call parent handler with actual value
       if (onAgentDetailChange) {
          onAgentDetailChange(field, value);
       } 
    }
  };

  // Handle focus: clear local state if it was masked
  const handleFocus = (field: 'discord_app_id' | 'discord_public_key') => {
     if (field === 'discord_app_id' && localAppId === MASKED_VALUE) {
        setLocalAppId('');
     } else if (field === 'discord_public_key' && localPublicKey === MASKED_VALUE) {
        setLocalPublicKey('');
     }
  };

  // Handle blur: re-mask if parent has value
  const handleBlur = (field: 'discord_app_id' | 'discord_public_key') => {
    if (field === 'discord_app_id') {
       // Check the prop value passed from parent
       if (discordAppId) {
         setLocalAppId(MASKED_VALUE);
       } else {
         // If prop is empty (e.g., user cleared input and saved), keep local empty
         setLocalAppId(''); 
       }
    } else if (field === 'discord_public_key') {
       if (discordPublicKey) {
         setLocalPublicKey(MASKED_VALUE);
       } else {
         setLocalPublicKey('');
       }
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(interactionEndpointUrl)
      .then(() => {
        console.log('Interaction URL copied!');
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
      });
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
          <div>
            <label htmlFor="discordAppId" className="block text-sm font-medium text-gray-300 mb-1">Discord Application ID *</label>
            <input
              type="text"
              id="discordAppId"
              required
              value={localAppId}
              onChange={(e) => handleInputChange('discord_app_id', e.target.value)}
              onFocus={() => handleFocus('discord_app_id')}
              onBlur={() => handleBlur('discord_app_id')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={discordAppId ? 'Click to edit Application ID' : 'Paste Application ID here'}
            />
          </div>
          <div>
            <label htmlFor="discordPublicKey" className="block text-sm font-medium text-gray-300 mb-1">Discord Public Key *</label>
            <input
              type="text"
              id="discordPublicKey"
              required
              value={localPublicKey}
              onChange={(e) => handleInputChange('discord_public_key', e.target.value)}
              onFocus={() => handleFocus('discord_public_key')}
              onBlur={() => handleBlur('discord_public_key')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={discordPublicKey ? 'Click to edit Public Key' : 'Paste Public Key here'}
            />
            <p className="mt-1 text-xs text-gray-400">
              Find these in the 
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline mx-1">
                Discord Developer Portal
                <ExternalLink size={12} className="inline ml-1"/>
              </a> 
              under General Information.
            </p>
            </div>
            
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
                    className="p-1 text-gray-400 hover:text-white"
                    title="Copy URL"
                 >
                    <Copy size={16}/>
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