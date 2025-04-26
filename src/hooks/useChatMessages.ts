import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types';
import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: PostgrestError | string | null;
  fetchMessages: (sessionId: string, offset?: number, limit?: number) => Promise<void>;
  createMessage: (sessionId: string, content: string, sender: { senderUserId?: string; senderAgentId?: string }, metadata?: Record<string, any>) => Promise<ChatMessage | null>;
  subscribeToNewMessages: (sessionId: string, handler: (newMessage: ChatMessage) => void) => RealtimeChannel | null;
  unsubscribeFromMessages: (channel: RealtimeChannel | null) => Promise<void>;
}

export function useChatMessages(): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | string | null>(null);

  // Implement fetchMessages
  const fetchMessages = useCallback(async (sessionId: string, offset: number = 0, limit: number = 50) => {
    if (!sessionId) {
      console.warn('fetchMessages called without sessionId');
      setMessages([]);
      return;
    }
    console.log(`Fetching messages for session ${sessionId}, offset: ${offset}, limit: ${limit}`);
    setError(null);
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }) // Fetch oldest first
        .range(offset, offset + limit - 1);

      if (fetchError) throw fetchError;

      // If offset is 0, replace messages. Otherwise, prepend older messages.
      // Note: UI typically loads older messages when scrolling up, so prepend.
      setMessages(currentMessages => 
        offset === 0 ? (data || []) : [...(data || []), ...currentMessages]
      );
      
    } catch (err) {
        console.error(`Error fetching messages for session ${sessionId}:`, err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred fetching messages.');
        // Optionally clear messages on error, or leave existing ones
        // setMessages([]); 
    } finally {
        setLoading(false);
    }
  }, []);

  // Implement createMessage (including call to generate-embedding)
  const createMessage = useCallback(async (
    sessionId: string,
    content: string,
    sender: { senderUserId?: string; senderAgentId?: string },
    metadata?: Record<string, any>
  ): Promise<ChatMessage | null> => {
    console.log('createMessage called for', sessionId);
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
    // Don't set global loading for sending a single message, UI can handle locally
    // setLoading(true); 

    try {
      // 1. Insert the new message
      const newMessagePayload: Partial<ChatMessage> = {
        session_id: sessionId,
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

      // 2. Update local state optimistically
      setMessages(currentMessages => [...currentMessages, newMessage]);

      // 3. Trigger embedding generation AND update the message row
      // We use a try/catch here to handle embedding errors without failing the message creation
      try {
          console.log(`Triggering embedding generation for message ${newMessage.id}...`);
          const { data: embeddingData, error: rpcError } = await supabase.functions.invoke('generate-embedding', {
              body: { content: newMessage.content } // Only send content needed for embedding
              // No need to send messageId IN the request if the function doesn't use it
          });

          if (rpcError) {
              throw rpcError; // Throw error to be caught by the outer catch block
          } 

          if (embeddingData && embeddingData.embedding) {
              console.log(`Embedding received for message ${newMessage.id}, updating DB...`);
              const { error: updateError } = await supabase
                  .from('chat_messages')
                  .update({ embedding: embeddingData.embedding })
                  .eq('id', newMessage.id);
              
              if (updateError) {
                  console.error(`Failed to update message ${newMessage.id} with embedding:`, updateError);
                  // Decide how to handle DB update failure - maybe log and continue?
                  // We could potentially set an error state here specific to embedding failure.
              } else {
                  console.log(`Successfully updated message ${newMessage.id} with embedding.`);
                  // Optionally update the specific message in local state if needed immediately
                  // setMessages(current => current.map(m => 
                  //     m.id === newMessage.id ? { ...m, embedding: embeddingData.embedding } : m
                  // ));
              }
          } else {
              console.warn(`generate-embedding function did not return expected embedding data for message ${newMessage.id}.`);
          }

      } catch (embeddingError) {
          // Log the embedding-specific error but don't fail the whole message creation process
          // The message is already saved, just embedding failed.
          console.error(`Embedding generation/update failed for message ${newMessage.id}:`, embeddingError);
          // Optionally set a specific error state related to embedding failure
          // setError("Failed to generate or save message embedding."); 
      }

      // 4. Return the newly created message (without embedding initially)
      return newMessage;

    } catch (err) {
      console.error(`Error creating message in session ${sessionId}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred creating the message.');
      return null; // Return null on failure
    } finally {
      // setLoading(false);
    }
  }, []);

  // Implement subscribeToNewMessages
  const subscribeToNewMessages = useCallback((sessionId: string, handler: (newMessage: ChatMessage) => void): RealtimeChannel | null => {
    if (!sessionId) {
      console.error('subscribeToNewMessages requires a sessionId');
      setError('Session ID is required to subscribe to messages.');
      return null;
    }
    setError(null);
    console.log(`Subscribing to new messages for session ${sessionId}`);

    const channel = supabase.channel(`chat_session:${sessionId}`)
      .on<ChatMessage>(
        'postgres_changes',
        { 
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('New message received via Realtime:', payload);
          const newMessage = payload.new as ChatMessage;
          // Update local state with the new message
          setMessages(currentMessages => [...currentMessages, newMessage]);
          // Also call the handler provided by the component (e.g., for notifications)
          if (handler) {
            handler(newMessage);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to session ${sessionId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime subscription error for session ${sessionId}:`, status, err);
          setError(`Subscription failed: ${status}. ${err?.message || 'Check console for details.'}`);
        } else {
            console.log(`Realtime status for session ${sessionId}:`, status);
        }
      });

    return channel;
  }, []);

  // Implement unsubscribeFromMessages
  const unsubscribeFromMessages = useCallback(async (channel: RealtimeChannel | null) => {
    if (channel) {
      console.log(`Unsubscribing from Realtime channel: ${channel.topic}`);
      try {
        const status = await supabase.removeChannel(channel);
        console.log(`Unsubscribe status for ${channel.topic}: ${status}`);
      } catch (err) {
        console.error(`Error unsubscribing from ${channel.topic}:`, err);
        // setError might not be appropriate here as it's cleanup
      }
    }
  }, []);

  return {
    messages,
    loading,
    error,
    fetchMessages,
    createMessage,
    subscribeToNewMessages,
    unsubscribeFromMessages,
  };
} 