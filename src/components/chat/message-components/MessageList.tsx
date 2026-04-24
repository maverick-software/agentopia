import React, { useState } from 'react';
import { InlineThinkingIndicator } from '@/components/InlineThinkingIndicator';
import { CanvasMode } from '@/components/chat/CanvasMode';
import { useArtifacts } from '@/hooks/useArtifacts';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import type { Artifact } from '@/types/artifacts';
import type { Message } from '@/types';
import { MessageItem } from './MessageItem';
import type { MessageListProps } from './types';

export function MessageList({
  messages,
  agent,
  user,
  thinkingMessageIndex,
  formatMarkdown,
  currentProcessingDetails,
  onShowProcessModal,
  onShowDebugModal,
  aiState,
  currentTool,
  processSteps,
  onCanvasSendMessage,
}: MessageListProps) {
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const [canvasArtifact, setCanvasArtifact] = useState<Artifact | null>(null);
  const { updateArtifact, downloadArtifact, getArtifact } = useArtifacts();

  const getArtifactsFromMessage = (message: Message): Artifact[] => {
    if (!message.metadata?.artifacts) return [];
    const artifacts = Array.isArray(message.metadata.artifacts) ? message.metadata.artifacts : [message.metadata.artifacts];
    return artifacts.filter((a: any) => a && typeof a === 'object');
  };

  const handleOpenCanvas = async (artifact: Artifact) => {
    const latest = await getArtifact(artifact.id);
    setCanvasArtifact(latest || artifact);
  };

  const handleSaveArtifact = async (content: string, changes_note?: string) => {
    if (!canvasArtifact || !agent?.id) return;
    const updated = await updateArtifact({ artifact_id: canvasArtifact.id, content, changes_note }, agent.id);
    if (updated) setCanvasArtifact(updated);
  };

  const displayMessages = messages.filter((message, index) => {
    if (message.role === 'thinking') return index === thinkingMessageIndex && !message.metadata?.isCompleted;
    return true;
  });

  return (
    <>
      <div className="space-y-4">
        {displayMessages.map((message, index) => {
          if (message.role === 'thinking') {
            return (
              <InlineThinkingIndicator
                key={`thinking-${message.timestamp?.getTime() || index}`}
                isVisible={true}
                currentState={aiState}
                currentTool={currentTool}
                processSteps={
                  processSteps?.map((step) => ({
                    state: step.state,
                    label: step.label,
                    duration: step.duration,
                    details: step.details,
                    completed: step.completed,
                    toolInfo: step.toolInfo,
                  })) || []
                }
                agentName={agent?.name || 'Agent'}
                agentAvatarUrl={agent?.avatar_url}
                isCompleted={false}
                className="mb-4"
              />
            );
          }

          return (
            <MessageItem
              key={`${message.role}-${index}-${String(message.timestamp ?? index)}`}
              message={message}
              index={index}
              user={user}
              agent={agent}
              resolvedAvatarUrl={resolvedAvatarUrl}
              formatMarkdown={formatMarkdown}
              getArtifactsFromMessage={getArtifactsFromMessage}
              handleOpenCanvas={handleOpenCanvas}
              downloadArtifact={downloadArtifact}
              onShowProcessModal={onShowProcessModal}
              onShowDebugModal={onShowDebugModal}
            />
          );
        })}
      </div>

      {canvasArtifact && (
        <CanvasMode
          artifact={canvasArtifact}
          onClose={() => setCanvasArtifact(null)}
          onSave={handleSaveArtifact}
          onDownload={downloadArtifact}
          messages={messages}
          agent={agent}
          user={user}
          onSendMessage={async (message) => {
            if (onCanvasSendMessage && canvasArtifact) {
              await onCanvasSendMessage(message, canvasArtifact.id);
            }
          }}
          thinkingMessageIndex={thinkingMessageIndex}
          currentProcessingDetails={currentProcessingDetails}
          aiState={aiState}
          currentTool={currentTool}
          processSteps={processSteps}
        />
      )}
    </>
  );
}
