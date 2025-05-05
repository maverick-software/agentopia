import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clipboard, Check } from 'lucide-react';
import type { Message } from '../types';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';

interface ChatMessageProps {
  message: Message & {
    agentName?: string | null;
  };
  workspaceMembers: WorkspaceMemberDetail[];
}

const formatMentions = (content: string, members: WorkspaceMemberDetail[]): React.ReactNode => {
  let formattedContent: React.ReactNode[] = [content];
  
  members.forEach(member => {
      if (member.agent?.name) {
          const mentionTag = `@${member.agent.name}`;
          const newFormattedContent: React.ReactNode[] = [];
          formattedContent.forEach(node => {
              if (typeof node === 'string') {
                  const parts = node.split(mentionTag);
                  for (let i = 0; i < parts.length; i++) {
                      newFormattedContent.push(parts[i]);
                      if (i < parts.length - 1) {
                          newFormattedContent.push(<strong key={`${member.id}-${i}`} className="text-indigo-400">{mentionTag}</strong>);
                      }
                  }
              } else {
                  newFormattedContent.push(node);
              }
          });
          formattedContent = newFormattedContent;
      }
  });

  return formattedContent;
};

export const ChatMessage = React.memo(function ChatMessage({ message, workspaceMembers }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const formattedContent = useMemo(() => {
      return formatMentions(message.content, workspaceMembers);
  }, [message.content, workspaceMembers]);

  console.log("Rendering message with agent name:", message.agentName);

  return (
    <div
      className={`flex ${
        message.role === 'user' ? 'justify-end mr-4' : 'justify-start'
      }`}
    >
      <div
        className={`relative group max-w-2xl rounded-lg p-3 text-sm prose prose-sm prose-invert break-words ${
          message.role === 'user'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-600 text-gray-200'
        }`}
      >
        {message.role === 'assistant' && message.agentName && (
          <p className="text-xs font-medium text-indigo-300 mb-1">{message.agentName}</p>
        )}
        <div className="prose prose-sm prose-invert break-words">
          {formattedContent}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs opacity-70">
            {message.timestamp instanceof Date 
              ? message.timestamp.toLocaleTimeString() 
              : '--:--:--'}
          </p>
          {message.role === 'assistant' && (
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded"
              title="Copy response"
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Clipboard className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});