import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Save, Server, Settings, Link as LinkIcon, Play, StopCircle, Trash2, Key, Edit } from 'lucide-react';
import type { AgentDiscordConnection } from '../types';
import { FaDiscord } from 'react-icons/fa';
import { CredentialsModal, SettingsModal, TIMEOUT_OPTIONS } from './DiscordModals';
import { BotGuild, DiscordConnectProps, DiscordStatusToggleProps } from './DiscordTypes';

// Temporary cn function until the correct import is fixed
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Status toggle component
export function DiscordStatusToggle({ 
  workerStatus, 
  onActivate, 
  onDeactivate, 
  isActivating, 
  isDeactivating,
  isWorkerBusy,
  canActivate
}: DiscordStatusToggleProps) {
  // Add function to prevent form submission
  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  // Add console log to debug
  console.log("DiscordStatusToggle rendering with:", { 
    workerStatus, isWorkerBusy, canActivate, isActivating, isDeactivating 
  });

  return (
    <div className="flex items-center justify-between bg-gray-900 p-3 rounded-md border border-gray-700 min-w-[200px] shadow-md">
      <div className="flex items-center space-x-3">
        <div 
          className={`w-4 h-4 rounded-full ${
            workerStatus === 'active' ? 'bg-green-500 animate-pulse' : 
            workerStatus === 'activating' || workerStatus === 'stopping' ? 'bg-yellow-500 animate-pulse' : 
            'bg-red-500'
          }`}
        />
        <span className="text-sm font-medium text-white">
          {workerStatus === 'active' ? 'Active' : 
           workerStatus === 'activating' ? 'Activating...' : 
           workerStatus === 'stopping' ? 'Stopping...' : 
           'Inactive'}
        </span>
      </div>
      
      <div className="ml-4">
        {workerStatus === 'active' ? (
          <button
            type="button"
            onClick={(e) => handleButtonClick(e, onDeactivate)}
            disabled={isWorkerBusy}
            className="px-3 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed border border-red-800"
          >
            {isDeactivating ? <Loader2 size={14} className="animate-spin" /> : 'Stop Bot'}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => handleButtonClick(e, onActivate)}
            disabled={!canActivate || isWorkerBusy}
            className="px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed border border-green-800"
          >
            {isActivating ? <Loader2 size={14} className="animate-spin" /> : 'Start Bot'}
          </button>
        )}
      </div>
    </div>
  );
}

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
  currentGuildId,
  showStatusToggle = true
}: DiscordConnectProps) {
  
  // State management
  const [showFullUI, setShowFullUI] = useState(!!botKey);
  const [initialBotKey, setInitialBotKey] = useState('');

  // Modal states
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  // Local state for modal inputs
  const [modalBotKey, setModalBotKey] = useState(botKey);
  const [modalAppId, setModalAppId] = useState(connection?.discord_app_id || '');
  const [modalPublicKey, setModalPublicKey] = useState(connection?.discord_public_key || '');
  const [localTimeout, setLocalTimeout] = useState(connection?.inactivity_timeout_minutes ?? 10);
  
  const [error, setError] = useState<string | null>(null);

  // Update local state when props change
  useEffect(() => { 
    setModalBotKey(botKey); 
    setShowFullUI(!!botKey);
  }, [botKey]);
  
  useEffect(() => { 
    setModalAppId(connection?.discord_app_id || ''); 
  }, [connection?.discord_app_id]);
  
  useEffect(() => { 
    setModalPublicKey(connection?.discord_public_key || ''); 
  }, [connection?.discord_public_key]);

  useEffect(() => {
    setLocalTimeout(connection?.inactivity_timeout_minutes ?? 10);
  }, [connection?.inactivity_timeout_minutes]); 

  // Computed values
  const canActivate = !!connection?.discord_app_id && !!connection?.discord_public_key && !!botKey && !!currentGuildId;
  const isWorkerBusy = isActivating || isDeactivating || workerStatus === 'activating' || workerStatus === 'stopping';

  // Modal handlers
  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  const handleSaveChangesFromCredentialsModal = () => {
    setIsSavingCredentials(true); // Start saving
    
    // Apply changes immediately to parent
    onBotKeyChange(modalBotKey);
    onConnectionChange('discord_app_id', modalAppId);
    onConnectionChange('discord_public_key', modalPublicKey);
    
    // Just set saving to false after a delay without closing the modal
    setTimeout(() => {
      setIsSavingCredentials(false);
    }, 1000);
  };
  
  const handleClearCredentials = () => {
    // Clear local modal state
    setModalBotKey('');
    setModalAppId('');
    setModalPublicKey('');
    
    // Update parent state
    onBotKeyChange('');
    onConnectionChange('discord_app_id', '');
    onConnectionChange('discord_public_key', '');
    
    // If agent is active, deactivate it
    if (workerStatus === 'active' && !isDeactivating) {
      onDeactivate();
    }
    
    // Close the modal and reset UI state
    handleCloseSettingsModal();
    setShowFullUI(false);
    setInitialBotKey('');
  };

  const handleTimeoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setLocalTimeout(numericValue);
      onConnectionChange('inactivity_timeout_minutes', numericValue);
    }
  };

  const handleGuildChange = (value: string | null) => {
    onConnectionChange('guild_id', value);
  };

  // Initial connection handler
  const handleInitialConnect = () => {
    if (!initialBotKey) return;
    onBotKeyChange(initialBotKey);
    setModalBotKey(initialBotKey);
    setShowFullUI(true);
  };

  // Handle Generate Invite Link
  const handleGenerateInvite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onGenerateInviteLink();
  };

  // Find the selected server name
  const selectedServer = allGuilds.find(guild => guild.id === currentGuildId);
  
  // Compute interaction endpoint URL
  const interactionEndpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`;

  // Stop event propagation and prevent default on modal-related interactions
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className={cn("w-full space-y-6", className)}>
      <div className="flex flex-col space-y-4">
        <div 
          className="relative flex items-center p-4 bg-[#2e3543] rounded-lg border border-[#484f5c] shadow-md overflow-hidden cursor-pointer hover:bg-[#333a4a] transition-colors"
          onClick={handleModalClick}
          onMouseDown={handleOpenSettingsModal}
          title="Click to configure Discord connection"
        >
          <div className="absolute top-2 right-2 text-gray-400 hover:text-white">
            <Settings size={16} />
          </div>
          <div className="flex-shrink-0 mr-4 bg-gray-800 p-2.5 rounded-md">
            <Server size={22} className="text-[#5865F2]" />
          </div>
          <div className="flex-grow">
            {selectedServer ? (
              <>
                <div className="text-sm font-medium text-gray-400">Connected to server:</div>
                <div className="text-lg font-semibold text-white">{selectedServer.name}</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-400">Server Status:</div>
                <div className="text-lg font-semibold text-gray-300">Not connected</div>
                <div className="text-xs text-gray-500 mt-1">Click to connect your agent to a Discord server</div>
              </>
            )}
          </div>
          {showStatusToggle && selectedServer && (
            <div className="flex-shrink-0 ml-auto">
              <DiscordStatusToggle
                workerStatus={workerStatus || 'inactive'}
                canActivate={canActivate}
                isWorkerBusy={isWorkerBusy}
                onActivate={onActivate}
                onDeactivate={onDeactivate}
                isActivating={isActivating}
                isDeactivating={isDeactivating}
              />
            </div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-400 bg-gray-800 p-4 rounded-md border border-gray-700">
        <p>
          Manage your Discord bot configuration and settings here. Visit the{" "}
          <a 
            href="https://discord.com/developers/applications" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Discord Developer Portal
          </a>{" "}
          to create or edit your bot application.
        </p>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        currentGuildId={currentGuildId}
        onGuildChange={handleGuildChange}
        localTimeout={localTimeout}
        onTimeoutChange={handleTimeoutChange}
        allGuilds={allGuilds}
        isWorkerBusy={isWorkerBusy}
        interactionEndpointUrl={interactionEndpointUrl}
        onGenerateInviteLink={onGenerateInviteLink}
        isGeneratingInvite={isGeneratingInvite}
        modalBotKey={modalBotKey}
        setModalBotKey={setModalBotKey}
        modalAppId={modalAppId}
        setModalAppId={setModalAppId}
        modalPublicKey={modalPublicKey}
        setModalPublicKey={setModalPublicKey}
        onSave={handleSaveChangesFromCredentialsModal}
        onClear={handleClearCredentials}
        isSavingCredentials={isSavingCredentials}
        initialTab="server"
      />
    </div>
  );
}

// Export the memo-wrapped component
export const DiscordConnect = React.memo(DiscordConnectComponent);