import { useState, useEffect } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Save, Server, Settings, Link as LinkIcon, Play, StopCircle } from 'lucide-react';
import type { AgentDiscordConnection } from '../types';

// --- Props Interface Aligned with Plan Phase 7 ---
interface DiscordConnectProps {
  connection: Partial<AgentDiscordConnection>; // Existing: pass connection details
  botKey: string; // New: Passed from AgentEdit state
  onBotKeyChange: (key: string) => void; // New: Handler to update bot key in AgentEdit
  onConnectionChange: (field: keyof AgentDiscordConnection, value: any) => void; // Existing: For timeout changes
  discord_app_id?: string; // New: Pass explicitly for invite link
  onManageServers: () => void; // New: Callback to open modal in AgentEdit
  onGenerateInviteLink: () => void; // New: Callback to generate invite
  isGeneratingInvite: boolean; // New: Loading state for invite link
  workerStatus?: AgentDiscordConnection['worker_status']; // New: Pass status explicitly
  onActivate: () => Promise<void>; // Existing: Activation callback
  onDeactivate: () => Promise<void>; // Existing: Deactivation callback
  isActivating: boolean; // New: Activation loading state
  isDeactivating: boolean; // New: Deactivation loading state
  className?: string;
  // Removed: guilds, onSelectServer, onDisconnect (part of old single-server logic)
}

export function DiscordConnect({ 
  connection,
  botKey, // Use passed prop
  onBotKeyChange, // Use passed prop
  onConnectionChange,
  discord_app_id, // Use passed prop
  onManageServers, // Use passed prop
  onGenerateInviteLink, // Use passed prop
  isGeneratingInvite, // Use passed prop
  workerStatus, // Use passed prop
  onActivate,
  onDeactivate,
  isActivating, // Use passed prop
  isDeactivating, // Use passed prop
  className = '',
}: DiscordConnectProps) {
  
  // --- State for Input Values (derived from props) ---
  // Local timeout state is fine
  const [localTimeout, setLocalTimeout] = useState(connection?.inactivity_timeout_minutes ?? 10);
  // Remove localBotKey state, use botKey prop directly
  // const [localBotKey, setLocalBotKey] = useState(botKey || '');

  // --- State for Masked Inputs & Visibility ---
  const MASK_CHAR = '•';
  const [isBotKeyVisible, setIsBotKeyVisible] = useState(false);
  const [isAppIdVisible, setIsAppIdVisible] = useState(false);
  const [isPublicKeyVisible, setIsPublicKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null); // Keep local error state

  // Helper to generate mask string
  // const generateMask = (length: number) => MASK_CHAR.repeat(length || 10); // Unused, remove?

  // --- Sync local state with props --- 
  useEffect(() => {
    setLocalTimeout(connection?.inactivity_timeout_minutes ?? 10);
  }, [connection?.inactivity_timeout_minutes]); 

  // Remove useEffect for localBotKey, it now comes directly from props
  // useEffect(() => {
  //   setLocalBotKey(botKey || '');
  //   setIsBotKeyVisible(false); // Reset visibility when key changes
  // }, [botKey]);

  // --- Handlers ---
  const handleTimeoutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setLocalTimeout(numericValue);
      onConnectionChange('inactivity_timeout_minutes', numericValue);
    } else if (value === '') {
       setLocalTimeout(0); // Allow clearing the input
       onConnectionChange('inactivity_timeout_minutes', 0);
    }
  };

  // Use onBotKeyChange directly
  const handleBotKeyInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      // Directly call the handler passed from AgentEdit to update the actual state
      onBotKeyChange(newValue);
  };

  // No longer needed:
  // handleConnectClick, handleDisconnectBot, handleSaveCredentialsClick, handleServerSelectChange

  const renderWorkerStatus = () => {
    const status = workerStatus || 'inactive'; 
    let color = 'text-gray-400'; // Default color removed, handled by badge class
    let text = 'Inactive';
    let icon = <StopCircle size={16} />; // Default icon updated
    switch (status) {
      case 'active': text = 'Active'; icon = <Check size={16} />; break;
      case 'activating': text = 'Activating...'; icon = <Loader2 size={16} className="animate-spin" />; break;
      case 'stopping': text = 'Stopping...'; icon = <Loader2 size={16} className="animate-spin" />; break;
      case 'error': text = 'Error'; icon = <X size={16} />; break;
      case 'inactive':
      default: text = 'Inactive'; icon = <StopCircle size={16} />; break;
    }
    return (
        // Use statusBadgeClass for background/text color
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass()}`}>
            {icon}
            <span>{text}</span>
        </div>
    );
  };

  const statusBadgeClass = () => {
    const status = workerStatus || 'inactive'; 
    switch (status) {
      case 'active': return 'bg-green-900/50 text-green-300';
      case 'activating':
      case 'stopping': return 'bg-yellow-900/50 text-yellow-300';
      case 'error': return 'bg-red-900/50 text-red-300';
      case 'inactive':
      default: return 'bg-gray-600 text-gray-300';
    }
  };

  const copyToClipboard = (text: string | undefined | null) => { // Allow null
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Updated activation condition based on passed props
  const canActivate = !!discord_app_id && !!connection?.discord_public_key && !!botKey;

  return (
    <div className={`space-y-6 ${className}`}>
        {/* Connection Status & Activation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
            {renderWorkerStatus()}
            <div className="flex items-center space-x-2">
                <button
                    type="button"
                    onClick={onActivate}
                    // Updated disabled logic based on props
                    disabled={!canActivate || isActivating || isDeactivating || workerStatus === 'active' || workerStatus === 'activating'}
                    className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isActivating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Play size={16} className="mr-2" />}
                    Activate
                </button>
                <button
                    type="button"
                    onClick={onDeactivate}
                    // Updated disabled logic based on props
                    disabled={isDeactivating || isActivating || workerStatus === 'inactive' || workerStatus === 'stopping'}
                    className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDeactivating ? <Loader2 className="animate-spin mr-2" size={16} /> : <StopCircle size={16} className="mr-2" />}
                    Deactivate
                </button>
            </div>
        </div>
        {!canActivate && workerStatus === 'inactive' && (
             <p className="text-xs text-yellow-400">
                Enter Bot Token, App ID, and Public Key (and save agent) before activating.
             </p>
        )}
        {error && <p className="text-sm text-red-400">Error: {error}</p>}

        {/* Credentials and Settings */} 
        <div className="space-y-4 pt-4 border-t border-gray-600">
             {/* Bot Token Input - Use botKey prop */}
             <div>
              <label htmlFor="botTokenKey" className="block text-sm font-medium text-gray-300 mb-1">Discord Bot Token *</label>
              <div className="flex items-center space-x-2">
                <input
                    id="botTokenKey"
                    type={isBotKeyVisible ? 'text' : 'password'}
                    value={botKey} // Use prop directly
                    onChange={handleBotKeyInputChange} // Calls prop handler
                    placeholder="Paste Bot Token here"
                    required
                    className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="button" onClick={() => setIsBotKeyVisible(!isBotKeyVisible)} className="p-2 text-gray-400 hover:text-white">
                    {isBotKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button type="button" onClick={() => copyToClipboard(botKey)} className="p-2 text-gray-400 hover:text-white">
                    {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* App ID Input (Readonly Display - Value from connection prop) */}
            <div>
              <label htmlFor="appIdDisplay" className="block text-sm font-medium text-gray-300 mb-1">Application ID *</label>
              <div className="flex items-center space-x-2">
                  <input
                    id="appIdDisplay"
                    type={isAppIdVisible ? 'text' : 'password'}
                    readOnly // Value still comes from AgentEdit form via connection prop
                    value={connection?.discord_app_id || ''}
                    placeholder="Save in Agent form"
                    className="flex-grow px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400 cursor-not-allowed"
                  />
                  <button type="button" onClick={() => setIsAppIdVisible(!isAppIdVisible)} className="p-2 text-gray-400 hover:text-white">
                      {isAppIdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button type="button" onClick={() => copyToClipboard(connection?.discord_app_id)} className="p-2 text-gray-400 hover:text-white">
                    {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18} />}
                  </button>
              </div>
            </div>

            {/* Public Key Input (Readonly Display - Value from connection prop) */}
            <div>
              <label htmlFor="publicKeyDisplay" className="block text-sm font-medium text-gray-300 mb-1">Public Key *</label>
               <div className="flex items-center space-x-2">
                  <input
                    id="publicKeyDisplay"
                    type={isPublicKeyVisible ? 'text' : 'password'}
                    readOnly // Value still comes from AgentEdit form via connection prop
                    value={connection?.discord_public_key || ''}
                    placeholder="Save in Agent form"
                    className="flex-grow px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400 cursor-not-allowed"
                  />
                   <button type="button" onClick={() => setIsPublicKeyVisible(!isPublicKeyVisible)} className="p-2 text-gray-400 hover:text-white">
                       {isPublicKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                   </button>
                   <button type="button" onClick={() => copyToClipboard(connection?.discord_public_key)} className="p-2 text-gray-400 hover:text-white">
                    {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18} />}
                  </button>
                </div>
            </div>

             {/* Interaction Endpoint URL */}
             <div>
                 <label className="block text-sm font-medium text-gray-300 mb-1">Interaction Endpoint URL</label>
                 <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        readOnly
                        value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`}
                        className="flex-grow px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400"
                    />
                     <button type="button" onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`)} className="p-2 text-gray-400 hover:text-white">
                        {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18} />}
                     </button>
                 </div>
                 <p className="mt-1 text-xs text-gray-400">
                    Copy this URL into the "Interactions Endpoint URL" field in your <a href={`https://discord.com/developers/applications/${discord_app_id || ''}/information`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Discord App settings</a>.
                 </p>
             </div>

            {/* Inactivity Timeout */}
            <div>
              <label htmlFor="inactivityTimeout" className="block text-sm font-medium text-gray-300 mb-1">Inactivity Timeout (minutes)</label>
              <input
                type="number"
                id="inactivityTimeout"
                value={localTimeout}
                onChange={handleTimeoutChange}
                min="1"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">Time before the agent worker stops due to inactivity.</p>
            </div>
        </div>

        {/* Server Management & Invite Link - Use new props */}
        <div className="flex flex-wrap items-center justify-start gap-4 pt-4 border-t border-gray-600">
             <button 
                type="button"
                onClick={onManageServers} // Use passed handler
                disabled={isActivating || isDeactivating} // Disable if worker is changing state
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Server size={18} className="mr-2" />
                Manage Servers
             </button>
              <button 
                type="button"
                onClick={onGenerateInviteLink} // Use passed handler
                disabled={!discord_app_id || isGeneratingInvite} // Use passed props for condition
                className="flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isGeneratingInvite ? <Loader2 className="animate-spin mr-2" size={18} /> : <LinkIcon size={18} className="mr-2" />}
                Generate Invite Link
             </button>
        </div>
    </div>
  );
}