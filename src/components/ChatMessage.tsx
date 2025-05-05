import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clipboard, Check } from 'lucide-react';
import type { Message } from '../types';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';

interface ChatMessageProps {
  message: Message;
  members: WorkspaceMemberDetail[];
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
                          newFormattedContent.push(<strong key={`${member.id}-${i}`} className="text-primary font-semibold">{mentionTag}</strong>);
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

export const ChatMessage = React.memo(function ChatMessage({ message, members }: ChatMessageProps) {
  useEffect(() => {
      if (message.role === 'assistant') {
          console.log('[ChatMessage] Rendering Assistant Message:', message);
          console.log('[ChatMessage] Received Members Prop:', members);
          const foundMember = members.find(m => m.agent_id === message.sender_agent_id);
          console.log('[ChatMessage] Found Member based on sender_agent_id:', foundMember);
      }
  }, [message, members]);

  const [isCopied, setIsCopied] = useState(false);

  // Enhanced agent name lookup - prioritize all possible sources of the agent name
  const agentDisplayName = useMemo(() => {
    // First check if the message already has the agent name property
    if (message.agentName) {
      return message.agentName;
    }
    
    // Next try to find the agent in the members list
    if (message.role === 'assistant' && members.length > 0) {
      // Try matching by sender_agent_id if available
      if (message.sender_agent_id) {
        const foundMember = members.find(m => m.agent_id === message.sender_agent_id);
        if (foundMember?.agent?.name) {
          return foundMember.agent.name;
        }
      }
      
      // Try matching by agentId as fallback
      if (message.agentId) {
        const foundByAgentId = members.find(m => m.agent_id === message.agentId);
        if (foundByAgentId?.agent?.name) {
          return foundByAgentId.agent.name;
        }
      }
    }
    
    // Return a default if no agent name was found
    return message.role === 'assistant' ? 'Agent' : null;
  }, [message, members]);

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
      return formatMentions(message.content, members);
  }, [message.content, members]);

  return (
    <div
      className={`flex mb-4 ${
        message.role === 'user' ? 'justify-end ml-auto max-w-[85%]' : 'justify-start mr-auto max-w-[85%]'
      }`}
    >
      <div
        className={`relative group rounded-lg p-3 text-sm break-words shadow-md ${
          message.role === 'user'
            ? 'bg-muted text-foreground'
            : 'bg-secondary text-secondary-foreground'
        }`}
      >
        {message.role === 'assistant' && (
          <p className="text-xs font-medium text-muted-foreground mb-1">{agentDisplayName}</p>
        )}
        <div className="break-words">
          {formattedContent}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground opacity-80">
            {message.timestamp instanceof Date 
              ? message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              : '--:--'}
          </p>
          {message.role === 'assistant' && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded opacity-50 group-hover:opacity-100"
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