// src/hooks/useChatChannels.ts
import { useState, useCallback, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { type ChatChannel } from '../types/chat';
import { useAuth } from '../contexts/AuthContext'; // Corrected import

export const useChatChannels = (roomId: string | null) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth(); // Corrected usage
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannelsForRoom = useCallback(async () => {
    if (!roomId) {
      setChannels([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // RLS Policy "Allow room members to view channels" handles access
      const { data, error: fetchError } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('room_id', roomId)
        .order('name', { ascending: true }); // Order channels alphabetically

      if (fetchError) throw fetchError;

      setChannels(data || []);

    } catch (err: any) {
      console.error("Error fetching channels:", err);
      setError(err.message || 'Failed to fetch channels');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, roomId]);

  // Fetch channels when roomId changes
  useEffect(() => {
    if (roomId) {
      fetchChannelsForRoom();
    }
  }, [roomId, fetchChannelsForRoom]);

  const createChannel = async (name: string, topic?: string): Promise<ChatChannel | null> => {
    if (!roomId || !user || !name.trim()) {
      setError('Room ID, User context, and Channel name are required.');
      return null;
    }
    // RLS: "Allow room owner to create channels"
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('chat_channels')
        .insert({ room_id: roomId, name: name.trim(), topic: topic || null })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setChannels(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); // Add and re-sort
        return data;
      } else {
        throw new Error('Failed to create channel: No data returned.');
      }

    } catch (err: any) {
      console.error("Error creating channel:", err);
      setError(err.message || 'Failed to create channel. Check if you are the room owner.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateChannel = async (channelId: string, updates: { name?: string; topic?: string }): Promise<ChatChannel | null> => {
    if (!user || !channelId || Object.keys(updates).length === 0) {
        setError('User context, Channel ID, and updates are required.');
        return null;
    }
    // RLS: "Allow room owner to update channels"
    setLoading(true);
    setError(null);
    try {
        const { data, error: updateError } = await supabase
            .from('chat_channels')
            .update(updates)
            .eq('id', channelId)
            .select()
            .single();

        if (updateError) throw updateError;

        if (data) {
            setChannels(prev => prev.map(ch => ch.id === channelId ? data : ch)
                                     .sort((a, b) => a.name.localeCompare(b.name)));
            return data;
        } else {
            throw new Error('Failed to update channel: No data returned.');
        }

    } catch (err: any) {
        console.error("Error updating channel:", err);
        setError(err.message || 'Failed to update channel. Check if you are the room owner.');
        return null;
    } finally {
        setLoading(false);
    }
};


 const deleteChannel = async (channelId: string): Promise<boolean> => {
    if (!user || !channelId) {
        setError('User context and Channel ID are required.');
        return false;
    }
    // RLS: "Allow room owner to delete channels"
    setLoading(true);
    setError(null);
    try {
        const { error: deleteError } = await supabase
            .from('chat_channels')
            .delete()
            .eq('id', channelId);

        if (deleteError) throw deleteError;

        setChannels(prev => prev.filter(ch => ch.id !== channelId));
        return true;

    } catch (err: any) {
        console.error("Error deleting channel:", err);
        setError(err.message || 'Failed to delete channel. Check if you are the room owner.');
        return false;
    } finally {
        setLoading(false);
    }
 };


  return {
    channels,
    loading,
    error,
    fetchChannelsForRoom,
    createChannel,
    updateChannel,
    deleteChannel,
  };
}; 