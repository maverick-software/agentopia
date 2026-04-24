import React from 'react';
import { Brain } from 'lucide-react';
import { MemoryDropdown } from './MemoryDropdown';

interface MemoryOperationsCardProps {
  memoryOperations: any;
}

const statusLabel: Record<string, string> = {
  searched: 'Searched',
  disconnected: 'Disconnected',
  disabled: 'Disabled',
  error: 'Error',
};

const statusColor: Record<string, string> = {
  searched: 'bg-green-500',
  disconnected: 'bg-orange-500',
  disabled: 'bg-gray-400',
  error: 'bg-red-500',
};

function formatTime(ms: number) {
  return `${ms}ms`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export const MemoryOperationsCard: React.FC<MemoryOperationsCardProps> = ({ memoryOperations }) => {
  const episodic = memoryOperations?.episodic_search;
  const semantic = memoryOperations?.semantic_search;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Memory Operations</h3>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-2 w-2 rounded-full ${statusColor[episodic?.status] || 'bg-gray-400'}`} />
          <span className="font-medium text-sm text-foreground">Episodic Memory</span>
        </div>
        {episodic ? (
          <div className="ml-4 text-sm text-muted-foreground space-y-1">
            <div>Status: {statusLabel[episodic.status] || 'Unknown'}</div>
            {episodic.status === 'searched' && (
              <>
                <div>Results: {episodic.results_count}</div>
                <div>Search Time: {formatTime(episodic.search_time_ms)}</div>
                {episodic.relevance_scores?.length > 0 && (
                  <div>
                    Avg Relevance:{' '}
                    {formatPercent(
                      episodic.relevance_scores.reduce((a: number, b: number) => a + b, 0) /
                        episodic.relevance_scores.length,
                    )}
                  </div>
                )}
                {episodic.memories?.length > 0 && (
                  <MemoryDropdown title="View Retrieved Memories" memories={episodic.memories} type="episodic" />
                )}
              </>
            )}
          </div>
        ) : (
          <div className="ml-4 text-sm text-muted-foreground/80">No episodic memory search performed</div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-2 w-2 rounded-full ${statusColor[semantic?.status] || 'bg-gray-400'}`} />
          <span className="font-medium text-sm text-foreground">Semantic Memory</span>
        </div>
        {semantic ? (
          <div className="ml-4 text-sm text-muted-foreground space-y-1">
            <div>Status: {statusLabel[semantic.status] || 'Unknown'}</div>
            {semantic.status === 'searched' && (
              <>
                <div>Results: {semantic.results_count}</div>
                <div>Search Time: {formatTime(semantic.search_time_ms)}</div>
                {semantic.concepts_retrieved?.length > 0 && (
                  <div>Concepts: {semantic.concepts_retrieved.join(', ')}</div>
                )}
                {semantic.memories?.length > 0 && (
                  <MemoryDropdown title="View Retrieved Context" memories={semantic.memories} type="semantic" />
                )}
              </>
            )}
          </div>
        ) : (
          <div className="ml-4 text-sm text-muted-foreground/80">No semantic memory search performed</div>
        )}
      </div>
    </div>
  );
};
