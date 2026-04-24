import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Key, Link, Loader2, Save, Server, Trash2, X } from 'lucide-react';
import { BotGuild } from '../../types/DiscordTypes';
import { TimeoutSlider } from './TimeoutSlider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGuildId: string | null | undefined;
  onGuildChange: (value: string | null) => void;
  localTimeout: number;
  onTimeoutChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  allGuilds: BotGuild[];
  isWorkerBusy: boolean;
  interactionEndpointUrl: string;
  onGenerateInviteLink: () => void;
  isGeneratingInvite: boolean;
  modalBotKey: string;
  setModalBotKey: (value: string) => void;
  modalAppId: string;
  setModalAppId: (value: string) => void;
  modalPublicKey: string;
  setModalPublicKey: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  isSavingCredentials: boolean;
  initialTab?: 'credentials' | 'server' | 'integration' | 'danger';
}

export function SettingsModal({
  isOpen,
  onClose,
  currentGuildId,
  onGuildChange,
  localTimeout,
  onTimeoutChange,
  allGuilds,
  isWorkerBusy,
  interactionEndpointUrl,
  onGenerateInviteLink,
  isGeneratingInvite,
  modalBotKey,
  setModalBotKey,
  modalAppId,
  setModalAppId,
  modalPublicKey,
  setModalPublicKey,
  onSave,
  onClear,
  isSavingCredentials,
  initialTab = 'server',
}: SettingsModalProps) {
  const hasCredentials = !!modalBotKey && !!modalAppId && !!modalPublicKey;
  const defaultTab = hasCredentials ? initialTab : 'credentials';

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [copied, setCopied] = useState(false);
  const [isBotKeyVisible, setIsBotKeyVisible] = useState(false);
  const [isAppIdVisible, setIsAppIdVisible] = useState(false);
  const [isPublicKeyVisible, setIsPublicKeyVisible] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const copyToClipboard = (text: string | undefined | null, event?: React.MouseEvent) => {
    if (!text) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSaveAndExit = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const credentialsValid = !!modalBotKey && !!modalAppId && !!modalPublicKey;
    if (!credentialsValid && activeTab === 'credentials') {
      alert('Please fill in all required credential fields before saving.');
      return;
    }

    setSaveState('saving');
    onSave();

    setTimeout(() => {
      setSaveState('saved');
      setTimeout(() => {
        setSaveState('idle');
        onClose();
      }, 800);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Discord Configuration</h2>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-gray-700 mb-4">
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (hasCredentials) {
                setActiveTab('server');
              } else {
                alert('Please save your Discord credentials before configuring server settings.');
              }
            }}
            className={`px-3 py-2 text-xs font-medium ${
              activeTab === 'server'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : hasCredentials
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 opacity-60'
            }`}
            disabled={!hasCredentials}
            title={!hasCredentials ? 'Save credentials first' : 'Server configuration'}
          >
            <Server size={14} className="inline mr-1" />
            Server
          </button>
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (hasCredentials) {
                setActiveTab('integration');
              } else {
                alert('Please save your Discord credentials before configuring integration settings.');
              }
            }}
            className={`px-3 py-2 text-xs font-medium ${
              activeTab === 'integration'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : hasCredentials
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 opacity-60'
            }`}
            disabled={!hasCredentials}
            title={!hasCredentials ? 'Save credentials first' : 'Integration settings'}
          >
            <Link size={14} className="inline mr-1" />
            Integration
          </button>
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setActiveTab('credentials');
            }}
            className={`px-3 py-2 text-xs font-medium ${
              activeTab === 'credentials' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Key size={14} className="inline mr-1" />
            Credentials
          </button>
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (hasCredentials) {
                setActiveTab('danger');
              } else {
                alert('Please save your Discord credentials before accessing danger zone options.');
              }
            }}
            className={`px-3 py-2 text-xs font-medium ${
              activeTab === 'danger'
                ? 'text-red-400 border-b-2 border-red-400'
                : hasCredentials
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 opacity-60'
            }`}
            disabled={!hasCredentials}
            title={!hasCredentials ? 'Save credentials first' : 'Danger zone options'}
          >
            <Trash2 size={14} className="inline mr-1" />
            Danger
          </button>
        </div>

        {activeTab === 'server' && (
          <div className="space-y-4">
            <div className="bg-[#2e3543] rounded-lg border border-[#484f5c] p-3">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                <Server size={16} className="mr-2 text-[#5865F2]" />
                Server Configuration
              </h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="modalGuildSelect" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Active Discord Server
                  </label>
                  <select
                    id="modalGuildSelect"
                    value={currentGuildId ?? ''}
                    onChange={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onGuildChange(event.target.value || null);
                    }}
                    disabled={isWorkerBusy}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select a Server --</option>
                    {allGuilds &&
                      allGuilds.map((guild) => (
                        <option key={guild.id} value={guild.id}>
                          {guild.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="modalInactivityTimeout" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Inactivity Timeout
                  </label>
                  <TimeoutSlider
                    value={localTimeout}
                    onChange={(value) => {
                      const syntheticEvent = {
                        target: { value: value.toString() },
                        preventDefault: () => {},
                        stopPropagation: () => {},
                      } as React.ChangeEvent<HTMLSelectElement>;
                      onTimeoutChange(syntheticEvent);
                    }}
                    disabled={isWorkerBusy}
                  />
                  <p className="mt-3 text-xs text-gray-400">
                    This determines how long the agent worker will stay active without receiving any Discord messages. After this period of inactivity, the bot will automatically disconnect to save resources. Setting to "Never" means the bot will stay active until manually stopped.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integration' && (
          <div className="space-y-4">
            <div className="bg-[#2e3543] rounded-lg border border-[#484f5c] p-3">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                <Link size={16} className="mr-2 text-[#5865F2]" />
                Integration
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Interaction Endpoint URL</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={interactionEndpointUrl}
                      className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300"
                    />
                    <button
                      type="button"
                      onClick={(event) => copyToClipboard(interactionEndpointUrl, event)}
                      className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-md border border-gray-600"
                    >
                      {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    <span className="font-medium">Required setup:</span> Copy this URL into your Discord Application's "INTERACTIONS ENDPOINT URL" field under{' '}
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      Discord Developer Portal
                    </a>{' '}
                    -&gt; Your App -&gt; General Information.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onGenerateInviteLink();
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGeneratingInvite}
                  >
                    <Link size={16} className="mr-2" />
                    <span>{isGeneratingInvite ? 'Copied!' : 'Generate & Copy Invite Link'}</span>
                  </button>

                  <p className="mt-2 text-xs text-gray-400">
                    This will generate and copy an authorization URL for your Discord bot with all required permissions. Use this link to add your bot to any Discord server where you have admin permissions. After clicking, the link will be copied to your clipboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-4">
            <div className="bg-[#2e3543] rounded-lg border border-[#484f5c] p-3">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                <Key size={16} className="mr-2 text-[#5865F2]" />
                Bot Authentication
              </h3>

              <div className="space-y-3">
                <div>
                  <label htmlFor="modalBotTokenKey" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Discord Bot Token <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="modalBotTokenKey"
                      type={isBotKeyVisible ? 'text' : 'password'}
                      value={modalBotKey}
                      onChange={(event) => setModalBotKey(event.target.value)}
                      placeholder="Paste Bot Token here"
                      className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsBotKeyVisible(!isBotKeyVisible);
                      }}
                      className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-md border border-gray-600"
                    >
                      {isBotKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Found in the{' '}
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      Discord Developer Portal
                    </a>{' '}
                    under <span className="font-medium">Bot -&gt; Reset Token</span>. Keep this secret.
                  </p>
                </div>

                <div>
                  <label htmlFor="modalAppId" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Application ID <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="modalAppId"
                      type={isAppIdVisible ? 'text' : 'password'}
                      value={modalAppId}
                      onChange={(event) => setModalAppId(event.target.value)}
                      placeholder="Enter Discord Application ID"
                      className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsAppIdVisible(!isAppIdVisible);
                      }}
                      className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-md border border-gray-600"
                    >
                      {isAppIdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Found in the{' '}
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      Discord Developer Portal
                    </a>{' '}
                    under <span className="font-medium">General Information -&gt; Application ID</span>.
                  </p>
                </div>

                <div>
                  <label htmlFor="modalPublicKey" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Public Key <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="modalPublicKey"
                      type={isPublicKeyVisible ? 'text' : 'password'}
                      value={modalPublicKey}
                      onChange={(event) => setModalPublicKey(event.target.value)}
                      placeholder="Enter Discord App Public Key"
                      className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsPublicKeyVisible(!isPublicKeyVisible);
                      }}
                      className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-md border border-gray-600"
                    >
                      {isPublicKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Found in the{' '}
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      Discord Developer Portal
                    </a>{' '}
                    under <span className="font-medium">General Information -&gt; Public Key</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800/30 rounded-md p-4">
              <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center">
                <Trash2 size={16} className="mr-2" />
                Remove Discord Connection
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                This will remove the connection between your agent and Discord. Your Discord bot will remain intact on Discord's platform, but it will no longer be linked to this agent.
              </p>
              <ul className="list-disc pl-5 mb-4 text-xs text-gray-400 space-y-1">
                <li>All Discord connection credentials will be removed from Agentopia</li>
                <li>The agent's Discord worker will be stopped if currently running</li>
                <li>Your Discord server selection will be reset</li>
                <li>Your Discord bot application on Discord will remain untouched</li>
              </ul>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (confirm('Are you sure you want to disconnect this agent from Discord? You can reconnect later by entering your credentials again.')) {
                    onClear();
                  }
                }}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-red-800 text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 size={14} className="mr-1.5" /> Remove Discord Connection
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-4 pt-3 border-t border-gray-700">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium flex items-center justify-center"
          >
            <X size={16} className="mr-2" /> Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAndExit}
            disabled={isSavingCredentials || saveState !== 'idle'}
            className={`px-4 py-2 ${
              saveState === 'saved' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white rounded-md transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center min-w-[120px]`}
          >
            {saveState === 'saving' ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" /> Saving...
              </>
            ) : saveState === 'saved' ? (
              <>
                <Check size={16} className="mr-2" /> Saved!
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" /> Save & Exit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
