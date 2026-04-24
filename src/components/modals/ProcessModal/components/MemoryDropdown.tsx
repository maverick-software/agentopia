import React from 'react';
import { ChevronDown, ChevronRight, FileText, Hash } from 'lucide-react';

interface MemoryDropdownProps {
  title: string;
  memories: any[];
  type: 'episodic' | 'semantic';
}

function formatMemoryContent(content: any) {
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    if (content.event) {
      return (
        <div className="space-y-1">
          <div className="font-medium">{content.event}</div>
          {content.context && <div className="text-xs text-gray-500">Context: {JSON.stringify(content.context, null, 2).substring(0, 200)}...</div>}
          {content.participants && <div className="text-xs text-gray-500">Participants: {content.participants.join(', ')}</div>}
        </div>
      );
    }

    return <pre className="text-xs whitespace-pre-wrap overflow-hidden">{JSON.stringify(content, null, 2).substring(0, 300)}...</pre>;
  }
  return String(content);
}

export const MemoryDropdown: React.FC<MemoryDropdownProps> = ({ title, memories, type }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mt-2">
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title} ({memories.length})
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
          {memories.map((memory, index) => (
            <div key={memory.id || index} className="p-2 bg-card border border-border rounded text-xs">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  {type === 'episodic' ? <FileText className="h-3 w-3 text-primary" /> : <Hash className="h-3 w-3 text-purple-500" />}
                  <span className="font-medium text-card-foreground">{type === 'episodic' ? 'Episode' : 'Context'} #{index + 1}</span>
                </div>
                {memory.relevance_score && <span className="text-xs text-muted-foreground">Relevance: {(memory.relevance_score * 100).toFixed(1)}%</span>}
              </div>
              <div className="text-muted-foreground">{formatMemoryContent(memory.content)}</div>
              {memory.created_at && <div className="text-xs text-muted-foreground/80 mt-1">Created: {new Date(memory.created_at).toLocaleString()}</div>}
              {memory.importance && <div className="text-xs text-muted-foreground/80">Importance: {(memory.importance * 100).toFixed(0)}%</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
