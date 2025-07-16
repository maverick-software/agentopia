import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clipboard, Check, Settings, Wrench } from 'lucide-react';
import type { Message, ToolCall } from '../types';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
import ToolCallIndicator from './ToolCallIndicator';

interface ChatMessageProps {
  message: Message;
  members?: WorkspaceMemberDetail[];
}

const formatMentions = (content: string, members: WorkspaceMemberDetail[] = []): React.ReactNode => {
  let formattedContent: React.ReactNode[] = [content];
  
  // Add safety check for members array
  if (!members || !Array.isArray(members) || members.length === 0) {
    return content;
  }
  
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

export const ChatMessage = React.memo(function ChatMessage({ message, members = [] }: ChatMessageProps) {
  useEffect(() => {
      if (message.role === 'assistant') {
          console.log('[ChatMessage] Rendering Assistant Message:', message);
          console.log('[ChatMessage] Received Members Prop:', members);
          // Type guard for sender_agent_id property
          const senderAgentId = 'sender_agent_id' in message ? (message as any).sender_agent_id : null;
          const foundMember = members?.find(m => m.agent_id === senderAgentId);
          console.log('[ChatMessage] Found Member based on sender_agent_id:', foundMember);
      }
  }, [message, members]);

  const [isCopied, setIsCopied] = useState(false);

  // Enhanced agent name lookup - prioritize all possible sources of the agent name
  const agentDisplayName = useMemo(() => {
    // First check if the message already has the agent name property (with type guard)
    const agentName = 'agentName' in message ? (message as any).agentName : null;
    if (agentName) {
      return agentName;
    }
    
    // Next try to find the agent in the members list
    if (message.role === 'assistant' && members && members.length > 0) {
      // Try matching by sender_agent_id if available (with type guard)
      const senderAgentId = 'sender_agent_id' in message ? (message as any).sender_agent_id : null;
      if (senderAgentId) {
        const foundMember = members.find(m => m.agent_id === senderAgentId);
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
      return formatMentions(message.content, members || []);
  }, [message.content, members]);

  return (
    <div
      className={`flex mb-4 ${
        message.role === 'user' ? 'justify-end ml-auto max-w-[85%]' : 'justify-start mr-auto max-w-[85%]'
      }`}
    >
      <div className="flex flex-col space-y-2 w-full">
        {/* Tool calls display - shown above the message */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((toolCall, index) => (
              <ToolCallIndicator
                key={toolCall.id || `tool-${index}`}
                toolCall={{
                  tool_name: toolCall.tool_name,
                  tool_provider: toolCall.tool_provider,
                  parameters: toolCall.parameters,
                  status: toolCall.status,
                  execution_time_ms: toolCall.execution_time_ms,
                  error_message: toolCall.error_message,
                  result: toolCall.result,
                  created_at: toolCall.created_at,
                }}
              />
            ))}
          </div>
        )}

        {/* Main message content */}
      <div
        className={`relative group rounded-lg p-3 text-sm break-words shadow-md ${
          message.role === 'user'
            ? 'bg-muted text-foreground'
            : 'bg-secondary text-secondary-foreground'
        }`}
      >
          <div className="flex items-start justify-between">
            <div className="flex-1">
        {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{agentDisplayName}</p>
                  {message.isToolResponse && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">
                      <Wrench className="w-3 h-3" />
                      <span>Tool Response</span>
                    </div>
                  )}
                </div>
        )}
        <div className="break-words">
          {formattedContent}
        </div>
            </div>
            
          {message.role === 'assistant' && (
            <button
              onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded opacity-50 group-hover:opacity-100 ml-2"
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
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground opacity-80">
                {message.timestamp instanceof Date 
                  ? message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : '--:--'}
              </p>
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Settings className="w-3 h-3" />
                  <span>{message.toolCalls.length} tool{message.toolCalls.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;