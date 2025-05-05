import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type ChatMessage } from '../types/chat';
import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: PostgrestError | string | null;
  createMessage: (channelId: string, content: string, sender: { senderUserId?: string; senderAgentId?: string }, metadata?: Record<string, any>) => Promise<ChatMessage | null>;
  currentChannelId: string | null;
}

export function useChatMessages(initialChannelId: string | null): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(initialChannelId);
  const [currentSubscription, setCurrentSubscription] = useState<RealtimeChannel | null>(null);

  const fetchMessages = useCallback(async (channelId: string, offset: number = 0, limit: number = 50) => {
    if (!channelId) {
      console.warn('fetchMessages called without channelId');
      setMessages([]);
      return;
    }
    console.log(`Fetching messages for channel ${channelId}, offset: ${offset}, limit: ${limit}`);
    setError(null);
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (fetchError) throw fetchError;

      setMessages(prevMessages => offset === 0 ? (data || []) : [...(data || []), ...prevMessages]);
      
    } catch (err) {
        console.error(`Error fetching messages for channel ${channelId}:`, err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred fetching messages.');
        setMessages([]);
    } finally {
        setLoading(false);
    }
  }, []);

  const subscribeToNewMessages = useCallback((channelId: string) => {
    if (!channelId) {
      console.error('subscribeToNewMessages requires a channelId');
      setError('Channel ID is required to subscribe to messages.');
      return null;
    }
    
    if (currentSubscription) {
        console.log(`Unsubscribing from previous channel: ${currentSubscription.topic}`);
        supabase.removeChannel(currentSubscription);
    }

    setError(null);
    console.log(`Subscribing to new messages for channel ${channelId}`);
    
    const channel = supabase.channel(`chat_channel:${channelId}`)
      .on<ChatMessage>(
        'postgres_changes',
        { 
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          console.log('New message received via Realtime:', payload);
          const newMessage = payload.new as ChatMessage;
          setMessages(currentMessages => 
              currentMessages.some(msg => msg.id === newMessage.id)
                  ? currentMessages
                  : [...currentMessages, newMessage]
          );
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to channel ${channelId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime subscription error for channel ${channelId}:`, status, err);
          setError(`Subscription failed: ${status}. ${err?.message || 'Check console.'}`);
        } else {
            console.log(`Realtime status for channel ${channelId}:`, status);
        }
      });

    setCurrentSubscription(channel);
    return channel;

  }, [currentSubscription]);

  useEffect(() => {
    if (currentChannelId) {
      setMessages([]);
      fetchMessages(currentChannelId);
      subscribeToNewMessages(currentChannelId);
    } else {
      setMessages([]);
      if (currentSubscription) {
          console.log(`Unsubscribing due to null channelId: ${currentSubscription.topic}`);
          supabase.removeChannel(currentSubscription);
          setCurrentSubscription(null);
      }
    }

    return () => {
        if (currentSubscription) {
            console.log(`Unsubscribing during cleanup: ${currentSubscription.topic}`);
            supabase.removeChannel(currentSubscription);
        }
    };
  }, [currentChannelId, fetchMessages, subscribeToNewMessages]);

  const createMessage = useCallback(async (
    channelId: string,
    content: string,
    sender: { senderUserId?: string; senderAgentId?: string },
    metadata?: Record<string, any>
  ): Promise<ChatMessage | null> => {
    console.log('createMessage called for channel', channelId);
    if (!channelId) {
        setError('Channel ID is required to create a message.');
        return null;
    }
    if (!sender.senderUserId && !sender.senderAgentId) {
      const errMsg = 'Message sender (user or agent) is required.';
      console.error(`createMessage Error: ${errMsg}`);
      setError(errMsg);
      return null;
    }
    if (!content) {
        const errMsg = 'Message content cannot be empty.';
        console.error(`createMessage Error: ${errMsg}`);
        setError(errMsg);
        return null;
    }

    setError(null);

    try {
      const newMessagePayload: Partial<ChatMessage> = {
        channel_id: channelId,
        content: content,
        sender_user_id: sender.senderUserId,
        sender_agent_id: sender.senderAgentId,
        metadata: metadata
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('chat_messages')
        .insert([newMessagePayload])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!insertedData) throw new Error("Message insertion returned no data.");

      const newMessage = insertedData as ChatMessage;
      console.log(`Message ${newMessage.id} created successfully.`);

      setMessages(currentMessages => [...currentMessages, newMessage]);

      try {
          console.log(`Triggering embedding generation for message ${newMessage.id}...`);
          const { data: embeddingData, error: rpcError } = await supabase.functions.invoke('generate-embedding', {
              body: { content: newMessage.content }
          });

          if (rpcError) {
              throw rpcError;
          } 

          if (embeddingData && embeddingData.embedding) {
              console.log(`Embedding received for message ${newMessage.id}, updating DB...`);
              const { error: updateError } = await supabase
                  .from('chat_messages')
                  .update({ embedding: embeddingData.embedding })
                  .eq('id', newMessage.id);
              
              if (updateError) {
                  console.error(`Failed to update message ${newMessage.id} with embedding:`, updateError);
              } else {
                  console.log(`Successfully updated message ${newMessage.id} with embedding.`);
              }
          } else {
              console.warn(`generate-embedding function did not return expected embedding data for message ${newMessage.id}.`);
          }

      } catch (embeddingError) {
          console.error(`Embedding generation/update failed for message ${newMessage.id}:`, embeddingError);
      }

      return newMessage;

    } catch (err) {
      console.error(`Error creating message in channel ${channelId}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred creating the message.');
      return null;
    } 
  }, []);

  return {
    messages,
    loading,
    error,
    createMessage,
    currentChannelId
  };
} 