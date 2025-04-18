import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Check, AlertTriangle } from 'lucide-react';

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
    onSave: (enabledList: EnabledGuildStatus[]) => Promise<void>;
    allGuilds: BotGuild[];
    enabledGuilds: EnabledGuildStatus[];
    loading: boolean;
}

export function GuildSelectionModal({ 
    isOpen,
    onClose,
    onSave,
    allGuilds,
    enabledGuilds,
    loading,
}: GuildSelectionModalProps) {
    const [enabledState, setEnabledState] = useState<Record<string, boolean>>({});
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [internalSaving, setInternalSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setShowSaveSuccess(false);
            setInternalSaving(false);
            setSaveError(null);
            
            if (allGuilds.length > 0) {
                const initialEnabledState: Record<string, boolean> = {};
                const enabledMap = new Map(enabledGuilds.map(g => [g.guild_id, g.is_enabled]));
                allGuilds.forEach(guild => {
                    initialEnabledState[guild.id] = enabledMap.get(guild.id) ?? true;
                });
                setEnabledState(initialEnabledState);
            }
        } else {
            
        }
    }, [isOpen, allGuilds, enabledGuilds]);

    const handleToggle = useCallback((guildId: string) => {
        if (internalSaving || showSaveSuccess) return;
        setEnabledState(prev => ({ ...prev, [guildId]: !prev[guildId] }));
    }, [internalSaving, showSaveSuccess]);

    const handleSave = useCallback(async () => {
        console.log("[Modal Save] Start");
        setInternalSaving(true);
        setShowSaveSuccess(false);
        setSaveError(null);
        const updatedEnabledList: EnabledGuildStatus[] = Object.entries(enabledState)
            .map(([guild_id, is_enabled]) => ({ guild_id, is_enabled }));
        try {
            console.log("[Modal Save] Calling onSave prop...");
            await onSave(updatedEnabledList);
            console.log("[Modal Save] onSave prop completed successfully.");
            
            setInternalSaving(false);
            setShowSaveSuccess(true);
            console.log("[Modal Save] Set showSaveSuccess = true, internalSaving = false. State should update.");
            
            setTimeout(() => {
                console.log("[Modal Save] Timeout triggered. Resetting success state and closing.");
                setShowSaveSuccess(false); 
                onClose(); 
            }, 1500);
        } catch (error: any) {
            console.error("[Modal Save] Error during onSave call:", error);
            setSaveError(error?.message || "An unknown error occurred while saving.");
            setInternalSaving(false);
            setShowSaveSuccess(false); 
        }
    }, [enabledState, onSave, onClose]);

    if (!isOpen) return null;

    const disableActions = loading || (internalSaving && !showSaveSuccess) || allGuilds.length === 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all duration-300 scale-100 opacity-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Manage Enabled Servers</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white disabled:opacity-50"
                        disabled={disableActions}
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
                                        disabled={disableActions}
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                {saveError && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-300 flex items-center">
                        <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                        <span className="text-sm">{saveError}</span>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={disableActions}
                        className="px-4 py-2 text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className={`px-4 py-2 rounded-md transition-colors flex items-center ${ 
                            showSaveSuccess 
                                ? 'bg-green-600 cursor-default'
                                : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        } text-white`}
                        disabled={disableActions}
                    >
                        {internalSaving && !showSaveSuccess ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : showSaveSuccess ? (
                            <><Check className="w-4 h-4 mr-2" /> Saved!</>
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