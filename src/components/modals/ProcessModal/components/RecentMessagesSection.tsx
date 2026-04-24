import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface RecentMessagesSectionProps {
  messages: any[];
}

export const RecentMessagesSection: React.FC<RecentMessagesSectionProps> = ({ messages }) => {
  const [expandedIndices, setExpandedIndices] = React.useState<Set<number>>(new Set());

  const toggleExpanded = (idx: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div>
      <div className="font-medium text-foreground mb-2">Last 5 Messages in Context:</div>
      {messages.length > 0 ? (
        <div className="space-y-1">
          {messages.map((msg: any, idx: number) => {
            const isExpanded = expandedIndices.has(idx);
            const preview = msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : '');
            return (
              <div key={idx} className="bg-muted/30 border border-muted rounded overflow-hidden">
                <button onClick={() => toggleExpanded(idx)} className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors text-left">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground shrink-0">{msg.role === 'user' ? '👤 User' : '🤖 Assistant'}</span>
                    <span className="text-xs text-muted-foreground truncate">{preview}</span>
                  </div>
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="px-3 py-2 border-t border-muted bg-muted/20">
                    <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Loading recent messages...</div>
      )}
    </div>
  );
};
