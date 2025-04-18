import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';

interface BotGuild {
    id: string;
    name: string;
}

interface EnabledGuildStatus {
    guild_id: string;
    is_enabled: boolean;
}

interface GuildSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (enabledList: EnabledGuildStatus[]) => Promise<void>; // Assuming onSave is async
    allGuilds: BotGuild[];
    enabledGuilds: EnabledGuildStatus[];
    loading: boolean;
    isSaving: boolean;
}

export function GuildSelectionModal({ 
    isOpen,
    onClose,
    onSave,
    allGuilds,
    enabledGuilds,
    loading,
    isSaving
}: GuildSelectionModalProps) {
    const [enabledState, setEnabledState] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen && allGuilds.length > 0) {
            const initialEnabledState: Record<string, boolean> = {};
            const enabledMap = new Map(enabledGuilds.map(g => [g.guild_id, g.is_enabled]));
            
            allGuilds.forEach(guild => {
                // Default to true if not found in enabledGuilds (newly joined servers)
                initialEnabledState[guild.id] = enabledMap.get(guild.id) ?? true;
            });
            setEnabledState(initialEnabledState);
        }
    }, [isOpen, allGuilds, enabledGuilds]);

    const handleToggle = useCallback((guildId: string) => {
        setEnabledState(prev => ({ ...prev, [guildId]: !prev[guildId] }));
    }, []);

    const handleSave = useCallback(async () => {
        const updatedEnabledList: EnabledGuildStatus[] = Object.entries(enabledState)
            .map(([guild_id, is_enabled]) => ({ guild_id, is_enabled }));
        try {
            await onSave(updatedEnabledList);
            // onClose will likely be called by the parent component on successful save
        } catch (error) {
            console.error("Error saving enabled guilds:", error);
            // Optionally show an error message within the modal
        }
    }, [enabledState, onSave]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all duration-300 scale-100 opacity-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Manage Enabled Servers</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white disabled:opacity-50"
                        disabled={isSaving}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    </div>
                ) : allGuilds.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        No servers found where the bot has been added.
                    </div>
                ) : (
                    <div className="max-h-80 overflow-y-auto pr-2 space-y-3 mb-6 custom-scrollbar">
                        {allGuilds.map(guild => (
                            <div 
                                key={guild.id} 
                                className="flex items-center justify-between bg-gray-700 p-3 rounded-md"
                            >
                                <span className="text-white font-medium truncate mr-4" title={guild.name}>
                                    {guild.name}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={enabledState[guild.id] ?? true}
                                        onChange={() => handleToggle(guild.id)}
                                        disabled={isSaving}
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        disabled={isSaving || loading || allGuilds.length === 0}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Basic styling for scrollbar (optional, add to your global CSS or tailwind config)
/*
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #2d3748; // gray-700
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4a5568; // gray-600
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #718096; // gray-500
}
*/ 