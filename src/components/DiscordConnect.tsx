import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Save, Server, Settings, Link as LinkIcon, Play, StopCircle } from 'lucide-react';
import type { AgentDiscordConnection } from '../types';

// --- Props Interface Aligned with Plan Phase 7 ---
interface DiscordConnectProps {
  connection: Partial<AgentDiscordConnection>;
  botKey: string;
  onBotKeyChange: (key: string) => void;
  onConnectionChange: (field: keyof AgentDiscordConnection, value: any) => void;
  discord_app_id?: string;
  onManageServers: () => void;
  onGenerateInviteLink: () => void;
  isGeneratingInvite: boolean;
  workerStatus?: AgentDiscordConnection['worker_status'];
  onActivate: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  isActivating: boolean;
  isDeactivating: boolean;
  className?: string;
}

function DiscordConnectComponent({ 
  connection,
  botKey,
  onBotKeyChange,
  onConnectionChange,
  discord_app_id,
  onManageServers,
  onGenerateInviteLink,
  isGeneratingInvite,
  workerStatus,
  onActivate,
  onDeactivate,
  isActivating,
  isDeactivating,
  className = '',
}: DiscordConnectProps) {
  
  const [localTimeout, setLocalTimeout] = useState(connection?.inactivity_timeout_minutes ?? 10);
  
  const MASK_CHAR = '•';
  const [isBotKeyVisible, setIsBotKeyVisible] = useState(false);
  const [isAppIdVisible, setIsAppIdVisible] = useState(false);
  const [isPublicKeyVisible, setIsPublicKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalTimeout(connection?.inactivity_timeout_minutes ?? 10);
  }, [connection?.inactivity_timeout_minutes]); 

  const handleTimeoutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setLocalTimeout(numericValue);
      onConnectionChange('inactivity_timeout_minutes', numericValue);
    } else if (value === '') {
       setLocalTimeout(0);
       onConnectionChange('inactivity_timeout_minutes', 0);
    }
  };

  const handleBotKeyInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onBotKeyChange(newValue);
  };

  const renderWorkerStatus = () => {
    const status = workerStatus || 'inactive'; 
    let icon = <StopCircle size={16} />;
    let text = 'Inactive';
    switch (status) {
      case 'active': text = 'Active'; icon = <Check size={16} />; break;
      case 'activating': text = 'Activating...'; icon = <Loader2 size={16} className="animate-spin" />; break;
      case 'stopping': text = 'Stopping...'; icon = <Loader2 size={16} className="animate-spin" />; break;
      case 'error': text = 'Error'; icon = <X size={16} />; break;
      case 'inactive':
      default: text = 'Inactive'; icon = <StopCircle size={16} />; break;
    }
    return (
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

  const copyToClipboard = (text: string | undefined | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

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
                    disabled={!canActivate || isActivating || isDeactivating || workerStatus === 'active' || workerStatus === 'activating'}
                    title={!canActivate ? "Enter Bot Token, App ID, and Public Key first" : "Start the Discord bot worker"}
                    className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isActivating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Play size={16} className="mr-2" />}
                    Activate
                </button>
                <button
                    type="button"
                    onClick={onDeactivate}
                    disabled={isDeactivating || isActivating || workerStatus === 'inactive'}
                    title={workerStatus === 'inactive' ? "Agent is already inactive" : "Stop the Discord bot worker"}
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
            {/* Bot Token Input */}
            <div>
              <label htmlFor="botTokenKey" className="block text-sm font-medium text-gray-300 mb-1">Discord Bot Token *</label>
              <div className="flex items-center space-x-2">
                <input
                    id="botTokenKey"
                    type={isBotKeyVisible ? 'text' : 'password'}
                    value={botKey}
                    onChange={handleBotKeyInputChange}
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

            {/* App ID Input (Readonly) */}
            <div>
              <label htmlFor="appIdDisplay" className="block text-sm font-medium text-gray-300 mb-1">Application ID *</label>
              <div className="flex items-center space-x-2">
                  <input
                    id="appIdDisplay"
                    type={isAppIdVisible ? 'text' : 'password'}
                    readOnly
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

            {/* Public Key Input (Readonly) */}
            <div>
              <label htmlFor="publicKeyDisplay" className="block text-sm font-medium text-gray-300 mb-1">Public Key *</label>
               <div className="flex items-center space-x-2">
                  <input
                    id="publicKeyDisplay"
                    type={isPublicKeyVisible ? 'text' : 'password'}
                    readOnly
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

             {/* Interaction Endpoint URL (Readonly) */}
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
                     id="inactivityTimeout"
                     type="number"
                     value={localTimeout}
                     onChange={handleTimeoutChange}
                     min="1"
                     className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 />
                 <p className="mt-1 text-xs text-gray-400">Time before the agent worker stops due to inactivity.</p>
             </div>
             
             {/* Management Buttons */}
             <div className="flex space-x-3 pt-3">
                 <button
                    type="button"
                    onClick={onManageServers}
                    className="flex items-center justify-center flex-grow px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors text-sm font-medium"
                 >
                    <Settings size={16} className="mr-2" />
                    Manage Servers
                 </button>
                 <button
                    type="button"
                    onClick={onGenerateInviteLink}
                    disabled={!discord_app_id || isGeneratingInvite}
                    title={!discord_app_id ? "Enter Application ID first" : "Generate bot invite link"}
                    className="flex items-center justify-center flex-grow px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {isGeneratingInvite ? <Loader2 className="animate-spin mr-2" size={16} /> : <LinkIcon size={16} className="mr-2" />}
                    Generate Invite
                 </button>
             </div>

        </div>
    </div>
  );
}

// Export the memoized version
export const DiscordConnect = React.memo(DiscordConnectComponent);

// Or alternatively, directly wrap the function expression if you prefer:
/*
export const DiscordConnect = React.memo(function DiscordConnect({ 
  // ... props ... 
}: DiscordConnectProps) {
  // ... component logic ... 
});
*/