import React from 'react';
import { MessageSquare } from 'lucide-react';

interface ReasoningChainCardProps {
  reasoningChain: any[];
  reasoningGraph?: { states?: string[] };
  onSelectStep: (step: any) => void;
}

function formatTime(ms: number) {
  return `${ms}ms`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export const ReasoningChainCard: React.FC<ReasoningChainCardProps> = ({
  reasoningChain,
  reasoningGraph,
  onSelectStep,
}) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Reasoning Chain</h3>
      </div>

      {reasoningGraph?.states?.length ? (
        <div className="mb-3 text-xs text-muted-foreground">
          <span className="font-medium">Markov Path:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {reasoningGraph.states.map((state, i) => (
              <span key={`${state}-${i}`} className="px-2 py-0.5 bg-muted text-muted-foreground border border-border rounded">
                {i + 1}. {state}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {reasoningChain?.length > 0 ? (
        <div className="space-y-3">
          {reasoningChain.map((step: any, idx: number) => (
            <div key={idx} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                {step.step}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground uppercase">{step.type}</span>
                  <span className="text-xs text-muted-foreground">({formatTime(step.time_ms)})</span>
                  <span className="text-xs text-muted-foreground">
                    Confidence: {formatPercent(step.confidence)}
                  </span>
                  <button
                    className="ml-auto text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                    onClick={() => onSelectStep(step)}
                  >
                    View
                  </button>
                </div>
                <div className="text-sm text-foreground">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No reasoning chain captured</div>
      )}
    </div>
  );
};
