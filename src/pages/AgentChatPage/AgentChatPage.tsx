import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAgents } from '../../hooks/useAgents';
import { refreshAgentAvatarUrl } from '../../lib/avatarUtils';
import type { Database } from '../../types/database.types';
import { ChatModals } from '../../components/chat/ChatModals';
import { LLMDebugModal } from '../../components/modals/LLMDebugModal';
import { useConversationLifecycle } from '../../hooks/chat/useConversationLifecycle';
import { useChatMessages } from '../../hooks/chat/useChatMessages';
import { useAIProcessing } from '../../hooks/chat/useAIProcessing';
import { useFileUpload } from '../../hooks/chat/useFileUpload';
import { AgentChatContent } from './AgentChatContent';
import { useAgentChatSubmit } from './useAgentChatSubmit';

type Agent = Database['public']['Tables']['agents']['Row'];
type ChatMode = 'text' | 'realtime';

export function AgentChatPage() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const { updateAgent } = useAgents();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgentSettingsModal, setShowAgentSettingsModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [currentProcessingDetails, setCurrentProcessingDetails] = useState<any>(null);
  const [debugProcessingDetails, setDebugProcessingDetails] = useState<any>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('text');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const conversationHook = useConversationLifecycle(agentId, user?.id);
  const messageHook = useChatMessages(
    agentId,
    user?.id,
    conversationHook.conversationLifecycle,
    conversationHook.conversationRefreshKey,
  );
  const aiHook = useAIProcessing(agent, user, input);
  const uploadHook = useFileUpload(user, agent);

  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId || !user) return;

      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .single();

        if (fetchError) throw fetchError;

        let finalAgent = data;
        if (data.avatar_url) {
          const refreshedUrl = await refreshAgentAvatarUrl(supabase, data.id, data.avatar_url);
          if (refreshedUrl !== data.avatar_url) {
            finalAgent = { ...data, avatar_url: refreshedUrl };
          }
        }

        setAgent(finalAgent);
      } catch {
        setError('Could not load agent');
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [agentId, user]);

  const handleSubmit = useAgentChatSubmit({
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
    setCurrentProcessingDetails,
    setShowProcessModal,
    setDebugProcessingDetails,
    setShowDebugModal,
    abortControllerRef,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as any);
      }
    },
    [handleSubmit],
  );

  const adjustTextareaHeight = useCallback(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = 'auto';
    const scrollHeight = textareaRef.current.scrollHeight;
    const maxHeight = 200;
    const newHeight = Math.min(scrollHeight, maxHeight);
    textareaRef.current.style.height = `${newHeight}px`;
    textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">{error}</p>
          <button onClick={() => window.location.reload()} className="text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0">
        <AgentChatContent
          agent={agent}
          agentId={agentId}
          user={user}
          conversationHook={conversationHook}
          messageHook={messageHook}
          aiHook={aiHook}
          input={input}
          setInput={setInput}
          sending={sending}
          uploadHook={uploadHook}
          chatMode={chatMode}
          setChatMode={setChatMode}
          handleSubmit={handleSubmit}
          handleKeyDown={handleKeyDown}
          adjustTextareaHeight={adjustTextareaHeight}
          setShowAgentSettingsModal={setShowAgentSettingsModal}
          setCurrentProcessingDetails={setCurrentProcessingDetails}
          setShowProcessModal={setShowProcessModal}
          setDebugProcessingDetails={setDebugProcessingDetails}
          setShowDebugModal={setShowDebugModal}
          currentProcessingDetails={currentProcessingDetails}
        />
      </div>

      <ChatModals
        agentId={agent.id}
        agent={agent}
        showAgentSettingsModal={showAgentSettingsModal}
        setShowAgentSettingsModal={setShowAgentSettingsModal}
        showProcessModal={showProcessModal}
        setShowProcessModal={setShowProcessModal}
        currentProcessingDetails={currentProcessingDetails}
        onAgentUpdated={(updatedAgent) => setAgent(updatedAgent)}
        updateAgent={async (id: string, data: any) => {
          await updateAgent(id, data);
        }}
      />

      <LLMDebugModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        processingDetails={debugProcessingDetails}
      />
    </div>
  );
}
