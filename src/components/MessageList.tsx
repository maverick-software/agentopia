import React, { useRef, useEffect } from 'react';
import { type ChatMessage } from '../types/chat';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Assuming Shadcn
import { format } from 'date-fns'; // For timestamp formatting

interface MessageListProps {
  messages: ChatMessage[];
  // TODO: Add function prop for loading older messages
  // onLoadOlder: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (timestamp: string) => {
    try {
        // Basic formatting, adjust as needed
        return format(new Date(timestamp), 'Pp'); // e.g., 04/26/2025, 10:45:12 AM
    } catch {
        return timestamp; // Fallback if date is invalid
    }
  };

  return (
    <div className="space-y-4">
      {/* TODO: Add button/trigger for loading older messages */} 
      {messages.map((message) => (
        <div key={message.id} className="flex items-start space-x-3 group">
          {/* Avatar Placeholder */}
          <Avatar className="w-8 h-8 border border-gray-300 dark:border-gray-600">
             {/* Conditional rendering based on sender type */} 
             {message.sender_user && (
                 <>
                    <AvatarImage src={message.sender_user?.avatar_url || undefined} alt={message.sender_user?.full_name || 'User'} />
                    <AvatarFallback>{message.sender_user?.full_name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                 </>
             )}
             {message.sender_agent && (
                 <AvatarFallback className="bg-indigo-600 text-white">{message.sender_agent?.name?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
             )}
             {!message.sender_user && !message.sender_agent && (
                 <AvatarFallback>?</AvatarFallback> // Unknown sender?
             )}
          </Avatar>

          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className="font-semibold text-sm">
                 {message.sender_user?.full_name || message.sender_agent?.name || 'Unknown Sender'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(message.created_at)}
              </span>
            </div>
            {/* Message Content - needs careful handling for potential markdown/code blocks later */}
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            {/* TODO: Add reactions/actions on hover? */}
          </div>
        </div>
      ))}
      {/* Invisible element to scroll to */} 
      <div ref={endOfMessagesRef} /> 
    </div>
  );
};

export default MessageList; 