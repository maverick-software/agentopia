import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Save, Server, Settings, Link as LinkIcon, Play, StopCircle, Trash2, Key, Edit } from 'lucide-react';
import type { AgentDiscordConnection } from '../types';

interface BotGuild {
  id: string;
  name: string;
}

// --- Props Interface Aligned with Plan Phase 7 ---
interface DiscordConnectProps {
  connection: Partial<AgentDiscordConnection>;
  botKey: string;
  onBotKeyChange: (key: string) => void;
  onConnectionChange: (field: keyof AgentDiscordConnection | 'guild_id' | 'discord_app_id' | 'discord_public_key', value: any) => void;
  discord_app_id?: string;
  onGenerateInviteLink: () => void;
  isGeneratingInvite: boolean;
  workerStatus?: AgentDiscordConnection['worker_status'];
  onActivate: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  isActivating: boolean;
  isDeactivating: boolean;
  className?: string;
  allGuilds: BotGuild[];
  currentGuildId?: string | null;
}

// Define timeout options
const TIMEOUT_OPTIONS = [
  { label: '10 minutes', value: 10 },
  { label: '20 minutes', value: 20 },
  { label: '30 minutes', value: 30 },
  { label: 'Never', value: 0 }, // Map 'Never' to 0
];

function DiscordConnectComponent({ 
  connection,
  botKey,
  onBotKeyChange,
  onConnectionChange,
  discord_app_id,
  onGenerateInviteLink,
  isGeneratingInvite,
  workerStatus,
  onActivate,
  onDeactivate,
  isActivating,
  isDeactivating,
  className = '',
  allGuilds,
  currentGuildId
}: DiscordConnectProps) {
  
  // --- State ---
  const [showFullUI, setShowFullUI] = useState(!!botKey); // NEW: Controls overall UI display
  const [initialBotKey, setInitialBotKey] = useState(''); // NEW: For the initial token input

  // Modal States
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false); // NEW: For save state

  // Local state for modal inputs (to avoid prop drilling complexities for simple inputs)
  const [modalBotKey, setModalBotKey] = useState(botKey);
  const [modalAppId, setModalAppId] = useState(connection?.discord_app_id || '');
  const [modalPublicKey, setModalPublicKey] = useState(connection?.discord_public_key || '');

  // Update local modal state when props change (e.g., after external save)
  useEffect(() => { 
    setModalBotKey(botKey); 
    setShowFullUI(!!botKey); // NEW: Ensure UI state matches prop
  }, [botKey]);
  useEffect(() => { setModalAppId(connection?.discord_app_id || ''); }, [connection?.discord_app_id]);
  useEffect(() => { setModalPublicKey(connection?.discord_public_key || ''); }, [connection?.discord_public_key]);

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

  // --- Modal Handlers ---
  const handleOpenCredentialsModal = () => setIsCredentialsModalOpen(true);
  const handleCloseCredentialsModal = () => setIsCredentialsModalOpen(false);
  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  const handleSaveChangesFromCredentialsModal = () => {
    setIsSavingCredentials(true); // Start saving
    
    // Apply changes immediately to parent
    onBotKeyChange(modalBotKey);
    onConnectionChange('discord_app_id', modalAppId);
    onConnectionChange('discord_public_key', modalPublicKey);
    
    // Simulate save and close after delay
    setTimeout(() => {
      setIsSavingCredentials(false); // Finish saving
      handleCloseCredentialsModal(); // Close modal
    }, 1000); // 1 second delay
  };
  
  const handleClearCredentials = () => {
    // Clear local modal state
    setModalBotKey('');
    setModalAppId('');
    setModalPublicKey('');
    
    // Actually update parent state
    onBotKeyChange('');
    onConnectionChange('discord_app_id', '');
    onConnectionChange('discord_public_key', '');
    
    // If agent is active, deactivate it
    if (workerStatus === 'active' && !isDeactivating) {
      onDeactivate();
    }
    
    // Close the modal after clearing
    handleCloseCredentialsModal();
    setShowFullUI(false); // NEW: Revert to initial input view
    setInitialBotKey(''); // NEW: Clear initial input field as well
  };

  const handleSaveChangesFromSettingsModal = () => {
      // Guild and Timeout are already updated via onConnectionChange in their inputs
      handleCloseSettingsModal();
  };

  const handleTimeoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setLocalTimeout(numericValue);
      onConnectionChange('inactivity_timeout_minutes', numericValue);
    }
  };

  const copyToClipboard = (text: string | undefined | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // --- NEW: Handle Initial Connection ---
  const handleInitialConnect = () => {
    if (!initialBotKey) return;
    onBotKeyChange(initialBotKey); // Update parent state
    setModalBotKey(initialBotKey); // Also update local modal state for consistency when modal opens
    setShowFullUI(true);          // Show the full UI
    // Consider automatically opening the Credentials modal here if desired
    // handleOpenCredentialsModal(); 
  };

  // --- Render Logic ---

  // Re-add renderWorkerStatus function
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

  // Re-add statusBadgeClass function
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

  const canActivate = !!connection?.discord_app_id && !!connection?.discord_public_key && !!botKey && !!currentGuildId;
  const isWorkerBusy = isActivating || isDeactivating || workerStatus === 'activating' || workerStatus === 'stopping';

  // Main return statement - Simplified structure with inline JSX
  return (
    <> {/* Top-level Fragment for Modals */}
      {/* Conditionally render Initial or Full UI View */}
      {!showFullUI ? (
        <div className={`space-y-4 ${className}`}>
          {/* --- Initial Bot Token Input View --- */}
          <>
            <div> 
              <label htmlFor="initialBotToken" className="block text-sm font-medium text-gray-300 mb-1">Bot Token *</label>
              <div className="flex space-x-2">
                <input
                  id="initialBotToken"
                  type="password"
                  value={initialBotKey}
                  onChange={(e) => setInitialBotKey(e.target.value)}
                  placeholder="Paste your Discord Bot Token here"
                  className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={handleInitialConnect}
                  disabled={!initialBotKey}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Enter your Discord Bot Token below to connect your agent. 
              You can create a bot and get a token from the{' '}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                Discord Developer Portal
              </a>.
            </p>
          </>
        </div>
      ) : (
        <div className={`space-y-4 ${className}`}>
          {/* --- Full Connection Management View (Inlined) --- */}
          <>
            {/* Top row: Title and Status/Toggle Area */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Discord Configuration</h3>
              <div className="flex items-center space-x-2">
                {renderWorkerStatus()}
                <button 
                  type="button"
                  id="activationToggle"
                  role="switch"
                  aria-checked={workerStatus === 'active'}
                  onClick={() => {
                    if (isWorkerBusy) return; 
                    if (workerStatus === 'active') {
                      onDeactivate();
                    } else if (canActivate) { 
                      onActivate();
                    }
                  }}
                  disabled={!canActivate || isWorkerBusy}
                  title={!canActivate ? "Configure Credentials and Settings first" : (workerStatus === 'active' ? "Click to Deactivate" : "Click to Activate")}
                  className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${workerStatus === 'active' ? 'bg-green-600' : 'bg-gray-600'}`}
                >
                  <span className="sr-only">Activate/Deactivate Agent</span>
                  <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${workerStatus === 'active' ? 'translate-x-6' : 'translate-x-1'}`} />
                  {(isActivating || isDeactivating) && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {/* Management Buttons */}
            <div className="flex space-x-3 pt-4 border-t border-gray-600">
              <button
                type="button"
                onClick={handleOpenCredentialsModal}
                className="flex items-center justify-center flex-grow px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors text-sm font-medium"
              >
                <Key size={16} className="mr-2" /> Manage Credentials
              </button>
              <button
                type="button"
                onClick={handleOpenSettingsModal}
                className="flex items-center justify-center flex-grow px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors text-sm font-medium"
              >
                <Settings size={16} className="mr-2" /> Settings
              </button>
              <button 
                type="button"
                onClick={onGenerateInviteLink}
                disabled={!connection?.discord_app_id || isGeneratingInvite}
                title={!connection?.discord_app_id ? "Enter Application ID in Credentials first" : "Generate bot invite link"}
                className="flex items-center justify-center flex-grow px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingInvite ? <Loader2 className="animate-spin mr-2" size={16} /> : <LinkIcon size={16} className="mr-2" />}
                Generate Invite
              </button>
            </div>
            
            {/* Warning text */}
            {!canActivate && workerStatus === 'inactive' && (
              <p className="text-sm text-gray-400">
                Configure Credentials and Settings (select server) before activating.
              </p>
            )}
          </>
        </div>
      )}

      {/* Credentials Modal */}
      {isCredentialsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage Credentials</h2>
              <button onClick={handleCloseCredentialsModal} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div>
              <label htmlFor="modalBotTokenKey" className="block text-sm font-medium text-gray-300 mb-1">Discord Bot Token *</label>
              <div className="flex items-center space-x-2">
                <input
                  id="modalBotTokenKey"
                  type={isBotKeyVisible ? 'text' : 'password'}
                  value={modalBotKey}
                  onChange={(e) => setModalBotKey(e.target.value)}
                  placeholder="Paste Bot Token here"
                  className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="button" onClick={() => setIsBotKeyVisible(!isBotKeyVisible)} className="p-2 text-gray-400 hover:text-white">
                  {isBotKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="modalAppId" className="block text-sm font-medium text-gray-300 mb-1">Application ID *</label>
              <div className="flex items-center space-x-2">
                <input
                  id="modalAppId"
                  type={isAppIdVisible ? 'text' : 'password'}
                  value={modalAppId}
                  onChange={(e) => setModalAppId(e.target.value)}
                  placeholder="Enter Discord Application ID"
                  className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="button" onClick={() => setIsAppIdVisible(!isAppIdVisible)} className="p-2 text-gray-400 hover:text-white">
                  {isAppIdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="modalPublicKey" className="block text-sm font-medium text-gray-300 mb-1">Public Key *</label>
              <div className="flex items-center space-x-2">
                <input
                  id="modalPublicKey"
                  type={isPublicKeyVisible ? 'text' : 'password'}
                  value={modalPublicKey}
                  onChange={(e) => setModalPublicKey(e.target.value)}
                  placeholder="Enter Discord App Public Key"
                  className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="button" onClick={() => setIsPublicKeyVisible(!isPublicKeyVisible)} className="p-2 text-gray-400 hover:text-white">
                  {isPublicKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button 
                type="button"
                onClick={handleClearCredentials}
                className="flex items-center px-3 py-1.5 text-red-400 hover:text-red-300 text-sm"
              >
                <Trash2 size={14} className="mr-1"/> Disconnect
              </button>
              <button 
                type="button"
                onClick={handleSaveChangesFromCredentialsModal}
                disabled={isSavingCredentials}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center min-w-[80px]"
              >
                {isSavingCredentials ? (
                  <><Loader2 size={16} className="animate-spin mr-2"/> Saving...</>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={handleCloseSettingsModal} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div>
              <label htmlFor="modalGuildSelect" className="block text-sm font-medium text-gray-300 mb-1">
                Active Discord Server
              </label>
              <select 
                id="modalGuildSelect" 
                value={currentGuildId ?? ''} 
                onChange={(e) => onConnectionChange('guild_id', e.target.value || null)} 
                disabled={isWorkerBusy} 
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">-- Select a Server --</option>
                {allGuilds && allGuilds.map((guild) => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name} ({guild.id})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="modalInactivityTimeout" className="block text-sm font-medium text-gray-300 mb-1">
                Inactivity Timeout
              </label>
              <select 
                id="modalInactivityTimeout" 
                value={localTimeout} 
                onChange={handleTimeoutChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TIMEOUT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Time before the agent worker stops due to inactivity.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Interaction Endpoint URL</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`}
                  className="flex-grow px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400"
                />
                <button 
                  type="button" 
                  onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`)} 
                  className="p-2 text-gray-400 hover:text-white"
                >
                  {copied ? <Check size={18} className="text-green-400"/> : <Copy size={18} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Copy this URL into your Discord App settings.</p>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="button" 
                onClick={handleSaveChangesFromSettingsModal} 
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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