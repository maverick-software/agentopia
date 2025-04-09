import React, { useState } from 'react';
import { Bot, Check, Loader2 } from 'lucide-react';

interface DiscordGuild {
  id: string;
  name: string;
  channels: {
    id: string;
    name: string;
  }[];
}

interface DiscordConnectProps {
  agentId: string;
  onChannelSelect: (channelId: string) => void;
  isConnected: boolean;
  className?: string;
}

export function DiscordConnect({ agentId, onChannelSelect, isConnected, className = '' }: DiscordConnectProps) {
  const [botToken, setBotToken] = useState('');
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!botToken.trim()) {
      setError('Please enter a bot token');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken,
          agentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect to Discord');
      }

      const data = await response.json();
      setGuilds(data.guilds);
      setBotToken('');
    } catch (err) {
      console.error('Discord connection error:', err);
      setError(err.message || 'Failed to connect to Discord');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
    onChannelSelect(channelId);
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center space-x-3 mb-6">
        <Bot className="w-6 h-6 text-indigo-500" />
        <h2 className="text-xl font-semibold">Discord Integration</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {!isConnected ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Bot Token
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your Discord bot token"
              />
              <button
                onClick={handleConnect}
                disabled={loading || !botToken.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          </div>

          {guilds.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Select Server
                </label>
                <select
                  value={selectedGuild}
                  onChange={(e) => setSelectedGuild(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a server</option>
                  {guilds.map((guild) => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedGuild && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Select Channel
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => handleChannelSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a channel</option>
                    {guilds
                      .find((g) => g.id === selectedGuild)
                      ?.channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-green-400">
          <Check className="w-5 h-5" />
          <span>Connected to Discord</span>
        </div>
      )}
    </div>
  );
}