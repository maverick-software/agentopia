import React from 'react';
import { Loader2 } from 'lucide-react';
import { MessageList, ChatStarterScreen } from '../../components/chat/MessageComponents';
import { ChatInput } from '../../components/chat/ChatInput';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { RealtimeVoiceChat } from '../../components/voice/RealtimeVoiceChat';

export function AgentChatContent({
  agent,
  agentId,
  user,
  conversationHook,
  messageHook,
  aiHook,
  input,
  setInput,
  sending,
  uploadHook,
  chatMode,
  setChatMode,
  handleSubmit,
  handleKeyDown,
  adjustTextareaHeight,
  setShowAgentSettingsModal,
  setCurrentProcessingDetails,
  setShowProcessModal,
  setDebugProcessingDetails,
  setShowDebugModal,
  currentProcessingDetails,
}: any) {
  if (chatMode === 'realtime') {
    return (
      <RealtimeVoiceChat
        conversationId={conversationHook.conversationLifecycle.id || ''}
        agentId={agentId || ''}
        agentName={agent?.name}
        agentAvatar={agent?.avatar_url || undefined}
        voice="alloy"
        onClose={() => setChatMode('text')}
        onConversationCreated={(newConversationId) => {
          conversationHook.startNewConversation(newConversationId);
          messageHook.markConversationAsFresh(newConversationId);
        }}
      />
    );
  }

  return (
    <>
      <ChatHeader
        agent={agent}
        agentId={agentId || ''}
        conversationId={
          conversationHook.conversationLifecycle.status === 'active'
            ? conversationHook.conversationLifecycle.id
            : undefined
        }
        onShowAgentSettings={() => setShowAgentSettingsModal(true)}
      />

      <div className="flex-1 min-h-0 relative flex justify-center">
        <div
          className="absolute top-0 left-0 right-0 h-20 chat-gradient-fade-top pointer-events-none z-10 opacity-0 transition-opacity duration-300"
          style={{ opacity: messageHook.messages.length > 0 ? 1 : 0 }}
        />

        {conversationHook.conversationLifecycle.status === 'none' ? (
          <div className="w-full">
            <ChatStarterScreen agent={agent} user={user} />
          </div>
        ) : messageHook.isHistoryLoading ? (
          <div className="flex items-center justify-center h-full w-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-w-3xl w-full overflow-y-auto chat-scrollbar px-4 py-6 pb-8">
            <MessageList
              messages={messageHook.messages}
              agent={agent}
              user={user}
              aiState={aiHook.aiState}
              currentTool={aiHook.currentTool}
              processSteps={aiHook.processSteps}
              thinkingMessageIndex={aiHook.thinkingMessageIndex}
              formatMarkdown={(text: string) => text}
              currentProcessingDetails={currentProcessingDetails}
              onShowProcessModal={(details) => {
                setCurrentProcessingDetails(details);
                setShowProcessModal(true);
              }}
              onShowDebugModal={(details) => {
                setDebugProcessingDetails(details);
                setShowDebugModal(true);
              }}
            />
            <div ref={messageHook.messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        agent={agent}
        sending={sending}
        uploading={uploadHook.uploading}
        uploadProgress={uploadHook.uploadProgress}
        attachedDocuments={uploadHook.attachedDocuments}
        chatMode={chatMode}
        onChatModeChange={setChatMode}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onFileUpload={uploadHook.handleFileUpload}
        onRemoveAttachment={uploadHook.handleRemoveAttachment}
        adjustTextareaHeight={adjustTextareaHeight}
        onShowAgentSettings={() => setShowAgentSettingsModal(true)}
      />
    </>
  );
}
