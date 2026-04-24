import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';

type SubmitDependencies = {
  input: string;
  agent: any;
  sending: boolean;
  user: any;
  setInput: (value: string) => void;
  setSending: (value: boolean) => void;
  setError: (value: string | null) => void;
  conversationHook: any;
  messageHook: any;
  aiHook: any;
  uploadHook: any;
  setCurrentProcessingDetails: (value: any) => void;
  setShowProcessModal: (value: boolean) => void;
  setDebugProcessingDetails: (value: any) => void;
  setShowDebugModal: (value: boolean) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
};

export function useAgentChatSubmit(deps: SubmitDependencies) {
  const {
    input,
    agent,
    sending,
    user,
    setInput,
    setSending,
    setError,
    conversationHook,
    messageHook,
    aiHook,
    uploadHook,
    abortControllerRef,
  } = deps;

  return useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || !agent || sending || !user?.id) return;

      const messageText = input.trim();
      setInput('');
      uploadHook.setAttachedDocuments([]);
      setSending(true);

      const isFirstMessage = conversationHook.conversationLifecycle.status === 'none';
      let convId: string;
      let sessId: string;

      if (isFirstMessage) {
        convId = crypto.randomUUID();
        sessId = crypto.randomUUID();
        conversationHook.startNewConversation(convId);
        messageHook.markConversationAsFresh(convId);
        localStorage.setItem(`agent_${agent.id}_session_id`, sessId);
      } else {
        convId =
          conversationHook.conversationLifecycle.status === 'active' ||
          conversationHook.conversationLifecycle.status === 'creating'
            ? conversationHook.conversationLifecycle.id
            : crypto.randomUUID();
        sessId = localStorage.getItem(`agent_${agent.id}_session_id`) || crypto.randomUUID();
      }

      const userMessage = {
        role: 'user' as const,
        content: messageText,
        timestamp: new Date(),
        userId: user.id,
      };

      messageHook.setMessages((prev: any[]) => [...prev, userMessage]);
      aiHook.startAIProcessing(messageHook.setMessages);
      requestAnimationFrame(() => {
        messageHook.scrollToBottom();
      });

      try {
        setSending(true);
        setError(null);

        if (!agent?.id || agent.id === '') {
          throw new Error('Agent ID is invalid');
        }

        const { data: existingSession } = await supabase
          .from('conversation_sessions')
          .select('conversation_id')
          .eq('conversation_id', convId)
          .maybeSingle();

        if (!existingSession) {
          const { error: sessionInsertError } = await supabase.from('conversation_sessions').insert({
            conversation_id: convId,
            agent_id: agent.id,
            user_id: user.id,
            title: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
            status: 'active',
            last_active: new Date().toISOString(),
            message_count: 0,
          });

          if (sessionInsertError) {
            throw sessionInsertError;
          }
        } else {
          await supabase
            .from('conversation_sessions')
            .update({ last_active: new Date().toISOString() })
            .eq('conversation_id', convId);
        }

        const { error: saveError } = await supabase.from('chat_messages_v2').insert({
          conversation_id: convId,
          session_id: sessId,
          channel_id: null,
          role: 'user',
          content: { type: 'text', text: messageText },
          sender_user_id: user.id,
          sender_agent_id: null,
          metadata: { target_agent_id: agent.id },
          context: { agent_id: agent.id, user_id: user.id },
        });

        if (saveError) throw saveError;

        const processingPromise = aiHook.simulateAIProcessing();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error(
            `Authentication error: ${sessionError?.message || 'Could not get session token.'}`,
          );
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        if (!user?.id) {
          throw new Error('User ID is missing - please refresh the page and try again');
        }

        if (!agent?.id || agent.id === '') {
          throw new Error('Agent ID is missing or invalid');
        }

        const [response] = await Promise.all([
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              version: '2.0.0',
              message: {
                role: 'user',
                content: {
                  type: 'text',
                  text: messageText,
                },
              },
              context: {
                agent_id: agent.id,
                user_id: user.id,
                conversation_id: convId,
                session_id: sessId,
              },
              options: {
                agent_runtime: {
                  enabled: true,
                  execution_contract: 'strict-agentic',
                },
                context: {
                  max_messages: 25,
                },
              },
            }),
            signal: abortController.signal,
          }),
          processingPromise,
        ]);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        const assistantReply = responseData?.data?.message?.content?.text || responseData?.message;

        if (typeof assistantReply !== 'string') {
          throw new Error('Received an invalid response format from the chat service.');
        }

        const processingDetails = responseData?.processing_details;
        if (processingDetails) {
          processingDetails.conversation_id = convId;
        }

        const responseMetadata = responseData?.data?.message?.metadata || {};
        responseMetadata.processingDetails = processingDetails;
        try {
          const { data: runtimeEvents } = await supabase
            .from('agent_run_events')
            .select('stream,event_type,payload,created_at')
            .eq('session_id', sessId)
            .order('created_at', { ascending: true })
            .limit(100);
          responseMetadata.agentRuntimeEvents = runtimeEvents || [];
        } catch {
          responseMetadata.agentRuntimeEvents = [];
        }

        await aiHook.completeAIProcessingWithResponse(
          assistantReply,
          responseMetadata,
          messageHook.setMessages,
        );

        if (aiHook.isMounted.current) {
          requestAnimationFrame(messageHook.scrollToBottom);
        }

        if (isFirstMessage) {
          conversationHook.markConversationActive();
        }

        try {
          const { count } = await supabase
            .from('chat_messages_v2')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convId);

          if (count && count % 5 === 0 && count >= 5) {
            supabase.functions.invoke('conversation-summarizer', {
              body: {
                conversation_id: convId,
                agent_id: agent.id,
                user_id: user.id,
                message_count: count,
                force_full_summary: false,
                manual_trigger: false,
              },
            });
          }
        } catch {
          // Non-fatal: summarization trigger failures should not block chat.
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          aiHook.completeAIProcessing(false, messageHook.setMessages);
        } else {
          aiHook.completeAIProcessing(false, messageHook.setMessages);

          if (aiHook.isMounted.current) {
            const errorMessage = {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: `I'm sorry, I encountered an error while processing your message: ${err.message}. Please try again or start a new conversation if the problem persists.`,
              created_at: new Date().toISOString(),
              metadata: {
                error: true,
                originalError: err.message,
              },
            };

            messageHook.setMessages((prev: any[]) => [...prev, errorMessage]);
            requestAnimationFrame(messageHook.scrollToBottom);
          }
        }
      } finally {
        setSending(false);
      }
    },
    [
      input,
      agent,
      sending,
      user?.id,
      setInput,
      setSending,
      setError,
      conversationHook,
      messageHook,
      aiHook,
      uploadHook,
      abortControllerRef,
    ],
  );
}
