import React from 'react';
import { Lightbulb } from 'lucide-react';

interface KnowledgeSummaryProps {
  connectedDatastores: string[];
  memoryPreferences: string[];
}

export const KnowledgeSummary: React.FC<KnowledgeSummaryProps> = ({
  connectedDatastores,
  memoryPreferences,
}) => {
  if (connectedDatastores.length === 0 && memoryPreferences.length === 0) return null;

  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-muted">
      <div className="text-sm font-medium mb-2 flex items-center">
        <Lightbulb className="h-4 w-4 mr-2" />
        Summary of my knowledge setup:
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li>
          - Connected to {connectedDatastores.length} knowledge source
          {connectedDatastores.length !== 1 ? 's' : ''}
        </li>
        <li>
          -{' '}
          {memoryPreferences.includes('forget_sessions')
            ? 'Will forget after each session'
            : `Will remember ${memoryPreferences.length} type${memoryPreferences.length !== 1 ? 's' : ''} of information`}
        </li>
      </ul>
    </div>
  );
};
