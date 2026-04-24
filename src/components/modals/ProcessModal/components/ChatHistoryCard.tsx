import React from 'react';
import { CheckCircle, MessageSquare, XCircle } from 'lucide-react';

interface ChatHistoryCardProps {
  chatHistory: any;
}

export const ChatHistoryCard: React.FC<ChatHistoryCardProps> = ({ chatHistory }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Chat History Context</h3>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Messages Considered:</span>
          <span className="ml-2">{chatHistory?.messages_considered || 0}</span>
        </div>
        <div>
          <span className="font-medium text-foreground">Context Window Used:</span>
          <span className="ml-2">{chatHistory?.context_window_used || 0} tokens</span>
        </div>
        <div className="flex items-center gap-1">
          {chatHistory?.relevance_filtering ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span>Relevance Filtering Applied</span>
        </div>
      </div>
    </div>
  );
};
